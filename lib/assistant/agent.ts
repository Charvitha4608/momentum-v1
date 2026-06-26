// The "brain" behind the in-app command bar (⌘K).
//
// Same shape as the planner agent (lib/planner/agent.ts): a Gemini
// function-calling loop that picks exactly one tool per turn, can pause to ask
// ONE clarifying question with quick-reply chips, and degrades to a transparent
// heuristic when GEMINI_API_KEY is absent or the call fails — the feature never
// hard-errors.
//
// Unlike the planner, the tools here are *proposal generators*: the model turns
// a free-text command into a structured proposal (break a goal into tasks, set
// up a recurring task, or run the weekly planner). Nothing is written from this
// file — the server action (app/actions/assistant.ts) stages the proposal and
// the command bar requires an explicit confirm before anything is applied.

import {
  appendAnswer,
  type ClarifyingQuestion,
  type ClarifyOption,
} from "@/lib/planner/agent"
import type { TimeOfDay } from "@/lib/planner/schedule"

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
const MAX_TURNS = 4

// Re-export so callers (the server action) keep one import surface.
export { appendAnswer }
export type { ClarifyingQuestion, ClarifyOption }

export type AssistantPillar = { id: number; name: string }

export type AssistantContext = {
  today: string
  pillars: AssistantPillar[]
  // Light balance hint so a goal breakdown can lean toward under-served pillars.
  effort: { pillarName: string; percentOfTarget: number }[]
}

export type RecurringFrequency = "daily" | "weekly" | "custom"

export type BreakdownTask = {
  title: string
  pillarId: number | null
  durationMinutes: number | null
  deadline: string | null
}

export type BreakdownProposal = {
  kind: "breakdown"
  goalText: string
  tasks: BreakdownTask[]
}

export type RecurringProposal = {
  kind: "recurring"
  title: string
  pillarId: number | null
  frequency: RecurringFrequency
  daysOfWeek: number[] // 0=Sun..6=Sat, for 'weekly'
  intervalDays: number | null // for 'custom'
  durationMinutes: number | null
  preferredTimeOfDay: Exclude<TimeOfDay, "any"> | null
}

export type PlanWeekProposal = { kind: "plan_week" }

// A measurable-quantity-by-a-deadline goal ("do 50 questions in 2 weeks").
// Applied as a long-term goal PLUS a recurring task that generates ~perSession
// units each occurrence and stops at the deadline, so the total is reached by
// then. perSession is computed deterministically from targetValue and how many
// occurrences the cadence yields before the deadline.
export type GoalPlanProposal = {
  kind: "goal_plan"
  goalTitle: string
  pillarId: number | null
  unit: string // e.g. "questions" — for display in the task title
  targetValue: number
  deadline: string // YYYY-MM-DD
  frequency: "daily" | "weekly"
  daysOfWeek: number[] // 0=Sun..6=Sat, for 'weekly'
  perSession: number
  occurrences: number
  durationMinutes: number | null
  preferredTimeOfDay: Exclude<TimeOfDay, "any"> | null
}

export type AssistantProposal = BreakdownProposal | RecurringProposal | PlanWeekProposal | GoalPlanProposal

export type AssistantTurn =
  | { kind: "question"; question: ClarifyingQuestion; messages: unknown[] }
  | { kind: "proposal"; proposal: AssistantProposal; source: "ai" | "heuristic"; messages: unknown[] }
  // A read-only "what's planned for X?" query. Resolved to a schedule readout by
  // the server action — never staged as a propose → confirm → apply proposal.
  | { kind: "read_schedule"; start: string; end: string; messages: unknown[] }

const SYSTEM_PROMPT = `You are the command bar assistant inside Momentum, a personal-growth app where users invest effort into "pillars" (life areas like DSA, Gym, Reading).

The user types one short natural-language command. Turn it into exactly ONE proposal by calling exactly one tool:
- plan_goal: when the user states a goal to reach a measurable QUANTITY by a TIME (e.g. "do 50 questions in 2 weeks", "read 12 books this year", "solve 100 problems in a month", "run 60 km in 3 weeks"). This is the most important case to get right. Do NOT restate it as a single task. Instead figure out the total quantity, its unit, and a concrete deadline date, then pick a realistic cadence (daily, or weekly on specific weekdays) so the work is SPREAD OUT and the total is finished by the deadline. The app computes the per-session amount and creates a repeating task plus a tracked goal automatically.
- breakdown_goal: when the user states a goal or project WITHOUT a measurable quantity-by-deadline (e.g. "learn React", "prepare for the interview"). Break it into 2-6 concrete, actionable tasks and map EACH task to the most relevant existing pillar by id. Tasks are unscheduled to-dos.
- create_recurring: when the user describes a repeating habit with no fixed end total (e.g. "gym mon/wed/fri", "read 30 min every day", "review notes every 3 days"). Map it to the most relevant pillar.
- plan_week: when the user asks to schedule, organize, or plan their week/day (e.g. "plan my week", "organize my schedule"). Takes no arguments.
- read_schedule: when the user ASKS what is already planned, scheduled, or done for a day or range (e.g. "what's on Friday?", "what did I plan for tomorrow?", "show my week", "what did I do yesterday?"). Resolve relative dates ("today", "tomorrow", "this Friday", "next week") to absolute YYYY-MM-DD using today's date. This only READS and reports back; it never creates or changes anything.

Rules:
- ALWAYS choose a pillar id from the provided pillars list. Never invent ids.
- read_schedule vs plan_week: a QUESTION about what's planned ("what's on…", "show…", "what did I…") is read_schedule; a REQUEST to build a schedule ("plan…", "organize…", "schedule my…") is plan_week.
- For plan_goal, "deadline" must be an absolute YYYY-MM-DD date computed from today (e.g. "2 weeks" = today + 14 days). Prefer a daily cadence; use weekly with specific weekdays only if the user implies rest days (e.g. "weekdays", "mon-sat").
- Nothing you propose is applied automatically; the user reviews and confirms it. So prefer proposing over asking.
- Only call ask_clarifying_question when the command is too ambiguous to map to any tool, and give 2-4 concrete quick-reply options (never free text).
- You must always respond by calling exactly one tool.`

// Gemini uses an OpenAPI-subset schema: UPPERCASE type names, `nullable`
// instead of unions, nullable fields simply left out of `required`.
function functionDeclarations() {
  return [
    {
      name: "ask_clarifying_question",
      description:
        "Ask the user ONE question only when the command is too ambiguous to map to a tool. Provide 2-4 quick-reply options.",
      parameters: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          field: { type: "STRING", enum: ["general"] },
          options: {
            type: "ARRAY",
            description: "2 to 4 quick replies.",
            items: {
              type: "OBJECT",
              properties: { label: { type: "STRING" }, value: { type: "STRING" } },
              required: ["label", "value"],
            },
          },
        },
        required: ["text", "options"],
      },
    },
    {
      name: "breakdown_goal",
      description: "Break a goal into 2-6 concrete unscheduled tasks, each mapped to an existing pillar id.",
      parameters: {
        type: "OBJECT",
        properties: {
          goalText: { type: "STRING", description: "the goal restated in a short phrase" },
          tasks: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                pillarId: { type: "INTEGER", description: "an id from the pillars list" },
                durationMinutes: { type: "INTEGER", nullable: true },
                deadline: { type: "STRING", nullable: true, description: "YYYY-MM-DD, optional" },
              },
              required: ["title", "pillarId"],
            },
          },
        },
        required: ["goalText", "tasks"],
      },
    },
    {
      name: "plan_goal",
      description:
        "Distribute a 'reach QUANTITY by DEADLINE' goal into a repeating task plus a tracked long-term goal. Use for goals like 'do 50 questions in 2 weeks'. Do NOT use breakdown_goal for these.",
      parameters: {
        type: "OBJECT",
        properties: {
          goalTitle: { type: "STRING", description: "short goal name, e.g. 'Do 50 questions'" },
          pillarId: { type: "INTEGER", description: "an id from the pillars list" },
          unit: { type: "STRING", nullable: true, description: "the unit of work, e.g. 'questions', 'pages', 'km'" },
          targetValue: { type: "INTEGER", description: "the total quantity to reach, e.g. 50" },
          deadline: { type: "STRING", description: "absolute YYYY-MM-DD by which the total must be done" },
          frequency: { type: "STRING", enum: ["daily", "weekly"], description: "how often to work toward it" },
          daysOfWeek: {
            type: "ARRAY",
            nullable: true,
            description: "for weekly frequency: integers 0=Sun..6=Sat (e.g. Mon-Sat = [1,2,3,4,5,6])",
            items: { type: "INTEGER" },
          },
          durationMinutes: { type: "INTEGER", nullable: true, description: "rough minutes per session" },
          preferredTimeOfDay: { type: "STRING", nullable: true, enum: ["morning", "afternoon", "evening"] },
        },
        required: ["goalTitle", "pillarId", "targetValue", "deadline", "frequency"],
      },
    },
    {
      name: "create_recurring",
      description: "Propose a recurring task template from a habit description.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          pillarId: { type: "INTEGER", description: "an id from the pillars list" },
          frequency: { type: "STRING", enum: ["daily", "weekly", "custom"] },
          daysOfWeek: {
            type: "ARRAY",
            nullable: true,
            description: "for weekly: integers 0=Sun..6=Sat",
            items: { type: "INTEGER" },
          },
          intervalDays: { type: "INTEGER", nullable: true, description: "for custom: every N days" },
          durationMinutes: { type: "INTEGER", nullable: true },
          preferredTimeOfDay: { type: "STRING", nullable: true, enum: ["morning", "afternoon", "evening"] },
        },
        required: ["title", "pillarId", "frequency"],
      },
    },
    {
      name: "plan_week",
      description: "Run the weekly planner to schedule the user's open tasks. Takes no arguments.",
      parameters: { type: "OBJECT", properties: {} },
    },
    {
      name: "read_schedule",
      description:
        "Read back what is already planned/done for a date or date range, to answer a question like 'what's on Friday?' or 'show my week'. Resolve relative dates to absolute YYYY-MM-DD from today. Reads only — never creates or edits tasks.",
      parameters: {
        type: "OBJECT",
        properties: {
          start: { type: "STRING", description: "start date YYYY-MM-DD (inclusive)" },
          end: { type: "STRING", description: "end date YYYY-MM-DD (inclusive); equal to start for a single day" },
        },
        required: ["start", "end"],
      },
    },
  ]
}

function contextMessage(ctx: AssistantContext): string {
  const pillars = ctx.pillars.map((p) => `${p.id}: ${p.name}`).join(", ")
  const underserved = ctx.effort
    .filter((e) => e.percentOfTarget < 100)
    .map((e) => e.pillarName)
    .join(", ")
  return `Today is ${ctx.today}.
Pillars (id: name): ${pillars || "(none yet)"}.
${underserved ? `Pillars currently under their target effort: ${underserved}.` : ""}`
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown>; id?: string } }
  | { functionResponse: { name: string; id?: string; response: Record<string, unknown> } }
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] }

function findFunctionCall(parts: GeminiPart[] | undefined) {
  return parts?.find(
    (p): p is Extract<GeminiPart, { functionCall: unknown }> =>
      typeof p === "object" && p !== null && "functionCall" in p
  )?.functionCall
}

async function callGemini(apiKey: string, contents: GeminiContent[]): Promise<GeminiContent> {
  const res = await fetch(`${GEMINI_BASE}/${DEFAULT_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ functionDeclarations: functionDeclarations() }],
      toolConfig: { functionCallingConfig: { mode: "ANY" } },
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Gemini API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const data = (await res.json()) as { candidates?: { content?: GeminiContent }[] }
  const content = data.candidates?.[0]?.content
  if (!content) throw new Error("Gemini API: empty response")
  return { role: "model", parts: content.parts ?? [] }
}

/**
 * Runs (or resumes) the agentic loop. `priorMessages` carries the transcript
 * from an earlier turn; on resume the caller appends the user's answer via
 * {@link appendAnswer} before calling. Returns a clarifying question (pause) or
 * a final proposal.
 */
export async function runAssistantAgent(
  ctx: AssistantContext,
  userInput: string,
  priorMessages?: unknown[]
): Promise<AssistantTurn> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return heuristicTurn(ctx, userInput)
  }

  const messages: GeminiContent[] =
    priorMessages && priorMessages.length > 0
      ? (priorMessages as GeminiContent[]).map((m) => m)
      : [{ role: "user", parts: [{ text: `${contextMessage(ctx)}\n\nUser command: ${userInput}` }] }]

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const content = await callGemini(apiKey, messages)
      messages.push(content)

      const fc = findFunctionCall(content.parts)
      if (!fc) {
        return heuristicTurn(ctx, userInput)
      }

      if (fc.name === "ask_clarifying_question") {
        const q = (fc.args ?? {}) as { text?: string; options?: ClarifyOption[] }
        return {
          kind: "question",
          question: {
            text: q.text ?? "Could you clarify what you'd like to do?",
            taskRef: null,
            field: "general",
            options: Array.isArray(q.options) ? q.options : [],
          },
          messages,
        }
      }

      if (fc.name === "read_schedule") {
        const range = normalizeRange(fc.args, ctx.today)
        return { kind: "read_schedule", start: range.start, end: range.end, messages }
      }

      const proposal = proposalFromCall(fc.name, fc.args ?? {}, ctx)
      if (proposal) return { kind: "proposal", proposal, source: "ai", messages }
    }
    return heuristicTurn(ctx, userInput)
  } catch {
    return heuristicTurn(ctx, userInput)
  }
}

/** Validate the model's date range, defaulting to today and ordering start ≤ end. */
function normalizeRange(args: Record<string, unknown> | undefined, today: string): { start: string; end: string } {
  const isISO = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const a = args ?? {}
  const start = isISO(a.start) ? a.start : today
  const end = isISO(a.end) ? a.end : start
  return start <= end ? { start, end } : { start: end, end: start }
}

/**
 * Heuristic routing used whenever the model is unavailable. Detects a read
 * ("what's planned for X?") intent before falling back to a proposal, so the
 * command bar can still answer schedule questions with no API key.
 */
function heuristicTurn(ctx: AssistantContext, userInput: string): AssistantTurn {
  const read = detectReadIntent(ctx, userInput)
  if (read) return { kind: "read_schedule", start: read.start, end: read.end, messages: [] }
  return { kind: "proposal", proposal: heuristicProposal(ctx, userInput), source: "heuristic", messages: [] }
}

function dowOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
/** Monday of the calendar week containing `date`. */
function weekMonday(date: string): string {
  const dow = dowOf(date)
  return shiftToday(date, dow === 0 ? -6 : 1 - dow)
}
/** The next strictly-future Monday after `date`. */
function upcomingMonday(date: string): string {
  const dow = dowOf(date)
  return shiftToday(date, ((8 - dow) % 7) || 7)
}
/** The next occurrence of weekday `target` (0=Sun..6=Sat), or `date` itself if it matches. */
function nextWeekday(date: string, target: number): string {
  return shiftToday(date, (((target - dowOf(date)) % 7) + 7) % 7)
}

/** Map a read-style command to a date range, or null if it isn't a read query. */
function detectReadIntent(ctx: AssistantContext, input: string): { start: string; end: string } | null {
  const lower = input.toLowerCase()
  // Require clear "reading" phrasing so build/plan commands fall through to proposals.
  if (!/\b(what'?s|what is|what was|what did|whats|show|view|list|see|do i have|did i)\b/.test(lower)) return null

  const today = ctx.today
  if (/\btomorrow\b/.test(lower)) { const d = shiftToday(today, 1); return { start: d, end: d } }
  if (/\byesterday\b/.test(lower)) { const d = shiftToday(today, -1); return { start: d, end: d } }
  if (/\bnext week\b/.test(lower)) { const m = upcomingMonday(today); return { start: m, end: shiftToday(m, 6) } }
  if (/\b(this week|my week|the week|week)\b/.test(lower)) { const m = weekMonday(today); return { start: m, end: shiftToday(m, 6) } }
  for (const [token, dow] of Object.entries(WEEKDAY_TOKENS)) {
    if (new RegExp(`\\b${token}\\b`).test(lower)) { const d = nextWeekday(today, dow); return { start: d, end: d } }
  }
  if (/\btoday\b/.test(lower)) return { start: today, end: today }
  // A generic "what's planned/scheduled?" with no date defaults to today.
  if (/\b(planned|schedule|scheduled|plan|targets?|tasks?)\b/.test(lower)) return { start: today, end: today }
  return null
}

/** Validate + normalize a model tool call into a proposal we trust. */
function proposalFromCall(name: string, args: Record<string, unknown>, ctx: AssistantContext): AssistantProposal | null {
  const validPillar = new Set(ctx.pillars.map((p) => p.id))
  const coercePillar = (v: unknown): number | null => (typeof v === "number" && validPillar.has(v) ? v : null)

  if (name === "plan_week") return { kind: "plan_week" }

  if (name === "plan_goal") {
    const goalTitle = typeof args.goalTitle === "string" ? args.goalTitle.trim() : ""
    const targetValue = typeof args.targetValue === "number" ? Math.round(args.targetValue) : 0
    const deadline = typeof args.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.deadline) ? args.deadline : null
    if (!goalTitle || targetValue <= 0 || !deadline || deadline <= ctx.today) return null

    const frequency: "daily" | "weekly" = args.frequency === "weekly" ? "weekly" : "daily"
    let daysOfWeek = Array.isArray(args.daysOfWeek)
      ? Array.from(new Set((args.daysOfWeek as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))).sort()
      : []
    if (frequency === "weekly" && daysOfWeek.length === 0) daysOfWeek = [1, 2, 3, 4, 5, 6] // sensible default: Mon-Sat
    const tod = args.preferredTimeOfDay

    const occurrences = countOccurrences(ctx.today, deadline, frequency, daysOfWeek)
    const perSession = Math.max(1, Math.ceil(targetValue / Math.max(1, occurrences)))

    return {
      kind: "goal_plan",
      goalTitle,
      pillarId: coercePillar(args.pillarId) ?? ctx.pillars[0]?.id ?? null,
      unit: typeof args.unit === "string" && args.unit.trim() ? args.unit.trim() : "",
      targetValue,
      deadline,
      frequency,
      daysOfWeek: frequency === "weekly" ? daysOfWeek : [],
      perSession,
      occurrences,
      durationMinutes: clampDuration(args.durationMinutes),
      preferredTimeOfDay: tod === "morning" || tod === "afternoon" || tod === "evening" ? tod : null,
    }
  }

  if (name === "breakdown_goal") {
    const raw = Array.isArray(args.tasks) ? (args.tasks as Record<string, unknown>[]) : []
    const tasks: BreakdownTask[] = raw
      .filter((t) => typeof t.title === "string" && t.title.trim())
      .slice(0, 6)
      .map((t) => ({
        title: String(t.title).trim(),
        pillarId: coercePillar(t.pillarId) ?? ctx.pillars[0]?.id ?? null,
        durationMinutes: clampDuration(t.durationMinutes),
        deadline: typeof t.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.deadline) ? t.deadline : null,
      }))
    if (tasks.length === 0) return null
    return { kind: "breakdown", goalText: typeof args.goalText === "string" ? args.goalText : "", tasks }
  }

  if (name === "create_recurring") {
    const title = typeof args.title === "string" ? args.title.trim() : ""
    if (!title) return null
    const frequency: RecurringFrequency =
      args.frequency === "weekly" || args.frequency === "custom" ? args.frequency : "daily"
    const daysOfWeek = Array.isArray(args.daysOfWeek)
      ? (args.daysOfWeek as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      : []
    const tod = args.preferredTimeOfDay
    return {
      kind: "recurring",
      title,
      pillarId: coercePillar(args.pillarId) ?? ctx.pillars[0]?.id ?? null,
      frequency,
      daysOfWeek,
      intervalDays:
        frequency === "custom" && typeof args.intervalDays === "number" ? Math.max(2, Math.round(args.intervalDays)) : null,
      durationMinutes: clampDuration(args.durationMinutes),
      preferredTimeOfDay: tod === "morning" || tod === "afternoon" || tod === "evening" ? tod : null,
    }
  }
  return null
}

function clampDuration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(5, Math.min(480, Math.round(value)))
}

/**
 * Counts how many times a cadence fires from `today` through `deadline`
 * (inclusive) — i.e. how many work sessions are available to hit the total.
 * Daily counts every day; weekly counts only the listed weekdays. Capped at a
 * year of iterations so a far-off deadline can't spin.
 */
/** Returns `today` shifted forward by `deltaDays`, as YYYY-MM-DD (UTC). */
function shiftToday(today: string, deltaDays: number): string {
  const [y, m, d] = today.split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + deltaDays * 864e5)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`
}

function countOccurrences(today: string, deadline: string, frequency: "daily" | "weekly", daysOfWeek: number[]): number {
  const [ty, tm, td] = today.split("-").map(Number)
  const [dy, dm, dd] = deadline.split("-").map(Number)
  let cursor = Date.UTC(ty, tm - 1, td)
  const end = Date.UTC(dy, dm - 1, dd)
  const days = new Set(daysOfWeek)
  let count = 0
  for (let i = 0; cursor <= end && i <= 366; i++, cursor += 864e5) {
    if (frequency === "daily" || days.has(new Date(cursor).getUTCDay())) count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Heuristic fallback — mirrors the model's routing deterministically so the
// command bar still works with no API key.
// ---------------------------------------------------------------------------

const WEEKDAY_TOKENS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

/** Best-effort pillar match: pick the pillar whose name appears in the text. */
function matchPillar(text: string, pillars: AssistantPillar[]): number | null {
  const lower = text.toLowerCase()
  for (const p of pillars) {
    if (p.name && lower.includes(p.name.toLowerCase())) return p.id
  }
  return pillars[0]?.id ?? null
}

export function heuristicProposal(ctx: AssistantContext, input: string): AssistantProposal {
  const text = input.trim()
  const lower = text.toLowerCase()

  // plan_week intent
  if (/\b(plan|organi[sz]e|schedule|sort out)\b/.test(lower) && /\b(week|day|schedule)\b/.test(lower)) {
    return { kind: "plan_week" }
  }

  // recurring intent: explicit cadence words or weekday tokens present
  const tokens = lower.split(/[^a-z]+/).filter(Boolean)
  const days = Array.from(new Set(tokens.map((t) => WEEKDAY_TOKENS[t]).filter((n): n is number => n !== undefined)))
  const everyN = lower.match(/every\s+(\d+)\s+day/)
  const isDaily = /\b(daily|every\s*day|each\s*day)\b/.test(lower)
  const isWeekly = days.length > 0 || /\b(weekly|every\s*week)\b/.test(lower)

  if (isDaily || isWeekly || everyN) {
    // Strip the cadence portion to get a clean title.
    const title =
      text
        .replace(/\b(every|each)\b.*$/i, "")
        .replace(/\b(daily|weekly)\b/gi, "")
        .replace(/\b(on\s+)?(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[a-z]*\b/gi, "")
        .replace(/[\/,]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim() || text
    const frequency: RecurringFrequency = everyN ? "custom" : isWeekly && !isDaily ? "weekly" : "daily"
    return {
      kind: "recurring",
      title,
      pillarId: matchPillar(text, ctx.pillars),
      frequency,
      daysOfWeek: frequency === "weekly" ? days : [],
      intervalDays: everyN ? Math.max(2, parseInt(everyN[1], 10)) : null,
      durationMinutes: null,
      preferredTimeOfDay: /\bmorning\b/.test(lower)
        ? "morning"
        : /\bafternoon\b/.test(lower)
          ? "afternoon"
          : /\b(evening|night)\b/.test(lower)
            ? "evening"
            : null,
    }
  }

  // Quantity-by-deadline goal: "<total> ... in <n> <period>". Distribute it into
  // a daily goal plan rather than a single restated to-do.
  const periodDays: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 }
  const goalMatch = lower.match(/\b(\d+)\b.*?\b(?:in|within|over)\s+(?:(\d+)\s+|an?\s+|the\s+)?(day|week|month|year)s?\b/)
  if (goalMatch) {
    const targetValue = parseInt(goalMatch[1], 10)
    const periods = goalMatch[2] ? Math.max(1, parseInt(goalMatch[2], 10)) : 1
    const spanDays = periods * (periodDays[goalMatch[3]] ?? 7)
    if (Number.isFinite(targetValue) && targetValue > 0 && spanDays > 0) {
      const deadline = shiftToday(ctx.today, spanDays)
      const occurrences = countOccurrences(ctx.today, deadline, "daily", [])
      return {
        kind: "goal_plan",
        goalTitle: text,
        pillarId: matchPillar(text, ctx.pillars),
        unit: "",
        targetValue,
        deadline,
        frequency: "daily",
        daysOfWeek: [],
        perSession: Math.max(1, Math.ceil(targetValue / Math.max(1, occurrences))),
        occurrences,
        durationMinutes: null,
        preferredTimeOfDay: null,
      }
    }
  }

  // Otherwise treat it as a goal to break down. Split on obvious separators,
  // else propose a single task for the whole goal.
  const pillarId = matchPillar(text, ctx.pillars)
  const parts = text
    .split(/,| and | then |;/i)
    .map((s) => s.replace(/^(learn|finish|complete|do|study)\s+/i, "").trim())
    .filter(Boolean)
  const titles = parts.length > 1 ? parts.slice(0, 6) : [text]
  return {
    kind: "breakdown",
    goalText: text,
    tasks: titles.map((title) => ({ title, pillarId, durationMinutes: null, deadline: null })),
  }
}
