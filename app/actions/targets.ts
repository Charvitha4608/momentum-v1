"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { targets, dailyStats, notifications, user, pillars, recurringTasks } from "@/lib/db/schema"
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getToday } from "@/lib/date"
import { getFriendIds } from "@/lib/friend-ids"
import { computeStreak, buildStatsMap } from "@/lib/streak"
import { createNotification } from "@/app/actions/notifications"
import { isDueOn } from "@/lib/recurring"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/**
 * Daily Score = (points earned) / (total targets), range 0-10.
 * Daily Completion % = (completed targets) / (total targets).
 */
function scoreSnapshot(total: number, completed: number, pointsEarned: number) {
  return {
    totalTargets: total,
    completedTargets: completed,
    allCompleted: total > 0 && completed === total,
    pointsEarned,
    dailyScore: total > 0 ? pointsEarned / total : 0,
  }
}

/**
 * Recompute and upsert the `daily_stats` snapshot for one user+date from the
 * current `targets` rows for that date. Used both to freeze past days before
 * carry-over and to keep today's snapshot current as targets are mutated.
 */
export async function upsertDailyStats(userId: string, date: string) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${targets.completed})`,
      pointsEarned: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
    })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.date, date)))

  const snapshot = scoreSnapshot(Number(stats.total), Number(stats.completed), Number(stats.pointsEarned))

  await db
    .insert(dailyStats)
    .values({ userId, date, ...snapshot })
    .onConflictDoUpdate({ target: [dailyStats.userId, dailyStats.date], set: snapshot })

  return snapshot
}

/**
 * Freeze a `daily_stats` snapshot for every past day that still has targets
 * dated before `today`. Runs before carry-over re-dates rows, so the
 * snapshot captures each day's final state for history/calendar use.
 */
async function freezeDailyStats(userId: string, today: string) {
  const pastDates = await db
    .select({ date: targets.date })
    .from(targets)
    .where(and(eq(targets.userId, userId), lt(targets.date, today)))
    .groupBy(targets.date)

  for (const { date } of pastDates) {
    await upsertDailyStats(userId, date)
  }
}

/**
 * Carry-over rule: any UNFINISHED target dated before `today` is re-dated to
 * today so it keeps showing up until completed. Completed targets stay on
 * their original day for history. `daily_stats` is frozen for each past day
 * first, so history is preserved even after re-dating.
 */
async function carryOver(userId: string, today: string) {
  await freezeDailyStats(userId, today)
  await db
    .update(targets)
    .set({ date: today })
    .where(and(eq(targets.userId, userId), eq(targets.completed, false), lt(targets.date, today)))
}

/**
 * For each active recurring task due on `today` that doesn't already have a
 * target generated for it (by `recurringTaskId` + `originalDate`), create one.
 * Called at the top of `getTodayTargets`, before carry-over.
 */
async function generateRecurringTargets(userId: string, today: string) {
  const activeTasks = await db
    .select()
    .from(recurringTasks)
    .where(and(eq(recurringTasks.userId, userId), eq(recurringTasks.active, true)))

  const due = activeTasks.filter((task) => isDueOn(task, today))
  if (due.length === 0) return

  const existing = await db
    .select({ recurringTaskId: targets.recurringTaskId })
    .from(targets)
    .where(
      and(
        eq(targets.userId, userId),
        eq(targets.originalDate, today),
        inArray(
          targets.recurringTaskId,
          due.map((task) => task.id)
        )
      )
    )
  const existingIds = new Set(existing.map((row) => row.recurringTaskId))
  const toCreate = due.filter((task) => !existingIds.has(task.id))
  if (toCreate.length === 0) return

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${targets.sortOrder}), 0)` })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.date, today)))

  let sortOrder = Number(max ?? 0)
  for (const task of toCreate) {
    sortOrder += 1
    await db.insert(targets).values({
      userId,
      title: task.title,
      date: today,
      originalDate: today,
      points: task.points,
      sortOrder,
      pillarId: task.pillarId,
      recurringTaskId: task.id,
    })
  }
  await upsertDailyStats(userId, today)
}

export async function getTodayTargets(today?: string) {
  const userId = await getUserId()
  const day = today ?? (await getToday())
  await generateRecurringTargets(userId, day)
  await carryOver(userId, day)
  return db
    .select({
      id: targets.id,
      title: targets.title,
      completed: targets.completed,
      date: targets.date,
      originalDate: targets.originalDate,
      points: targets.points,
      sortOrder: targets.sortOrder,
      pillarId: targets.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      pillarColor: pillars.color,
    })
    .from(targets)
    .innerJoin(pillars, eq(targets.pillarId, pillars.id))
    .where(and(eq(targets.userId, userId), eq(targets.date, day)))
    .orderBy(asc(targets.sortOrder), asc(targets.id))
}

export async function addTarget(title: string, pillarId: number, today?: string) {
  const userId = await getUserId()
  const day = today ?? (await getToday())
  const trimmed = title.trim()
  if (!trimmed) return null

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${targets.sortOrder}), 0)` })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.date, day)))

  const [created] = await db
    .insert(targets)
    .values({
      userId,
      title: trimmed,
      date: day,
      originalDate: day,
      sortOrder: (max ?? 0) + 1,
      pillarId,
    })
    .returning()
  await upsertDailyStats(userId, day)
  revalidatePath("/")
  return created
}

/** Notify the user once when all of today's targets become completed. */
async function notifyAllCompleted(userId: string, day: string) {
  const message = `You completed all your targets for ${day}! 🎉`
  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, "all_completed"), eq(notifications.message, message)))
  if (!existing) await createNotification(userId, "all_completed", message)
}

/** Notify any friend whose point total `userId` just passed on the leaderboard. */
async function notifyOvertaken(userId: string, oldPoints: number, newPoints: number) {
  if (newPoints <= oldPoints) return
  const friendIds = await getFriendIds(userId)
  if (friendIds.length === 0) return

  const [friendPointsRows, [me]] = await Promise.all([
    db
      .select({ userId: targets.userId, points: sql<number>`coalesce(sum(${targets.points}), 0)` })
      .from(targets)
      .where(and(inArray(targets.userId, friendIds), eq(targets.completed, true)))
      .groupBy(targets.userId),
    db.select({ name: user.name }).from(user).where(eq(user.id, userId)),
  ])

  for (const row of friendPointsRows) {
    const friendPoints = Number(row.points)
    if (friendPoints >= oldPoints && friendPoints < newPoints) {
      await createNotification(row.userId, "overtaken", `${me.name} overtook you on the leaderboard! 🏆`)
    }
  }
}

export async function toggleTarget(id: number, completed: boolean, today?: string) {
  const userId = await getUserId()
  const day = today ?? (await getToday())

  const [targetRow] = await db
    .select({ points: targets.points })
    .from(targets)
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))

  await db
    .update(targets)
    .set({ completed, completedDate: completed ? day : null })
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
  const snapshot = await upsertDailyStats(userId, day)

  if (completed && targetRow) {
    if (snapshot.allCompleted) await notifyAllCompleted(userId, day)
    const newPoints = await getPoints(userId)
    await notifyOvertaken(userId, newPoints - targetRow.points, newPoints)
  }

  revalidatePath("/")
}

/**
 * Re-files a carried-over target as "today's" by updating its `originalDate`.
 * Used by the Backlog card's "Move to Today" action — the row already has
 * `date = today` (carry-over already moved it), this just stops it from
 * being grouped/flagged as overdue.
 */
export async function moveTargetToToday(id: number, today?: string) {
  const userId = await getUserId()
  const day = today ?? (await getToday())
  await db
    .update(targets)
    .set({ originalDate: day })
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
  revalidatePath("/")
}

export async function updateTargetTitle(id: number, title: string) {
  const userId = await getUserId()
  const trimmed = title.trim()
  if (!trimmed) return
  await db
    .update(targets)
    .set({ title: trimmed })
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
  revalidatePath("/")
}

export async function deleteTarget(id: number, today?: string) {
  const userId = await getUserId()
  const day = today ?? (await getToday())
  await db.delete(targets).where(and(eq(targets.id, id), eq(targets.userId, userId)))
  await upsertDailyStats(userId, day)
  revalidatePath("/")
}

/**
 * Total points = sum of points for every completed target across all days.
 */
export async function getPoints(userId: string) {
  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${targets.points}), 0)` })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.completed, true)))
  return Number(total ?? 0)
}

export async function getMyStats() {
  const userId = await getUserId()
  const today = await getToday()
  const [points, daily, statsRows, [me]] = await Promise.all([
    getPoints(userId),
    upsertDailyStats(userId, today),
    db
      .select({
        date: dailyStats.date,
        totalTargets: dailyStats.totalTargets,
        completedTargets: dailyStats.completedTargets,
        allCompleted: dailyStats.allCompleted,
      })
      .from(dailyStats)
      .where(eq(dailyStats.userId, userId)),
    db.select({ bestStreak: user.bestStreak }).from(user).where(eq(user.id, userId)),
  ])

  const streak = computeStreak(buildStatsMap(statsRows), today)
  if (streak > me.bestStreak) {
    await db.update(user).set({ bestStreak: streak }).where(eq(user.id, userId))
  }

  return {
    points,
    streak,
    bestStreak: Math.max(streak, me.bestStreak),
    dailyScore: daily.dailyScore,
    completionPercent: daily.totalTargets > 0 ? daily.completedTargets / daily.totalTargets : 0,
    totalTargets: daily.totalTargets,
    completedTargets: daily.completedTargets,
  }
}
