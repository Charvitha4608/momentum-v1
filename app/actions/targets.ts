"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { targets, dailyStats, notifications, user, pillars, recurringTasks, focusSessions } from "@/lib/db/schema"
import { and, asc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm"
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
 * `targets` rows whose `originalDate` is that date. Keying on `originalDate`
 * (immutable) rather than `date` (mutated by carry-over) means a day's stats
 * always reflect the targets planned for it, even after unfinished ones are
 * re-dated forward — otherwise a past day would inflate to 100% once its
 * incomplete targets were carried away, leaving only the completed ones behind.
 */
export async function upsertDailyStats(userId: string, date: string) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${targets.completed})`,
      pointsEarned: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
    })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.originalDate, date)))

  const snapshot = scoreSnapshot(Number(stats.total), Number(stats.completed), Number(stats.pointsEarned))

  await db
    .insert(dailyStats)
    .values({ userId, date, ...snapshot })
    .onConflictDoUpdate({ target: [dailyStats.userId, dailyStats.date], set: snapshot })

  return snapshot
}

/**
 * Recompute the `daily_stats` snapshot for every past original-day. Snapshots
 * are keyed on `originalDate`, so this is now idempotent (carry-over no longer
 * corrupts past days); it remains as a self-healing pass that keeps history
 * accurate and repairs any stale rows.
 */
async function freezeDailyStats(userId: string, today: string) {
  const pastDates = await db
    .select({ date: targets.originalDate })
    .from(targets)
    .where(and(eq(targets.userId, userId), lt(targets.originalDate, today)))
    .groupBy(targets.originalDate)

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
      // Inherit the recurring template's scheduling hints so the AI Planner
      // can pack generated targets without re-asking for duration/time-of-day.
      durationMinutes: task.durationMinutes,
      preferredTimeOfDay: task.preferredTimeOfDay,
      // Carry the template's quantity and goal link so each completed session
      // advances its long-term goal by `quantity` (see getLongTermGoals).
      quantity: task.quantity,
      longTermGoalId: task.longTermGoalId,
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
      quantity: targets.quantity,
      estimatedMinutes: targets.estimatedMinutes,
      actualMinutes: targets.actualMinutes,
      sessionsCompleted: targets.sessionsCompleted,
      longTermGoalId: targets.longTermGoalId,
      durationMinutes: targets.durationMinutes,
      preferredTimeOfDay: targets.preferredTimeOfDay,
      deadline: targets.deadline,
      scheduledStart: targets.scheduledStart,
    })
    .from(targets)
    .innerJoin(pillars, eq(targets.pillarId, pillars.id))
    .where(and(eq(targets.userId, userId), eq(targets.date, day)))
    .orderBy(asc(targets.sortOrder), asc(targets.id))
}

/**
 * The nearest still-open targets planned for a *future* day — what the "Get
 * ahead" card offers up for early completion.
 *
 * Filtered on `originalDate` (immutable) rather than `date`: a postponed
 * backlog task has a future `date` but a past `originalDate`, and it belongs to
 * the backlog's history, not here. Overdue work is likewise excluded — it
 * already surfaces in the Backlog card. Generated recurring instances are
 * skipped so the card stays a list of deliberately-planned work.
 */
export async function getUpcomingTargets(today?: string, limit = 5) {
  const userId = await getUserId()
  const day = today ?? (await getToday())
  return db
    .select({
      id: targets.id,
      title: targets.title,
      originalDate: targets.originalDate,
      points: targets.points,
      pillarName: pillars.name,
      pillarColor: pillars.color,
    })
    .from(targets)
    .innerJoin(pillars, eq(targets.pillarId, pillars.id))
    .where(
      and(
        eq(targets.userId, userId),
        gt(targets.originalDate, day),
        eq(targets.completed, false),
        isNull(targets.recurringTaskId)
      )
    )
    .orderBy(asc(targets.originalDate), asc(targets.sortOrder), asc(targets.id))
    .limit(limit)
}

export type UpcomingTarget = Awaited<ReturnType<typeof getUpcomingTargets>>[number]

export type TargetSchedulingMeta = {
  durationMinutes?: number | null
  preferredTimeOfDay?: string | null
  deadline?: string | null
}

export type TargetEffortMeta = {
  quantity?: number
  estimatedMinutes?: number | null
  longTermGoalId?: number | null
}

export async function addTarget(
  title: string,
  pillarId: number,
  today?: string,
  meta?: TargetSchedulingMeta,
  effort?: TargetEffortMeta
) {
  const userId = await getUserId()
  const day = today ?? (await getToday())
  const trimmed = title.trim()
  if (!trimmed) return null

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${targets.sortOrder}), 0)` })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.date, day)))

  const quantity = effort?.quantity && effort.quantity > 0 ? Math.round(effort.quantity) : 1

  const [created] = await db
    .insert(targets)
    .values({
      userId,
      title: trimmed,
      date: day,
      originalDate: day,
      sortOrder: (max ?? 0) + 1,
      pillarId,
      quantity,
      estimatedMinutes: effort?.estimatedMinutes ?? null,
      longTermGoalId: effort?.longTermGoalId ?? null,
      // The single Estimate field is the source of truth for scheduling too:
      // mirror it into the planner's `durationMinutes` (which no longer has its
      // own input) so the AI Planner still sees the user's time estimate.
      durationMinutes: meta?.durationMinutes ?? effort?.estimatedMinutes ?? null,
      preferredTimeOfDay: meta?.preferredTimeOfDay ?? null,
      deadline: meta?.deadline ?? null,
    })
    .returning()
  await upsertDailyStats(userId, day)
  revalidatePath("/")
  return created
}

export type TargetDetails = {
  pillarId?: number
  quantity?: number
  estimatedMinutes?: number | null
  longTermGoalId?: number | null
  durationMinutes?: number | null
  preferredTimeOfDay?: string | null
}

/**
 * Update an existing target's editable details (pillar + effort/scheduling
 * fields) in one call. Each field is only written when provided, so callers can
 * send a partial patch. Used by the per-row "edit details" popover so any
 * target — including AI-generated ones — can be reshaped after creation.
 */
export async function updateTargetDetails(id: number, details: TargetDetails) {
  const userId = await getUserId()
  const set: Partial<typeof targets.$inferInsert> = {}
  if (details.pillarId !== undefined) set.pillarId = details.pillarId
  if (details.quantity !== undefined) set.quantity = details.quantity > 0 ? Math.round(details.quantity) : 1
  if (details.estimatedMinutes !== undefined) set.estimatedMinutes = details.estimatedMinutes
  if (details.longTermGoalId !== undefined) set.longTermGoalId = details.longTermGoalId
  if (details.preferredTimeOfDay !== undefined) set.preferredTimeOfDay = details.preferredTimeOfDay
  // The Estimate field is the single source of truth; mirror a concrete estimate
  // into the planner's `durationMinutes` so scheduling stays in sync. A null or
  // absent estimate leaves any planner-assigned duration untouched (a legacy
  // caller may still pass an explicit durationMinutes).
  if (typeof details.estimatedMinutes === "number") set.durationMinutes = details.estimatedMinutes
  else if (details.durationMinutes !== undefined) set.durationMinutes = details.durationMinutes

  if (Object.keys(set).length === 0) return
  await db.update(targets).set(set).where(and(eq(targets.id, id), eq(targets.userId, userId)))
  revalidatePath("/")
}

/**
 * Precise per-session timing captured client-side by the focus provider, used
 * to populate the `focus_sessions` timing columns that the Focus heatmaps
 * aggregate on. Optional so the action degrades gracefully if ever called
 * without it (the row still logs, deriving durationSec from `minutes`).
 */
export type FocusSessionTiming = {
  /** Actual focused seconds: floor((ended - started - paused) / 1000). */
  durationSec: number
  /** True when the timer ran to (near) its natural end. */
  completed: boolean
  /** Epoch ms when the session started. */
  startedAtMs: number
  /** Epoch ms when the session ended. */
  endedAtMs: number
  /** When true, also bump the target's whole `sessionsCompleted` counter by 1. */
  creditsSession?: boolean
}

/**
 * Record a completed Pomodoro focus session against a target: add its minutes
 * to the target's `actualMinutes` (incrementing whatever is there; null counts
 * as 0) AND log one `focus_sessions` row so sessions-mode pillar goals have
 * something to count. The session's pillar is copied from the target so it
 * still counts toward the pillar goal if the target is later deleted, and its
 * `date` is today (window key for the rolling cycle). When `timing` is provided
 * the row also stores the precise `startedAt`/`endedAt`/`durationSec`/`completed`
 * that the Focus heatmaps bucket on (by `startedAt`, in the user's timezone).
 * Completion state is untouched. Sessions shorter than a minute are ignored.
 */
export async function recordFocusSession(id: number, minutes: number, timing?: FocusSessionTiming) {
  const add = Math.round(minutes)
  if (!Number.isFinite(add) || add < 1) return
  const userId = await getUserId()

  const [target] = await db
    .select({ pillarId: targets.pillarId })
    .from(targets)
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
    .limit(1)
  if (!target) return

  const today = await getToday()
  await db
    .update(targets)
    .set({
      actualMinutes: sql`coalesce(${targets.actualMinutes}, 0) + ${add}`,
      // A block whose countdown completed (or that finished the task) credits a
      // whole session; abandoning a fresh block early records minutes only.
      ...(timing?.creditsSession ? { sessionsCompleted: sql`${targets.sessionsCompleted} + 1` } : {}),
    })
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
  await db.insert(focusSessions).values({
    userId,
    targetId: id,
    pillarId: target.pillarId,
    minutes: add,
    date: today,
    startedAt: timing ? new Date(timing.startedAtMs) : undefined,
    endedAt: timing ? new Date(timing.endedAtMs) : undefined,
    durationSec: timing ? Math.max(0, Math.floor(timing.durationSec)) : add * 60,
    completed: timing?.completed ?? false,
  })

  revalidatePath("/")
  revalidatePath("/goals")
  revalidatePath("/reflection")
  revalidatePath("/calendar")
}

/** Update a target's planner metadata (duration / time-of-day / deadline). */
export async function updateTargetSchedulingMeta(id: number, meta: TargetSchedulingMeta) {
  const userId = await getUserId()
  await db
    .update(targets)
    .set({
      ...(meta.durationMinutes !== undefined ? { durationMinutes: meta.durationMinutes } : {}),
      ...(meta.preferredTimeOfDay !== undefined ? { preferredTimeOfDay: meta.preferredTimeOfDay } : {}),
      ...(meta.deadline !== undefined ? { deadline: meta.deadline } : {}),
    })
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
  revalidatePath("/")
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

export async function toggleTarget(
  id: number,
  completed: boolean,
  today?: string,
  actualMinutes?: number | null
) {
  const userId = await getUserId()
  // The real current day. `today`/`day` below is the day the user is acting
  // *from* (today's list, a backlog row, or a calendar day-detail) and only
  // gates the "all done today" celebration. `completedDate`, however, must be
  // the actual day the box was checked so finishing a future task early reads
  // as "ahead" and a carried-over task reads as "late" (see lib/completion).
  const realToday = await getToday()
  const day = today ?? realToday

  const [targetRow] = await db
    .select({ points: targets.points, originalDate: targets.originalDate })
    .from(targets)
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))

  // `actualMinutes` semantics: `undefined` leaves the stored value untouched, so
  // minutes summed by focus sessions survive a plain check or uncheck. An
  // explicit number sets it (used when the user types a value at completion); an
  // explicit `null` clears it. This stops a completion prompt — or an uncheck —
  // from wiping focus-accumulated minutes.
  const minutesUpdate: { actualMinutes?: number | null } =
    actualMinutes === undefined
      ? {}
      : {
          actualMinutes:
            completed && actualMinutes != null && Number.isFinite(actualMinutes) && actualMinutes >= 0
              ? Math.round(actualMinutes)
              : null,
        }

  await db
    .update(targets)
    .set({ completed, completedDate: completed ? realToday : null, ...minutesUpdate })
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
  // Stats are keyed on the target's original day, so a carried-over backlog
  // task counts toward the day it was planned for, not today.
  const snapshot = targetRow ? await upsertDailyStats(userId, targetRow.originalDate) : null

  if (completed && targetRow) {
    // Only celebrate "all done" for a task that belongs to today, completed today.
    if (targetRow.originalDate === day && day === realToday && snapshot?.allCompleted)
      await notifyAllCompleted(userId, day)
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
  const [row] = await db
    .select({ originalDate: targets.originalDate })
    .from(targets)
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
  await db
    .update(targets)
    .set({ originalDate: day })
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
  // Re-homing the target's original day moves it between two days' stats:
  // refresh today and the day it left.
  await upsertDailyStats(userId, day)
  if (row && row.originalDate !== day) await upsertDailyStats(userId, row.originalDate)
  revalidatePath("/")
}

/**
 * Postpone a carried-over backlog target to a chosen future day. Sets `date`
 * to that day so it drops off today's list and the backlog, then resurfaces in
 * the month calendar on the picked day (and on the dashboard once that day
 * arrives, via carry-over). `originalDate` is left untouched so history still
 * records it as planned for — and missed on — its original day, and `daily_stats`
 * (keyed on `originalDate`) is unaffected. Only future days are accepted.
 */
export async function postponeTarget(id: number, date: string, today?: string) {
  const userId = await getUserId()
  const day = today ?? (await getToday())
  if (date <= day) return
  await db
    .update(targets)
    .set({ date })
    .where(and(eq(targets.id, id), eq(targets.userId, userId), eq(targets.completed, false)))
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
  const [row] = await db
    .select({ originalDate: targets.originalDate })
    .from(targets)
    .where(and(eq(targets.id, id), eq(targets.userId, userId)))
  await db.delete(targets).where(and(eq(targets.id, id), eq(targets.userId, userId)))
  // Refresh the snapshot for the day this target belonged to (its original day).
  if (row) await upsertDailyStats(userId, row.originalDate)
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
