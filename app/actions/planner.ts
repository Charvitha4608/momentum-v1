"use server"

import { and, desc, eq, inArray, lt, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { aiPlanningSession, aiSchedule, aiScheduleFeedback, pillars, targets } from "@/lib/db/schema"
import { getToday, shiftDateString } from "@/lib/date"
import { getEffortComparison } from "@/app/actions/reflection"
import { getHoursForDate, getAvailability } from "@/app/actions/availability"
import {
  runPlannerAgent,
  appendAnswer,
  type AgentTurn,
  type CandidateTask,
  type ClarifyingQuestion,
  type PlanningContext,
  type PlanDecision,
} from "@/lib/planner/agent"
import { packDay, type PackInput, type TimeOfDay } from "@/lib/planner/schedule"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function weekdayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** The list of dates the plan spans: just [date] for 'day', Mon-Sun for 'week'. */
function scopeDays(scope: "day" | "week", anchor: string): string[] {
  if (scope === "day") return [anchor]
  const [y, m, d] = anchor.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = shiftDateString(anchor, mondayOffset)
  return Array.from({ length: 7 }, (_, i) => shiftDateString(monday, i))
}

// ---------------------------------------------------------------------------
// Context assembly
// ---------------------------------------------------------------------------

async function readNeglectedPillars(userId: string, today: string) {
  // Read-only neglect calc (no notification side effects, unlike the
  // Reflection action) so planning never spams the notifications feed.
  const active = await db
    .select({ id: pillars.id, name: pillars.name, createdAt: pillars.createdAt })
    .from(pillars)
    .where(and(eq(pillars.userId, userId), eq(pillars.archived, false)))
  if (active.length === 0) return []

  const last = await db
    .select({ pillarId: targets.pillarId, lastDate: sql<string>`max(${targets.originalDate})` })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.completed, true)))
    .groupBy(targets.pillarId)
  const lastMap = new Map(last.map((r) => [r.pillarId, r.lastDate]))

  const out: { pillarName: string; daysSinceLastActivity: number }[] = []
  for (const p of active) {
    const lastDate = lastMap.get(p.id) ?? p.createdAt.toISOString().slice(0, 10)
    const [ly, lm, ld] = lastDate.split("-").map(Number)
    const [ty, tm, td] = today.split("-").map(Number)
    const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(ly, lm - 1, ld)) / 864e5)
    if (days >= 5) out.push({ pillarName: p.name, daysSinceLastActivity: days })
  }
  return out
}

/** Distil accept/edit/reject history into short notes for the planning prompt. */
async function derivePreferenceNotes(userId: string): Promise<string[]> {
  const rows = await db
    .select({
      action: aiScheduleFeedback.action,
      pillarId: aiScheduleFeedback.pillarId,
      toTimeOfDay: aiScheduleFeedback.toTimeOfDay,
      fromTimeOfDay: aiScheduleFeedback.fromTimeOfDay,
    })
    .from(aiScheduleFeedback)
    .where(eq(aiScheduleFeedback.userId, userId))
    .orderBy(desc(aiScheduleFeedback.createdAt))
    .limit(80)
  if (rows.length === 0) return []

  const pillarRows = await db.select({ id: pillars.id, name: pillars.name }).from(pillars).where(eq(pillars.userId, userId))
  const pillarName = new Map(pillarRows.map((p) => [p.id, p.name]))

  // Count time-of-day moves per pillar from edits.
  const moves = new Map<string, number>() // "pillar|tod" -> count
  const rejects = new Map<number, number>()
  for (const r of rows) {
    if (r.action === "edit" && r.pillarId != null && r.toTimeOfDay && r.toTimeOfDay !== r.fromTimeOfDay) {
      const key = `${r.pillarId}|${r.toTimeOfDay}`
      moves.set(key, (moves.get(key) ?? 0) + 1)
    }
    if (r.action === "reject" && r.pillarId != null) rejects.set(r.pillarId, (rejects.get(r.pillarId) ?? 0) + 1)
  }

  const notes: string[] = []
  for (const [key, count] of moves) {
    if (count < 2) continue
    const [pid, tod] = key.split("|")
    const name = pillarName.get(Number(pid)) ?? "that pillar"
    notes.push(`User usually moves ${name} to ${tod}.`)
  }
  for (const [pid, count] of rejects) {
    if (count < 2) continue
    notes.push(`User has rejected several ${pillarName.get(pid) ?? "pillar"} suggestions recently — be conservative scheduling it.`)
  }
  return notes.slice(0, 6)
}

async function buildContext(userId: string, scope: "day" | "week", anchor: string): Promise<PlanningContext> {
  const today = await getToday()
  const days = scopeDays(scope, anchor)
  const lastDay = days[days.length - 1]

  // Candidate work = incomplete targets that are live within the scope window,
  // i.e. carried-over backlog (date < today) plus anything dated up to the
  // last scoped day. Carry-over has already re-dated backlog to today.
  const candidateRows = await db
    .select({
      id: targets.id,
      title: targets.title,
      completed: targets.completed,
      date: targets.date,
      originalDate: targets.originalDate,
      pillarId: targets.pillarId,
      pillarName: pillars.name,
      durationMinutes: targets.durationMinutes,
      preferredTimeOfDay: targets.preferredTimeOfDay,
      deadline: targets.deadline,
      recurringTaskId: targets.recurringTaskId,
    })
    .from(targets)
    .innerJoin(pillars, eq(targets.pillarId, pillars.id))
    .where(and(eq(targets.userId, userId), eq(targets.completed, false), sql`${targets.date} <= ${lastDay}`))
    .orderBy(targets.sortOrder, targets.id)

  const candidates: CandidateTask[] = candidateRows.map((r) => ({
    ref: `t${r.id}`,
    title: r.title,
    pillarId: r.pillarId,
    pillarName: r.pillarName,
    durationMinutes: r.durationMinutes,
    preferredTimeOfDay: (r.preferredTimeOfDay as TimeOfDay | null) ?? null,
    deadline: r.deadline,
    isRecurring: r.recurringTaskId != null,
    isBacklog: r.originalDate < today,
    daysOverdue: (() => {
      const [oy, om, od] = r.originalDate.split("-").map(Number)
      const [ty, tm, td] = today.split("-").map(Number)
      return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(oy, om - 1, od)) / 864e5)
    })(),
  }))

  const [effortRows, neglected, preferenceNotes, dayHours] = await Promise.all([
    getEffortComparison(),
    readNeglectedPillars(userId, today),
    derivePreferenceNotes(userId),
    Promise.all(days.map(async (date) => ({ date, weekday: weekdayName(date), availableHours: await getHoursForDate(date) }))),
  ])

  return {
    scope,
    days: dayHours,
    candidates,
    effort: effortRows.map((e) => ({
      pillarName: e.pillarName,
      desiredPercent: e.desiredPercent,
      actualPercent: e.actualPercent,
      percentOfTarget: e.percentOfTarget,
    })),
    neglected,
    preferenceNotes,
  }
}

// ---------------------------------------------------------------------------
// Persisting the agent result
// ---------------------------------------------------------------------------

/** Deterministic packer turns priority/day/time-of-day decisions into times, per day. */
function packPlan(plan: PlanDecision[], ctx: PlanningContext, defaults: { dayStartHour: number; dayEndHour: number }) {
  const byDate = new Map<string, PlanDecision[]>()
  for (const p of plan) {
    if (!byDate.has(p.date)) byDate.set(p.date, [])
    byDate.get(p.date)!.push(p)
  }
  const hoursByDate = new Map(ctx.days.map((d) => [d.date, d.availableHours]))

  const result: (PlanDecision & { startTime: string | null; endTime: string | null; fit: boolean })[] = []
  for (const [date, items] of byDate) {
    const packInputs: PackInput[] = items.map((p, i) => ({
      id: String(i),
      title: p.title,
      durationMinutes: p.durationMinutes,
      timeOfDay: p.timeOfDay,
      priority: p.priority,
    }))
    const packed = packDay(packInputs, {
      availableHours: hoursByDate.get(date) ?? 3,
      dayStartHour: defaults.dayStartHour,
      dayEndHour: defaults.dayEndHour,
    })
    const packedById = new Map(packed.map((p) => [p.id, p]))
    items.forEach((p, i) => {
      const pk = packedById.get(String(i))
      result.push({
        ...p,
        startTime: pk?.scheduled ? pk.startTime : null,
        endTime: pk?.scheduled ? pk.endTime : null,
        fit: pk?.scheduled ?? false,
      })
    })
  }
  return result
}

async function persistPlan(userId: string, sessionId: number, plan: PlanDecision[], ctx: PlanningContext, source: string) {
  const defaults = await getAvailability()
  const packed = packPlan(plan, ctx, defaults)
  const days = ctx.days.map((d) => d.date)

  // Replace any prior *unaccepted* proposals for these days so re-planning is idempotent.
  if (days.length > 0) {
    await db
      .delete(aiSchedule)
      .where(and(eq(aiSchedule.userId, userId), inArray(aiSchedule.date, days), eq(aiSchedule.status, "proposed")))
  }

  for (const item of packed) {
    const targetId = item.ref?.startsWith("t") ? Number(item.ref.slice(1)) : null
    await db.insert(aiSchedule).values({
      userId,
      sessionId,
      targetId: Number.isFinite(targetId) ? targetId : null,
      pillarId: item.pillarId,
      title: item.title,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      durationMinutes: item.durationMinutes,
      timeOfDay: item.timeOfDay,
      reasoning: item.fit ? item.reasoning : `${item.reasoning} (over the day's available hours — reduce load or add time)`.trim(),
      priority: item.priority,
      status: "proposed",
      aiGenerated: source !== "heuristic",
    })
  }
  revalidatePath("/calendar")
  revalidatePath("/")
}

export type PlannerResult =
  | { kind: "question"; sessionId: number; question: ClarifyingQuestion; source: "ai" }
  | { kind: "plan"; sessionId: number; source: "ai" | "heuristic"; count: number }

async function finishTurn(userId: string, scope: "day" | "week", anchor: string, sessionId: number, ctx: PlanningContext, turn: AgentTurn): Promise<PlannerResult> {
  if (turn.kind === "question") {
    await db
      .update(aiPlanningSession)
      .set({
        status: "awaiting_user",
        messages: JSON.stringify(turn.messages),
        pendingQuestion: JSON.stringify(turn.question),
        updatedAt: new Date(),
      })
      .where(eq(aiPlanningSession.id, sessionId))
    return { kind: "question", sessionId, question: turn.question, source: "ai" }
  }

  await persistPlan(userId, sessionId, turn.plan, ctx, turn.source)
  await db
    .update(aiPlanningSession)
    .set({ status: "complete", messages: JSON.stringify(turn.messages ?? []), pendingQuestion: null, updatedAt: new Date() })
    .where(eq(aiPlanningSession.id, sessionId))
  return { kind: "plan", sessionId, source: turn.source, count: turn.plan.length }
}

/** Kick off a planning run for the day or week containing `anchorDate`. */
export async function startPlanning(scope: "day" | "week", anchorDate?: string): Promise<PlannerResult> {
  const userId = await getUserId()
  const anchor = anchorDate ?? (await getToday())

  // Abandon any stale awaiting sessions for the same scope.
  await db
    .update(aiPlanningSession)
    .set({ status: "abandoned" })
    .where(and(eq(aiPlanningSession.userId, userId), eq(aiPlanningSession.status, "awaiting_user")))

  const [session] = await db
    .insert(aiPlanningSession)
    .values({ userId, scope, anchorDate: anchor, status: "awaiting_user" })
    .returning()

  const ctx = await buildContext(userId, scope, anchor)
  if (ctx.candidates.length === 0) {
    await db.update(aiPlanningSession).set({ status: "complete" }).where(eq(aiPlanningSession.id, session.id))
    return { kind: "plan", sessionId: session.id, source: "heuristic", count: 0 }
  }

  const turn = await runPlannerAgent(ctx)
  return finishTurn(userId, scope, anchor, session.id, ctx, turn)
}

/** Continue a paused run with the user's quick-reply answer. */
export async function answerPlanningQuestion(sessionId: number, value: string, label: string): Promise<PlannerResult> {
  const userId = await getUserId()
  const [session] = await db
    .select()
    .from(aiPlanningSession)
    .where(and(eq(aiPlanningSession.id, sessionId), eq(aiPlanningSession.userId, userId)))
  if (!session) throw new Error("Planning session not found")

  const question: ClarifyingQuestion | null = session.pendingQuestion ? JSON.parse(session.pendingQuestion) : null
  const priorMessages: unknown[] = JSON.parse(session.messages || "[]")

  // Best-effort: persist the answer onto the referenced target so future plans
  // don't ask again (duration in minutes, deadline as N days from today).
  if (question?.taskRef?.startsWith("t")) {
    const targetId = Number(question.taskRef.slice(1))
    if (Number.isFinite(targetId)) {
      try {
        if (question.field === "duration") {
          const mins = parseInt(value, 10)
          if (Number.isFinite(mins)) await db.update(targets).set({ durationMinutes: mins }).where(and(eq(targets.id, targetId), eq(targets.userId, userId)))
        } else if (question.field === "deadline") {
          const today = await getToday()
          const deadline = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : Number.isFinite(parseInt(value, 10)) ? shiftDateString(today, parseInt(value, 10)) : null
          if (deadline) await db.update(targets).set({ deadline }).where(and(eq(targets.id, targetId), eq(targets.userId, userId)))
        }
      } catch {
        /* non-fatal */
      }
    }
  }

  // Append the user's answer to the transcript (format owned by the agent).
  const resumedMessages = appendAnswer(priorMessages, `${label} (${value})`)

  const ctx = await buildContext(userId, session.scope as "day" | "week", session.anchorDate)
  const turn = await runPlannerAgent(ctx, resumedMessages)
  return finishTurn(userId, session.scope as "day" | "week", session.anchorDate, session.id, ctx, turn)
}

// ---------------------------------------------------------------------------
// Reading proposed schedules
// ---------------------------------------------------------------------------

export type ScheduleItem = {
  id: number
  targetId: number | null
  pillarId: number | null
  pillarName: string | null
  pillarIcon: string | null
  pillarColor: string | null
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  durationMinutes: number
  timeOfDay: string | null
  reasoning: string | null
  priority: number
  status: string
  aiGenerated: boolean
}

async function readSchedule(userId: string, dates: string[]): Promise<ScheduleItem[]> {
  if (dates.length === 0) return []
  const rows = await db
    .select({
      id: aiSchedule.id,
      targetId: aiSchedule.targetId,
      pillarId: aiSchedule.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      pillarColor: pillars.color,
      title: aiSchedule.title,
      date: aiSchedule.date,
      startTime: aiSchedule.startTime,
      endTime: aiSchedule.endTime,
      durationMinutes: aiSchedule.durationMinutes,
      timeOfDay: aiSchedule.timeOfDay,
      reasoning: aiSchedule.reasoning,
      priority: aiSchedule.priority,
      status: aiSchedule.status,
      aiGenerated: aiSchedule.aiGenerated,
    })
    .from(aiSchedule)
    .leftJoin(pillars, eq(aiSchedule.pillarId, pillars.id))
    .where(and(eq(aiSchedule.userId, userId), inArray(aiSchedule.date, dates), sql`${aiSchedule.status} <> 'rejected'`))
    .orderBy(aiSchedule.date, aiSchedule.startTime)
  return rows
}

export async function getDaySchedule(date?: string): Promise<ScheduleItem[]> {
  const userId = await getUserId()
  const day = date ?? (await getToday())
  return readSchedule(userId, [day])
}

export async function getWeekSchedule(anchorDate?: string): Promise<{ days: string[]; items: ScheduleItem[] }> {
  const userId = await getUserId()
  const anchor = anchorDate ?? (await getToday())
  const days = scopeDays("week", anchor)
  return { days, items: await readSchedule(userId, days) }
}

// ---------------------------------------------------------------------------
// Accept / edit / reject
// ---------------------------------------------------------------------------

async function logFeedback(userId: string, item: typeof aiSchedule.$inferSelect, action: "accept" | "edit" | "reject", to?: { date?: string; start?: string | null; timeOfDay?: string | null }) {
  await db.insert(aiScheduleFeedback).values({
    userId,
    scheduleId: item.id,
    targetId: item.targetId,
    pillarId: item.pillarId,
    action,
    fromDate: item.date,
    toDate: to?.date ?? item.date,
    fromTimeOfDay: item.timeOfDay,
    toTimeOfDay: to?.timeOfDay ?? item.timeOfDay,
    fromStart: item.startTime,
    toStart: to?.start ?? item.startTime,
  })
}

async function loadItem(userId: string, id: number) {
  const [item] = await db.select().from(aiSchedule).where(and(eq(aiSchedule.id, id), eq(aiSchedule.userId, userId)))
  if (!item) throw new Error("Schedule item not found")
  return item
}

/**
 * Accept a proposed item. For items tied to an existing target, re-date the
 * target to the planned day and stamp it with the duration / time-of-day /
 * start time. For model-added suggestions, create the backing target.
 */
export async function acceptScheduleItem(id: number) {
  const userId = await getUserId()
  const item = await loadItem(userId, id)

  if (item.targetId) {
    await db
      .update(targets)
      .set({
        date: item.date,
        scheduledStart: item.startTime,
        durationMinutes: item.durationMinutes,
        preferredTimeOfDay: item.timeOfDay,
      })
      .where(and(eq(targets.id, item.targetId), eq(targets.userId, userId)))
  } else if (item.pillarId) {
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${targets.sortOrder}), 0)` })
      .from(targets)
      .where(and(eq(targets.userId, userId), eq(targets.date, item.date)))
    const [created] = await db
      .insert(targets)
      .values({
        userId,
        title: item.title,
        date: item.date,
        originalDate: item.date,
        sortOrder: (max ?? 0) + 1,
        pillarId: item.pillarId,
        durationMinutes: item.durationMinutes,
        preferredTimeOfDay: item.timeOfDay,
        scheduledStart: item.startTime,
      })
      .returning()
    await db.update(aiSchedule).set({ targetId: created.id }).where(eq(aiSchedule.id, id))
  }

  await db.update(aiSchedule).set({ status: "accepted" }).where(eq(aiSchedule.id, id))
  await logFeedback(userId, item, "accept")
  revalidatePath("/")
  revalidatePath("/calendar")
}

export async function rejectScheduleItem(id: number) {
  const userId = await getUserId()
  const item = await loadItem(userId, id)
  await db.update(aiSchedule).set({ status: "rejected" }).where(eq(aiSchedule.id, id))
  await logFeedback(userId, item, "reject")
  revalidatePath("/calendar")
  revalidatePath("/")
}

/**
 * Manual edit (e.g. drag to another day / time). Manual edits always override
 * the AI suggestion: the row is re-stamped, flagged non-AI, logged, and any
 * linked accepted target is moved to match.
 */
export async function editScheduleItem(id: number, changes: { date?: string; startTime?: string | null; timeOfDay?: string | null }) {
  const userId = await getUserId()
  const item = await loadItem(userId, id)

  const next = {
    date: changes.date ?? item.date,
    startTime: changes.startTime !== undefined ? changes.startTime : item.startTime,
    timeOfDay: changes.timeOfDay !== undefined ? changes.timeOfDay : item.timeOfDay,
  }

  await db
    .update(aiSchedule)
    .set({ date: next.date, startTime: next.startTime, timeOfDay: next.timeOfDay, status: item.status === "proposed" ? "edited" : item.status, aiGenerated: false })
    .where(eq(aiSchedule.id, id))

  if (item.targetId && item.status === "accepted") {
    await db
      .update(targets)
      .set({ date: next.date, scheduledStart: next.startTime, preferredTimeOfDay: next.timeOfDay })
      .where(and(eq(targets.id, item.targetId), eq(targets.userId, userId)))
  }

  await logFeedback(userId, item, "edit", { date: next.date, start: next.startTime, timeOfDay: next.timeOfDay })
  revalidatePath("/calendar")
  revalidatePath("/")
}

/** Accept every still-proposed item across the given dates in one go. */
export async function acceptAllProposed(dates: string[]) {
  const userId = await getUserId()
  const rows = await db
    .select({ id: aiSchedule.id })
    .from(aiSchedule)
    .where(and(eq(aiSchedule.userId, userId), inArray(aiSchedule.date, dates), eq(aiSchedule.status, "proposed")))
  for (const r of rows) await acceptScheduleItem(r.id)
  return rows.length
}

// ---------------------------------------------------------------------------
// Command-bar assistant staging
// ---------------------------------------------------------------------------

/**
 * Stage a set of assistant-proposed tasks (from breakdown_goal) as `ai_schedule`
 * 'proposed' rows for today, unscheduled (no start time). This reuses the exact
 * accept/edit/reject + feedback machinery the AI Planner already uses: accepting
 * a row with no targetId but a pillarId creates the backing target. Returns the
 * staged items so the command bar can preview them.
 */
export async function proposeAssistantTasks(
  tasks: { title: string; pillarId: number | null; durationMinutes: number | null }[]
): Promise<ScheduleItem[]> {
  const userId = await getUserId()
  const today = await getToday()
  const clean = tasks.filter((t) => t.title.trim() && t.pillarId != null)
  if (clean.length === 0) return []

  const inserted = await db
    .insert(aiSchedule)
    .values(
      clean.map((t) => ({
        userId,
        sessionId: null,
        targetId: null,
        pillarId: t.pillarId,
        title: t.title.trim(),
        date: today,
        startTime: null,
        endTime: null,
        durationMinutes: t.durationMinutes ?? 30,
        timeOfDay: "any",
        reasoning: "From your goal breakdown",
        priority: 5,
        status: "proposed",
        aiGenerated: true,
      }))
    )
    .returning({ id: aiSchedule.id })

  const ids = new Set(inserted.map((r) => r.id))
  revalidatePath("/calendar")
  revalidatePath("/")
  const todayItems = await readSchedule(userId, [today])
  return todayItems.filter((it) => ids.has(it.id))
}

/**
 * Log a proposal-level accept/reject into the same `ai_schedule_feedback`
 * learning loop the planner uses. Used for assistant proposals (e.g. recurring)
 * that don't map to a single `ai_schedule` row.
 */
export async function logProposalFeedback(action: "accept" | "reject", pillarId: number | null) {
  const userId = await getUserId()
  await db.insert(aiScheduleFeedback).values({ userId, scheduleId: null, targetId: null, pillarId, action })
}

/** Discard all proposals (proposed + edited, keeps accepted) for the dates. */
export async function clearProposed(dates: string[]) {
  const userId = await getUserId()
  if (dates.length === 0) return
  await db
    .delete(aiSchedule)
    .where(and(eq(aiSchedule.userId, userId), inArray(aiSchedule.date, dates), inArray(aiSchedule.status, ["proposed", "edited"])))
  revalidatePath("/calendar")
  revalidatePath("/")
}
