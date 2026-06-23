"use server"

// Entrypoint for the in-app command bar (⌘K). This orchestrates the assistant
// agent (lib/assistant/agent.ts) and stages proposals, but performs NO direct
// data mutations of its own: every write is delegated to an existing server
// action (planner.ts, recurring.ts) so the propose → preview → confirm → apply
// flow and the ai_schedule_feedback learning loop stay in one place.

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
import {
  runAssistantAgent,
  appendAnswer,
  type AssistantContext,
  type AssistantTurn,
  type ClarifyingQuestion,
  type RecurringProposal,
  type GoalPlanProposal,
} from "@/lib/assistant/agent"

const RECURRING_POINTS = 10

async function buildContext(): Promise<AssistantContext> {
  const [today, pillars, effort] = await Promise.all([
    getToday(),
    getPillars(),
    getEffortComparison().catch(() => []),
  ])
  return {
    today,
    pillars: pillars.map((p) => ({ id: p.id, name: p.name })),
    effort: effort.map((e) => ({ pillarName: e.pillarName, percentOfTarget: e.percentOfTarget })),
  }
}

// The discriminated result the command bar renders. A question pauses the loop;
// the other variants are previews awaiting an explicit confirm.
export type AssistantResult =
  | { kind: "question"; question: ClarifyingQuestion; messages: unknown[]; source: "ai" | "heuristic" }
  | { kind: "breakdown"; goalText: string; items: ScheduleItem[]; source: "ai" | "heuristic" }
  | { kind: "recurring"; proposal: RecurringProposal; pillarName: string | null; source: "ai" | "heuristic" }
  | { kind: "goal_plan"; proposal: GoalPlanProposal; pillarName: string | null; source: "ai" | "heuristic" }
  | { kind: "plan_week"; sessionId: number; days: string[]; items: ScheduleItem[] }
  | { kind: "planner_question"; sessionId: number; question: ClarifyingQuestion }
  | { kind: "empty"; message: string }

async function finishTurn(ctx: AssistantContext, turn: AssistantTurn): Promise<AssistantResult> {
  if (turn.kind === "question") {
    // Heuristic mode never asks; a clarifying question is always model-driven.
    return { kind: "question", question: turn.question, messages: turn.messages, source: "ai" }
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
    return { kind: "goal_plan", proposal, pillarName, source: turn.source }
  }

  // recurring
  const pillarName = ctx.pillars.find((p) => p.id === proposal.pillarId)?.name ?? null
  return { kind: "recurring", proposal, pillarName, source: turn.source }
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

  const goal = await createLongTermGoal(goalTitle, proposal.pillarId, proposal.targetValue, proposal.deadline)
  if (!goal) return { ok: false, error: "Couldn't create the goal." }

  const sessionTitle = proposal.unit
    ? `${goalTitle}: ${proposal.perSession} ${proposal.unit}`
    : `${goalTitle} (${proposal.perSession}/session)`
  await createRecurringTask(sessionTitle, proposal.pillarId, RECURRING_POINTS, proposal.frequency, {
    daysOfWeek: proposal.frequency === "weekly" ? proposal.daysOfWeek : undefined,
    endDate: proposal.deadline,
    durationMinutes: proposal.durationMinutes,
    preferredTimeOfDay: proposal.preferredTimeOfDay,
    quantity: proposal.perSession,
    longTermGoalId: goal.id,
  })
  await logProposalFeedback("accept", proposal.pillarId)
  return { ok: true }
}

/** Record a rejected goal plan in the learning loop. */
export async function rejectGoalPlan(proposal: GoalPlanProposal): Promise<void> {
  await logProposalFeedback("reject", proposal.pillarId)
}
