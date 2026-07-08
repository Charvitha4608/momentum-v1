"use server"

import { and, asc, eq, gte, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { focusSessions, longTermGoals, pillarGoals, pillars, targets } from "@/lib/db/schema"
import { daysBetween, getToday, shiftDateString } from "@/lib/date"
import { createNotification } from "@/app/actions/notifications"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type PillarGoalWithProgress = {
  id: number
  pillarId: number
  pillarName: string
  pillarIcon: string
  pillarColor: string
  metric: "points" | "sessions"
  targetValue: number
  used: number
  progress: number
  daysLeft: number
}

/**
 * [start, end) of the rolling 30-day cycle that contains `today`, anchored at
 * the goal's immutable `anchorDate`. The cycle advances automatically as
 * `today` moves forward — no cron resets a pillar goal each month.
 */
function rollingPeriod(anchorDate: string, today: string): { start: string; end: string; daysLeft: number } {
  const sinceAnchor = daysBetween(anchorDate, today)
  const cyclesElapsed = Math.max(0, Math.floor(sinceAnchor / 30))
  const start = shiftDateString(anchorDate, cyclesElapsed * 30)
  const end = shiftDateString(start, 30)
  return { start, end, daysLeft: daysBetween(today, end) }
}

/** Pillar goals with progress against their current rolling 30-day cycle. */
export async function getPillarGoals(): Promise<PillarGoalWithProgress[]> {
  const userId = await getUserId()
  const today = await getToday()

  const goals = await db
    .select({
      id: pillarGoals.id,
      pillarId: pillarGoals.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      pillarColor: pillars.color,
      metric: pillarGoals.metric,
      targetValue: pillarGoals.targetValue,
      anchorDate: pillarGoals.anchorDate,
    })
    .from(pillarGoals)
    .innerJoin(pillars, eq(pillarGoals.pillarId, pillars.id))
    .where(and(eq(pillarGoals.userId, userId), eq(pillarGoals.active, true)))
    .orderBy(asc(pillarGoals.id))

  // Each goal has its own anchor, so its window differs — aggregate per goal
  // over the same rolling [start, end) cycle, differing only by source table
  // and unit. Points sum completed-target points, attributed by `originalDate`
  // (creation day) so carry-overs stay pinned to their cycle; sessions count
  // `focus_sessions` rows, windowed on their completion `date`.
  const result: PillarGoalWithProgress[] = []
  for (const g of goals) {
    const { start, end, daysLeft } = rollingPeriod(g.anchorDate, today)
    let usedNum: number
    if (g.metric === "sessions") {
      const [{ used }] = await db
        .select({ used: sql<number>`count(*)` })
        .from(focusSessions)
        .where(
          and(
            eq(focusSessions.userId, userId),
            eq(focusSessions.pillarId, g.pillarId),
            gte(focusSessions.date, start),
            sql`${focusSessions.date} < ${end}`
          )
        )
      usedNum = Number(used)
    } else {
      const [{ used }] = await db
        .select({
          used: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
        })
        .from(targets)
        .where(
          and(
            eq(targets.userId, userId),
            eq(targets.pillarId, g.pillarId),
            gte(targets.originalDate, start),
            sql`${targets.originalDate} < ${end}`
          )
        )
      usedNum = Number(used)
    }

    result.push({
      id: g.id,
      pillarId: g.pillarId,
      pillarName: g.pillarName,
      pillarIcon: g.pillarIcon,
      pillarColor: g.pillarColor,
      metric: g.metric as "points" | "sessions",
      targetValue: g.targetValue,
      used: usedNum,
      progress: g.targetValue > 0 ? Math.round((usedNum / g.targetValue) * 100) : 0,
      daysLeft,
    })
  }

  return result
}

export type PillarGoalContribution = {
  id: number
  title: string
  // For a points goal this is the target's points; for a sessions goal it's the
  // session's minutes. The card labels it per `metric`.
  value: number
  metric: "points" | "sessions"
  date: string
}

/**
 * The items that count toward a pillar goal's CURRENT rolling cycle — the
 * read-only breakdown shown when a Pillar Goal row is expanded. Mirrors the
 * progress query's source per `metric`: completed targets (attributed by
 * `originalDate` so carry-overs stay pinned to their cycle) for points goals,
 * or focus_sessions (windowed on completion `date`) for sessions goals.
 */
export async function getPillarGoalBreakdown(pillarId: number): Promise<PillarGoalContribution[]> {
  const userId = await getUserId()
  const today = await getToday()

  const [goal] = await db
    .select({ anchorDate: pillarGoals.anchorDate, metric: pillarGoals.metric })
    .from(pillarGoals)
    .where(and(eq(pillarGoals.userId, userId), eq(pillarGoals.pillarId, pillarId), eq(pillarGoals.active, true)))
    .limit(1)
  if (!goal) return []

  const { start, end } = rollingPeriod(goal.anchorDate, today)

  if (goal.metric === "sessions") {
    const rows = await db
      .select({
        id: focusSessions.id,
        title: targets.title,
        minutes: focusSessions.minutes,
        date: focusSessions.date,
      })
      .from(focusSessions)
      .leftJoin(targets, eq(focusSessions.targetId, targets.id))
      .where(
        and(
          eq(focusSessions.userId, userId),
          eq(focusSessions.pillarId, pillarId),
          gte(focusSessions.date, start),
          sql`${focusSessions.date} < ${end}`
        )
      )
      .orderBy(asc(focusSessions.date), asc(focusSessions.id))
    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? "Focus session",
      value: r.minutes,
      metric: "sessions" as const,
      date: r.date,
    }))
  }

  const rows = await db
    .select({
      id: targets.id,
      title: targets.title,
      points: targets.points,
      originalDate: targets.originalDate,
    })
    .from(targets)
    .where(
      and(
        eq(targets.userId, userId),
        eq(targets.pillarId, pillarId),
        eq(targets.completed, true),
        gte(targets.originalDate, start),
        sql`${targets.originalDate} < ${end}`
      )
    )
    .orderBy(asc(targets.originalDate), asc(targets.id))
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    value: r.points,
    metric: "points" as const,
    date: r.originalDate,
  }))
}

/**
 * Create or replace the single goal for a pillar. `pillarId` is unique, so
 * re-submitting for a pillar that already has a goal updates it in place (new
 * metric + target + anchor). `metric` picks the progress source: 'points'
 * (completed-target points) or 'sessions' (focus_sessions count).
 */
export async function createPillarGoal(
  pillarId: number,
  targetValue: number,
  anchorDate: string,
  metric: "points" | "sessions" = "points"
) {
  const userId = await getUserId()
  if (!Number.isFinite(targetValue) || targetValue <= 0) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) return null
  if (metric !== "points" && metric !== "sessions") return null

  const [created] = await db
    .insert(pillarGoals)
    .values({ userId, pillarId, metric, targetValue: Math.round(targetValue), anchorDate })
    .onConflictDoUpdate({
      target: pillarGoals.pillarId,
      set: { metric, targetValue: Math.round(targetValue), anchorDate },
    })
    .returning()

  revalidatePath("/goals")
  revalidatePath("/reflection")
  return created
}

export async function deletePillarGoal(id: number) {
  const userId = await getUserId()
  await db.delete(pillarGoals).where(and(eq(pillarGoals.id, id), eq(pillarGoals.userId, userId)))
  revalidatePath("/goals")
  revalidatePath("/reflection")
}

export type LongTermGoalWithProgress = {
  id: number
  pillarId: number
  pillarName: string
  pillarIcon: string
  pillarColor: string
  title: string
  targetValue: number
  deadline: string
  completed: boolean
  current: number
  progress: number
}

/**
 * Long-term goals with auto-computed progress: the summed `quantity` of
 * completed targets explicitly linked to the goal (`longTermGoalId`), vs
 * `targetValue`.
 */
export async function getLongTermGoals(): Promise<LongTermGoalWithProgress[]> {
  const userId = await getUserId()

  const goals = await db
    .select({
      id: longTermGoals.id,
      pillarId: longTermGoals.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      pillarColor: pillars.color,
      title: longTermGoals.title,
      targetValue: longTermGoals.targetValue,
      deadline: longTermGoals.deadline,
      completed: longTermGoals.completed,
      createdAt: longTermGoals.createdAt,
    })
    .from(longTermGoals)
    .innerJoin(pillars, eq(longTermGoals.pillarId, pillars.id))
    .where(eq(longTermGoals.userId, userId))
    .orderBy(asc(longTermGoals.deadline))

  const result: LongTermGoalWithProgress[] = []
  for (const g of goals) {
    const [{ done }] = await db
      .select({ done: sql<number>`coalesce(sum(${targets.quantity}), 0)` })
      .from(targets)
      .where(
        and(
          eq(targets.userId, userId),
          eq(targets.longTermGoalId, g.id),
          eq(targets.completed, true)
        )
      )

    const progress = Number(done)
    const completed = g.completed || progress >= g.targetValue
    if (completed && !g.completed) {
      await db.update(longTermGoals).set({ completed: true }).where(eq(longTermGoals.id, g.id))
    }

    result.push({
      id: g.id,
      pillarId: g.pillarId,
      pillarName: g.pillarName,
      pillarIcon: g.pillarIcon,
      pillarColor: g.pillarColor,
      title: g.title,
      targetValue: g.targetValue,
      deadline: g.deadline,
      completed,
      current: progress,
      progress: g.targetValue > 0 ? Math.round((progress / g.targetValue) * 100) : 0,
    })
  }

  return result
}

export type ActiveLongTermGoal = { id: number; title: string; pillarId: number }

/** Incomplete long-term goals, for the add-task form's goal picker. */
export async function getActiveLongTermGoals(): Promise<ActiveLongTermGoal[]> {
  const userId = await getUserId()
  return db
    .select({ id: longTermGoals.id, title: longTermGoals.title, pillarId: longTermGoals.pillarId })
    .from(longTermGoals)
    .where(and(eq(longTermGoals.userId, userId), eq(longTermGoals.completed, false)))
    .orderBy(asc(longTermGoals.deadline))
}

export async function createLongTermGoal(title: string, pillarId: number, targetValue: number, deadline: string) {
  const userId = await getUserId()
  const trimmed = title.trim()
  if (!trimmed || !Number.isFinite(targetValue) || targetValue <= 0) return null

  const [created] = await db
    .insert(longTermGoals)
    .values({ userId, pillarId, title: trimmed, targetValue: Math.round(targetValue), deadline })
    .returning()

  revalidatePath("/goals")
  return created
}

export async function deleteLongTermGoal(id: number) {
  const userId = await getUserId()
  await db.delete(longTermGoals).where(and(eq(longTermGoals.id, id), eq(longTermGoals.userId, userId)))
  revalidatePath("/goals")
}

/**
 * Notify the user 7/3/1 days before each incomplete long-term goal's deadline.
 * Each threshold fires at most once per goal, tracked via reminded7/3/1.
 * Called once per Goals-page load.
 */
export async function checkGoalReminders() {
  const userId = await getUserId()
  const today = await getToday()

  const goals = await db
    .select()
    .from(longTermGoals)
    .where(and(eq(longTermGoals.userId, userId), eq(longTermGoals.completed, false)))

  for (const g of goals) {
    const daysLeft = daysBetween(today, g.deadline)

    if (daysLeft === 7 && !g.reminded7) {
      await createNotification(userId, "goal_reminder", `⏰ 7 days left to reach your goal "${g.title}"`)
      await db.update(longTermGoals).set({ reminded7: true }).where(eq(longTermGoals.id, g.id))
    } else if (daysLeft === 3 && !g.reminded3) {
      await createNotification(userId, "goal_reminder", `⏰ 3 days left to reach your goal "${g.title}"`)
      await db.update(longTermGoals).set({ reminded3: true }).where(eq(longTermGoals.id, g.id))
    } else if (daysLeft === 1 && !g.reminded1) {
      await createNotification(userId, "goal_reminder", `⏰ 1 day left to reach your goal "${g.title}"`)
      await db.update(longTermGoals).set({ reminded1: true }).where(eq(longTermGoals.id, g.id))
    }
  }
}
