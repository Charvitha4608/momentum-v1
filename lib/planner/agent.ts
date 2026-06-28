// The "judgment" half of the hybrid planner.
//
// The model is given the user's candidate work plus balance signals (pillar
// desired-vs-actual effort, neglected pillars) and learned preferences, and
// returns *decisions*: for each task a day, a time-of-day, a priority, and a
// one-line reason — OR a single clarifying question when a task's duration or
// deadline is missing/ambiguous. An agentic tool-use loop lets the model
// itself choose between asking and planning. The deterministic packer
// (lib/planner/schedule.ts) then turns those decisions into concrete times.
//
// This uses Google's Gemini API (free tier friendly). If GEMINI_API_KEY is
// absent the same shape is produced by a transparent heuristic so the feature
// degrades gracefully instead of erroring out.

import type { TimeOfDay } from "@/lib/planner/schedule"

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
const MAX_TURNS = 4

export type CandidateTask = {
  ref: string // stable id: "t<targetId>" for existing targets
  title: string
  pillarId: number | null
  pillarName: string
  durationMinutes: number | null
  preferredTimeOfDay: TimeOfDay | null
  deadline: string | null
  isRecurring: boolean
  isBacklog: boolean
  // How many days this task is overdue (positive = past due, 0 = due today, negative = future).
  // Used by the model to distinguish a 3-week-old backlog item from one added yesterday.
  daysOverdue: number
}

export type EffortSignal = {
  pillarName: string
  desiredPercent: number
  actualPercent: number
  percentOfTarget: number
}

export type PlanningContext = {
  scope: "day" | "week"
  days: { date: string; weekday: string; availableHours: number }[]
  candidates: CandidateTask[]
  effort: EffortSignal[]
  neglected: { pillarName: string; daysSinceLastActivity: number }[]
  preferenceNotes: string[] // distilled from accept/edit/reject history
}

export type PlanDecision = {
  ref: string | null // matches a candidate ref, or null for a model-added suggestion
  title: string
  pillarId: number | null
  date: string
  timeOfDay: TimeOfDay
  durationMinutes: number
  priority: number
  reasoning: string
}

export type ClarifyOption = { label: string; value: string }
export type ClarifyingQuestion = {
  text: string
  taskRef: string | null
  field: "duration" | "deadline" | "general"
  options: ClarifyOption[]
}

export type AgentTurn =
  | { kind: "question"; question: ClarifyingQuestion; messages: unknown[] }
  | { kind: "plan"; plan: PlanDecision[]; source: "ai" | "heuristic"; messages: unknown[] }

const SYSTEM_PROMPT = `You are the planning brain inside Momentum, a personal-growth app where users invest effort into "pillars" (life areas like DSA, Gym, Reading).

Your job: turn a user's candidate tasks into a balanced schedule for the requested day or week. You handle PRIORITIZATION and BALANCE; a deterministic packer will place concrete clock times afterwards, so you only choose each task's day, time-of-day band, duration, priority, and a short reason.

Principles:
- Respect deadlines: schedule a task on or before its deadline; urgent deadlines get higher priority.
- Use the balance signals: lift priority for neglected pillars and pillars under their desired effort; ease off pillars already over target.
- Honour the user's learned preferences when present.
- Keep daily load realistic against the available hours for each day.
- Spread recurring work sensibly; don't stack everything on one day in week scope.

When a task is missing a duration or a deadline and it materially affects the plan, ask ONE clarifying question via the ask_clarifying_question tool, with 2-4 concrete quick-reply options (never free text). Otherwise call submit_plan directly. Prefer planning over asking when you can make a reasonable assumption. You must always respond by calling exactly one of the two tools.`

// Gemini uses an OpenAPI-subset schema with UPPERCASE type names and
// `nullable` instead of union types. Nullable fields are simply left out of
// `required`.
function functionDeclarations() {
  return [
    {
      name: "ask_clarifying_question",
      description:
        "Ask the user ONE question when a task's duration or deadline is missing/ambiguous and it blocks a good plan. Provide 2-4 quick-reply options.",
      parameters: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING", description: "The question, e.g. 'How many days do you want to finish DSA revision?'" },
          taskRef: { type: "STRING", nullable: true, description: "ref of the task this is about, or omit" },
          field: { type: "STRING", enum: ["duration", "deadline", "general"] },
          options: {
            type: "ARRAY",
            description:
              "2 to 4 quick replies. For field=duration, each value is minutes as a string (e.g. '30','60'). For field=deadline, each value is a whole number of days from today as a string (e.g. '1','3','7').",
            items: {
              type: "OBJECT",
              properties: {
                label: { type: "STRING" },
                value: { type: "STRING" },
              },
              required: ["label", "value"],
            },
          },
        },
        required: ["text", "field", "options"],
      },
    },
    {
      name: "submit_plan",
      description: "Submit the final prioritized schedule once you have enough information.",
      parameters: {
        type: "OBJECT",
        properties: {
          plan: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                ref: { type: "STRING", nullable: true, description: "candidate ref, or omit for a new suggestion" },
                title: { type: "STRING" },
                pillarId: { type: "INTEGER", nullable: true },
                date: { type: "STRING", description: "YYYY-MM-DD, must be one of the provided days" },
                timeOfDay: { type: "STRING", enum: ["morning", "afternoon", "evening", "any"] },
                durationMinutes: { type: "INTEGER" },
                priority: { type: "INTEGER", description: "1-10, higher = scheduled first" },
                reasoning: { type: "STRING", description: "one short sentence on why here" },
              },
              required: ["title", "date", "timeOfDay", "durationMinutes", "priority", "reasoning"],
            },
          },
        },
        required: ["plan"],
      },
    },
  ]
}

function contextMessage(ctx: PlanningContext): string {
  return JSON.stringify(ctx, null, 2)
}

// A Gemini Part can carry text or a function call/response.
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
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
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
  // Ensure a well-formed content object for the transcript.
  return { role: "model", parts: content.parts ?? [] }
}

/**
 * Runs (or resumes) the agentic loop. `priorMessages` carries the transcript
 * from an earlier turn; on resume the caller appends the user's answer to it
 * (via {@link appendAnswer}) before calling. Returns a question (pause) or a
 * final plan.
 */
export async function runPlannerAgent(ctx: PlanningContext, priorMessages?: unknown[]): Promise<AgentTurn> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { kind: "plan", plan: heuristicPlan(ctx), source: "heuristic", messages: [] }
  }

  const messages: GeminiContent[] =
    priorMessages && priorMessages.length > 0
      ? (priorMessages as GeminiContent[]).map((m) => m)
      : [{ role: "user", parts: [{ text: `Plan my ${ctx.scope}. Here is the context:\n\n${contextMessage(ctx)}` }] }]

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const content = await callGemini(apiKey, messages)
      messages.push(content)

      const fc = findFunctionCall(content.parts)
      if (!fc) {
        // Model answered with text only — treat as "no plan", fall back.
        return { kind: "plan", plan: heuristicPlan(ctx), source: "heuristic", messages }
      }

      if (fc.name === "ask_clarifying_question") {
        const q = (fc.args ?? {}) as unknown as ClarifyingQuestion
        return {
          kind: "question",
          question: {
            text: q.text,
            taskRef: q.taskRef ?? null,
            field: q.field ?? "general",
            options: Array.isArray(q.options) ? q.options : [],
          },
          messages,
        }
      }

      if (fc.name === "submit_plan") {
        const raw = (fc.args as { plan?: unknown[] })?.plan ?? []
        const plan = normalizePlan(raw, ctx)
        return { kind: "plan", plan, source: "ai", messages }
      }
    }
    // Exhausted turns without a plan — fall back.
    return { kind: "plan", plan: heuristicPlan(ctx), source: "heuristic", messages }
  } catch {
    // Network/credential/parse failure — never block the user.
    return { kind: "plan", plan: heuristicPlan(ctx), source: "heuristic", messages: [] }
  }
}

/**
 * Appends the user's answer to a clarifying question to the transcript as a
 * Gemini functionResponse, matched to the last ask_clarifying_question call.
 * Owns the message format so callers stay provider-agnostic.
 */
export function appendAnswer(priorMessages: unknown[], answer: string): unknown[] {
  const messages = [...(priorMessages as GeminiContent[])]
  // Find the most recent model functionCall to mirror its name/id.
  let name = "ask_clarifying_question"
  let id: string | undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    const fc = findFunctionCall(messages[i]?.parts)
    if (fc) {
      name = fc.name
      id = fc.id
      break
    }
  }
  const response: { functionResponse: { name: string; id?: string; response: Record<string, unknown> } } = {
    functionResponse: { name, response: { answer } },
  }
  if (id) response.functionResponse.id = id
  messages.push({ role: "user", parts: [response] })
  return messages
}

function normalizePlan(raw: unknown[], ctx: PlanningContext): PlanDecision[] {
  const validDays = new Set(ctx.days.map((d) => d.date))
  const fallbackDay = ctx.days[0]?.date
  const byRef = new Map(ctx.candidates.map((c) => [c.ref, c]))
  const tods: TimeOfDay[] = ["morning", "afternoon", "evening", "any"]

  return (raw as Record<string, unknown>[]).map((r) => {
    const ref = typeof r.ref === "string" ? r.ref : null
    const cand = ref ? byRef.get(ref) : undefined
    const date = typeof r.date === "string" && validDays.has(r.date) ? r.date : fallbackDay
    const tod = tods.includes(r.timeOfDay as TimeOfDay) ? (r.timeOfDay as TimeOfDay) : "any"
    return {
      ref,
      title: typeof r.title === "string" && r.title ? r.title : cand?.title ?? "Untitled",
      pillarId: typeof r.pillarId === "number" ? r.pillarId : cand?.pillarId ?? null,
      date,
      timeOfDay: tod,
      durationMinutes: clampDuration(r.durationMinutes, cand?.durationMinutes),
      priority: typeof r.priority === "number" ? r.priority : 5,
      reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
    }
  })
}

function clampDuration(value: unknown, fallback?: number | null): number {
  const n = typeof value === "number" ? value : fallback ?? 30
  return Math.max(5, Math.min(480, Math.round(n)))
}

// ---------------------------------------------------------------------------
// Heuristic fallback — mirrors the model's job deterministically.
// ---------------------------------------------------------------------------

/**
 * Priority score combines deadline urgency, pillar under-investment, and
 * neglect so the fallback produces a balance-aware plan without the API.
 */
export function heuristicPlan(ctx: PlanningContext): PlanDecision[] {
  const effortByPillar = new Map(ctx.effort.map((e) => [e.pillarName, e]))
  const neglectByPillar = new Map(ctx.neglected.map((n) => [n.pillarName, n.daysSinceLastActivity]))
  const days = ctx.days.length > 0 ? ctx.days : [{ date: "", weekday: "", availableHours: 3 }]

  // Round-robin day assignment respecting per-day hour budgets.
  const dayLoad = new Map(days.map((d) => [d.date, 0]))

  const scored = ctx.candidates.map((c) => {
    let priority = 5
    if (c.deadline) priority += 3
    if (c.isBacklog) priority += 2
    // Boost overdue items proportionally — 7+ days overdue maxes out the boost.
    if (c.daysOverdue > 0) priority += Math.min(3, Math.floor(c.daysOverdue / 2))
    const eff = c.pillarName ? effortByPillar.get(c.pillarName) : undefined
    if (eff && eff.percentOfTarget < 100) priority += 2
    if (eff && eff.percentOfTarget > 130) priority -= 2
    const neglect = c.pillarName ? neglectByPillar.get(c.pillarName) : undefined
    if (neglect) priority += Math.min(3, Math.floor(neglect / 3))
    return { c, priority: Math.max(1, Math.min(10, priority)) }
  })

  scored.sort((a, b) => b.priority - a.priority)

  return scored.map(({ c, priority }) => {
    const dur = c.durationMinutes ?? 45
    // Place on the earliest day that still has budget and is on/before deadline.
    let chosen = days[0].date
    for (const d of days) {
      if (c.deadline && d.date > c.deadline) continue
      const load = dayLoad.get(d.date) ?? 0
      if (load + dur <= d.availableHours * 60) {
        chosen = d.date
        break
      }
      chosen = d.date
    }
    dayLoad.set(chosen, (dayLoad.get(chosen) ?? 0) + dur)

    const eff = c.pillarName ? effortByPillar.get(c.pillarName) : undefined
    const neglect = c.pillarName ? neglectByPillar.get(c.pillarName) : undefined
    const reasons: string[] = []
    if (c.deadline) reasons.push(`deadline ${c.deadline}`)
    if (c.daysOverdue > 0) reasons.push(`${c.daysOverdue}d overdue`)
    if (neglect) reasons.push(`${c.pillarName} neglected ${neglect}d`)
    else if (eff && eff.percentOfTarget < 100) reasons.push(`${c.pillarName} under target`)
    if (c.isBacklog) reasons.push("carried over")
    const reasoning = reasons.length ? `Prioritized: ${reasons.join(", ")}.` : `Balanced ${c.pillarName} effort.`

    return {
      ref: c.ref,
      title: c.title,
      pillarId: c.pillarId,
      date: chosen,
      timeOfDay: c.preferredTimeOfDay ?? "any",
      durationMinutes: dur,
      priority,
      reasoning,
    }
  })
}
