"use server"

// Entrypoint for the in-app command bar (⌘K). This orchestrates the assistant
// agent (lib/assistant/agent.ts) and stages proposals, but performs NO direct
// data mutations of its own: every write is delegated to an existing server
// action (planner.ts, recurring.ts) so the propose → preview → confirm → apply
// flow and the ai_schedule_feedback learning loop stay in one place.

import { and, eq, gte, sql } from "drizzle-orm"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { targets, pillars, longTermGoals } from "@/lib/db/schema"
import { getPillars } from "@/app/actions/pillars"
import { getToday } from "@/lib/date"
import { getEffortComparison } from "@/app/actions/reflection"
import { createRecurringTask } from "@/app/actions/recurring"
import { createLongTermGoal } from "@/app/actions/goals"
import {
  startPlanning,
  answerPlanningQuestion,
  getWeekSchedule,
  proposeAssistantTasks,
  logProposalFeedback,
  type ScheduleItem,
} from "@/app/actions/planner"
import { getScheduleForRange, type ScheduleDay } from "@/app/actions/history"
import {
  runAssistantAgent,
  resumeWithRefinement,
  appendAnswer,
  type AssistantContext,
  type AssistantTurn,
  type ClarifyingQuestion,
  type RecurringProposal,
  type GoalPlanProposal,
} from "@/lib/assistant/agent"
import { getPillarCompletionRate, computePacing } from "@/lib/ai/pacing"

const RECURRING_POINTS = 10

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

async function buildContext(): Promise<AssistantContext> {
  const userId = await getUserId()
  const [today, pillarList, effort] = await Promise.all([
    getToday(),
    getPillars(),
    getEffortComparison().catch(() => []),
  ])

  // Open tasks for today (not yet completed)
  const openRows = await db
    .select({
      title: targets.title,
      pillarName: pillars.name,
      originalDate: targets.originalDate,
      deadline: targets.deadline,
      durationMinutes: targets.durationMinutes,
    })
    .from(targets)
    .innerJoin(pillars, eq(targets.pillarId, pillars.id))
    .where(and(eq(targets.userId, userId), eq(targets.completed, false), eq(targets.date, today)))
    .limit(20)

  const openTasksToday = openRows.map((r) => {
    const [oy, om, od] = r.originalDate.split("-").map(Number)
    const [ty, tm, td] = today.split("-").map(Number)
    const daysOverdue = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(oy, om - 1, od)) / 864e5)
    return {
      title: r.title,
      pillarName: r.pillarName,
      daysOverdue,
      deadline: r.deadline,
      durationMinutes: r.durationMinutes,
    }
  })

  // Active long-term goals + pace
  const activeGoals = await db
    .select({
      title: longTermGoals.title,
      pillarName: pillars.name,
      targetValue: longTermGoals.targetValue,
      deadline: longTermGoals.deadline,
      createdAt: longTermGoals.createdAt,
    })
    .from(longTermGoals)
    .innerJoin(pillars, eq(longTermGoals.pillarId, pillars.id))
    .where(and(eq(longTermGoals.userId, userId), eq(longTermGoals.completed, false)))
    .limit(10)

  // Compute progress for each long-term goal
  const goalSummaries = await Promise.all(
    activeGoals.map(async (g) => {
      const created = g.createdAt.toISOString().slice(0, 10)
      const [row] = await db
        .select({ done: sql<number>`coalesce(sum(${targets.quantity}) filter (where ${targets.completed}), 0)` })
        .from(targets)
        .where(and(eq(targets.userId, userId), gte(targets.originalDate, created)))

      const done = Number(row?.done ?? 0)
      const progressPercent = Math.min(100, Math.round((done / Math.max(1, g.targetValue)) * 100))

      const [dy, dm, dd] = g.deadline.split("-").map(Number)
      const [ty, tm, td] = today.split("-").map(Number)
      const daysUntilDeadline = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 864e5)

      return { title: g.title, pillarName: g.pillarName, progressPercent, daysUntilDeadline }
    })
  )

  // Neglected pillars (5+ days idle) — cheap read-only check
  const activePillars = await db
    .select({ id: pillars.id, name: pillars.name, createdAt: pillars.createdAt })
    .from(pillars)
    .where(and(eq(pillars.userId, userId), eq(pillars.archived, false)))

  const lastActivityRows = await db
    .select({ pillarId: targets.pillarId, lastDate: sql<string>`max(${targets.originalDate})` })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.completed, true)))
    .groupBy(targets.pillarId)
  const lastMap = new Map(lastActivityRows.map((r) => [r.pillarId, r.lastDate]))

  const neglectedPillars = activePillars
    .map((p) => {
      const lastDate = lastMap.get(p.id) ?? p.createdAt.toISOString().slice(0, 10)
      const [ly, lm, ld] = lastDate.split("-").map(Number)
      const [ty2, tm2, td2] = today.split("-").map(Number)
      const days = Math.round((Date.UTC(ty2, tm2 - 1, td2) - Date.UTC(ly, lm - 1, ld)) / 864e5)
      return { pillarName: p.name, daysSinceLastActivity: days }
    })
    .filter((n) => n.daysSinceLastActivity >= 5)

  return {
    today,
    pillars: pillarList.map((p) => ({ id: p.id, name: p.name })),
    effort: effort.map((e) => ({ pillarName: e.pillarName, percentOfTarget: e.percentOfTarget })),
    openTasksToday,
    activeGoals: goalSummaries,
    neglectedPillars,
  }
}

// The discriminated result the command bar renders. A question pauses the loop;
// the other variants are previews awaiting an explicit confirm.
export type AssistantResult =
  | { kind: "question"; question: ClarifyingQuestion; messages: unknown[]; source: "ai" | "heuristic" }
  | { kind: "breakdown"; goalText: string; items: ScheduleItem[]; source: "ai" | "heuristic" }
  | { kind: "recurring"; proposal: RecurringProposal; pillarName: string | null; source: "ai" | "heuristic"; messages: unknown[] }
  | { kind: "goal_plan"; proposal: GoalPlanProposal; pillarName: string | null; source: "ai" | "heuristic"; messages: unknown[] }
  | { kind: "plan_week"; sessionId: number; days: string[]; items: ScheduleItem[] }
  | { kind: "planner_question"; sessionId: number; question: ClarifyingQuestion }
  // Read-only answer to "what's planned for X?" — rendered directly, no confirm.
  | { kind: "schedule"; start: string; end: string; days: ScheduleDay[] }
  | { kind: "empty"; message: string }

async function finishTurn(ctx: AssistantContext, turn: AssistantTurn): Promise<AssistantResult> {
  if (turn.kind === "question") {
    // Heuristic mode never asks; a clarifying question is always model-driven.
    return { kind: "question", question: turn.question, messages: turn.messages, source: "ai" }
  }

  if (turn.kind === "read_schedule") {
    // Direct-answer path: read the real schedule and report it. No proposal,
    // no confirm step, no mutation.
    const days = await getScheduleForRange(turn.start, turn.end)
    return { kind: "schedule", start: turn.start, end: turn.end, days }
  }

  const { proposal } = turn

  if (proposal.kind === "plan_week") {
    return runPlanWeek()
  }

  if (proposal.kind === "breakdown") {
    const items = await proposeAssistantTasks(
      proposal.tasks.map((t) => ({ title: t.title, pillarId: t.pillarId, durationMinutes: t.durationMinutes }))
    )
    return { kind: "breakdown", goalText: proposal.goalText, items, source: turn.source }
  }

  if (proposal.kind === "goal_plan") {
    const pillarName = ctx.pillars.find((p) => p.id === proposal.pillarId)?.name ?? null
    return { kind: "goal_plan", proposal, pillarName, source: turn.source, messages: turn.messages }
  }

  // recurring
  const pillarName = ctx.pillars.find((p) => p.id === proposal.pillarId)?.name ?? null
  return { kind: "recurring", proposal, pillarName, source: turn.source, messages: turn.messages }
}

/** Map the planner's own result into the command bar's shape. */
async function runPlanWeek(): Promise<AssistantResult> {
  const res = await startPlanning("week")
  if (res.kind === "question") {
    return { kind: "planner_question", sessionId: res.sessionId, question: res.question }
  }
  if (res.count === 0) {
    return { kind: "empty", message: "No open tasks to schedule yet — add some targets first." }
  }
  const { days, items } = await getWeekSchedule()
  return { kind: "plan_week", sessionId: res.sessionId, days, items }
}

/** Start a fresh command-bar turn from a natural-language command. */
export async function startAssistant(input: string): Promise<AssistantResult> {
  const trimmed = input.trim()
  if (!trimmed) return { kind: "empty", message: "Type a command to get started." }
  const ctx = await buildContext()
  const turn = await runAssistantAgent(ctx, trimmed)
  return finishTurn(ctx, turn)
}

/** Resume an assistant clarifying question with the user's quick-reply. */
export async function answerAssistant(priorMessages: unknown[], value: string, label: string): Promise<AssistantResult> {
  const ctx = await buildContext()
  const resumed = appendAnswer(priorMessages, `${label} (${value})`)
  const turn = await runAssistantAgent(ctx, label, resumed)
  return finishTurn(ctx, turn)
}

/** Resume the planner's own clarifying question (raised via plan_week). */
export async function answerPlannerQuestion(sessionId: number, value: string, label: string): Promise<AssistantResult> {
  const res = await answerPlanningQuestion(sessionId, value, label)
  if (res.kind === "question") {
    return { kind: "planner_question", sessionId: res.sessionId, question: res.question }
  }
  if (res.count === 0) {
    return { kind: "empty", message: "No open tasks to schedule yet — add some targets first." }
  }
  const { days, items } = await getWeekSchedule()
  return { kind: "plan_week", sessionId: res.sessionId, days, items }
}

// --- Recurring proposal: confirm / reject (apply step) ----------------------

/** Apply a confirmed recurring proposal via the existing recurring action. */
export async function confirmRecurringProposal(proposal: RecurringProposal): Promise<{ ok: boolean; error?: string }> {
  if (proposal.pillarId == null) return { ok: false, error: "Pick a pillar first." }
  if (!proposal.title.trim()) return { ok: false, error: "Give the task a name." }
  if (proposal.frequency === "weekly" && proposal.daysOfWeek.length === 0) {
    return { ok: false, error: "Pick at least one day of the week." }
  }

  await createRecurringTask(proposal.title.trim(), proposal.pillarId, RECURRING_POINTS, proposal.frequency, {
    daysOfWeek: proposal.frequency === "weekly" ? proposal.daysOfWeek : undefined,
    intervalDays: proposal.frequency === "custom" ? proposal.intervalDays ?? 2 : undefined,
    durationMinutes: proposal.durationMinutes,
    preferredTimeOfDay: proposal.preferredTimeOfDay,
  })
  await logProposalFeedback("accept", proposal.pillarId)
  return { ok: true }
}

/** Record a rejected recurring proposal in the learning loop. */
export async function rejectRecurringProposal(proposal: RecurringProposal): Promise<void> {
  await logProposalFeedback("reject", proposal.pillarId)
}

// --- Goal plan: confirm / reject (apply step) -------------------------------

/**
 * Apply a confirmed "quantity by deadline" goal: create the long-term goal and
 * a recurring task that generates ~perSession units each occurrence and stops
 * at the deadline. The recurring task carries `quantity` + `longTermGoalId`, so
 * each completed session auto-advances the goal toward its target.
 * Uses the user's historical pillar completion rate to set a realistic perSession.
 */
export async function confirmGoalPlan(proposal: GoalPlanProposal): Promise<{ ok: boolean; error?: string }> {
  if (proposal.pillarId == null) return { ok: false, error: "Pick a pillar first." }
  const goalTitle = proposal.goalTitle.trim()
  if (!goalTitle) return { ok: false, error: "Give the goal a name." }
  if (!Number.isFinite(proposal.targetValue) || proposal.targetValue <= 0) return { ok: false, error: "Set a target amount." }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(proposal.deadline)) return { ok: false, error: "Set a deadline." }
  if (proposal.frequency === "weekly" && proposal.daysOfWeek.length === 0) {
    return { ok: false, error: "Pick at least one day of the week." }
  }

  const userId = await getUserId()

  // Use real historical completion rate to compute a realistic per-session value.
  const completionRate = await getPillarCompletionRate(db, userId, proposal.pillarId)
  const pacing = computePacing({
    targetValue: proposal.targetValue,
    occurrences: proposal.occurrences,
    pillarCompletionRate: completionRate,
  })

  const goal = await createLongTermGoal(goalTitle, proposal.pillarId, proposal.targetValue, proposal.deadline)
  if (!goal) return { ok: false, error: "Couldn't create the goal." }

  const sessionTitle = proposal.unit
    ? `${goalTitle}: ${pacing.perSession} ${proposal.unit}`
    : `${goalTitle} (${pacing.perSession}/session)`
  await createRecurringTask(sessionTitle, proposal.pillarId, RECURRING_POINTS, proposal.frequency, {
    daysOfWeek: proposal.frequency === "weekly" ? proposal.daysOfWeek : undefined,
    endDate: proposal.deadline,
    durationMinutes: proposal.durationMinutes,
    preferredTimeOfDay: proposal.preferredTimeOfDay,
    quantity: pacing.perSession,
    longTermGoalId: goal.id,
  })
  await logProposalFeedback("accept", proposal.pillarId)
  return { ok: true }
}

/** Record a rejected goal plan in the learning loop. */
export async function rejectGoalPlan(proposal: GoalPlanProposal): Promise<void> {
  await logProposalFeedback("reject", proposal.pillarId)
}

// --- Multi-turn refinement: user rejects and types a correction --------------

/**
 * Resume after the user rejected a proposal and typed a correction
 * (e.g. "actually make it daily, not weekly").  The prior conversation
 * transcript is passed back so the model can revise in context.
 */
export async function refineAssistant(
  priorMessages: unknown[],
  correction: string
): Promise<AssistantResult> {
  const trimmed = correction.trim()
  if (!trimmed) return { kind: "empty", message: "Type a correction to refine the proposal." }
  const ctx = await buildContext()
  const turn = await resumeWithRefinement(ctx, priorMessages, trimmed)
  return finishTurn(ctx, turn)
}
