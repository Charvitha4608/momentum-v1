"use server"

import { and, asc, eq, gte, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { longTermGoals, pillarGoals, pillars, targets } from "@/lib/db/schema"
import { daysBetween, getToday } from "@/lib/date"
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
  actual: number
  progress: number
}

/** Active pillar goals with progress against the current calendar month. */
export async function getPillarGoals(): Promise<PillarGoalWithProgress[]> {
  const userId = await getUserId()
  const today = await getToday()
  const [year, month] = today.split("-").map(Number)
  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  const goals = await db
    .select({
      id: pillarGoals.id,
      pillarId: pillarGoals.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      pillarColor: pillars.color,
      metric: pillarGoals.metric,
      targetValue: pillarGoals.targetValue,
    })
    .from(pillarGoals)
    .innerJoin(pillars, eq(pillarGoals.pillarId, pillars.id))
    .where(and(eq(pillarGoals.userId, userId), eq(pillarGoals.active, true)))
    .orderBy(asc(pillarGoals.id))

  if (goals.length === 0) return []

  const actuals = await db
    .select({
      pillarId: targets.pillarId,
      points: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
      sessions: sql<number>`count(*) filter (where ${targets.completed})`,
    })
    .from(targets)
    .where(and(eq(targets.userId, userId), gte(targets.originalDate, start), sql`${targets.originalDate} < ${end}`))
    .groupBy(targets.pillarId)

  const actualMap = new Map(actuals.map((a) => [a.pillarId, a]))

  return goals.map((g) => {
    const a = actualMap.get(g.pillarId)
    const actual = g.metric === "points" ? Number(a?.points ?? 0) : Number(a?.sessions ?? 0)
    return {
      ...g,
      metric: g.metric as "points" | "sessions",
      actual,
      progress: g.targetValue > 0 ? Math.round((actual / g.targetValue) * 100) : 0,
    }
  })
}

export async function createPillarGoal(pillarId: number, metric: "points" | "sessions", targetValue: number) {
  const userId = await getUserId()
  if (!Number.isFinite(targetValue) || targetValue <= 0) return null

  // Only one active goal per pillar at a time, so progress isn't ambiguous.
  await db
    .update(pillarGoals)
    .set({ active: false })
    .where(and(eq(pillarGoals.userId, userId), eq(pillarGoals.pillarId, pillarId), eq(pillarGoals.active, true)))

  const [created] = await db
    .insert(pillarGoals)
    .values({ userId, pillarId, metric, targetValue: Math.round(targetValue) })
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
