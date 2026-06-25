"use server"

import { and, asc, eq, gte, lt, sql } from "drizzle-orm"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { dailyStats, targets, pillars } from "@/lib/db/schema"
import { getToday, shiftDateString } from "@/lib/date"
import { upsertDailyStats } from "@/app/actions/targets"
import { computeStreak as computeGlobalStreak, buildStatsMap } from "@/lib/streak"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type DayStat = {
  date: string
  totalTargets: number
  completedTargets: number
  // Targets finished on their own day (completedDate === originalDate). Late
  // carry-over finishes are excluded; this drives the calendar heatmap so the
  // green dot means "done on the day", not "done eventually".
  onTimeCompleted: number
  completionPercent: number
  // onTimeCompleted / totalTargets — the fraction the heatmap colors by.
  onTimePercent: number
  dailyScore: number
  pointsEarned: number
}

/** Per-day stats for every recorded day in the given month, for the current user. */
export async function getMonthStats(year: number, month: number): Promise<DayStat[]> {
  const userId = await getUserId()

  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  // Recompute every day in this month that has targets, keyed on originalDate.
  // This self-heals the snapshot before we read it — including any past day the
  // old date-keyed aggregation left stuck at 100% (green) after its unfinished
  // targets were carried away — without needing a dashboard visit first. The
  // same pass also tallies on-time finishes (completedDate === originalDate;
  // legacy null completedDate counts as on-time, matching the day dialog) so the
  // heatmap can color by on-time completion rather than total completion.
  const monthDates = await db
    .select({
      date: targets.originalDate,
      onTime: sql<number>`count(*) filter (where ${targets.completed} and (${targets.completedDate} is null or ${targets.completedDate} = ${targets.originalDate}))`,
    })
    .from(targets)
    .where(and(eq(targets.userId, userId), gte(targets.originalDate, start), lt(targets.originalDate, end)))
    .groupBy(targets.originalDate)
  await Promise.all(monthDates.map(({ date }) => upsertDailyStats(userId, date)))
  const onTimeByDate = new Map(monthDates.map((r) => [r.date, Number(r.onTime)]))

  const rows = await db
    .select({
      date: dailyStats.date,
      totalTargets: dailyStats.totalTargets,
      completedTargets: dailyStats.completedTargets,
      pointsEarned: dailyStats.pointsEarned,
      dailyScore: dailyStats.dailyScore,
    })
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start), lt(dailyStats.date, end)))

  return rows.map((r) => {
    const onTimeCompleted = onTimeByDate.get(r.date) ?? 0
    return {
      ...r,
      onTimeCompleted,
      completionPercent: r.totalTargets > 0 ? r.completedTargets / r.totalTargets : 0,
      onTimePercent: r.totalTargets > 0 ? onTimeCompleted / r.totalTargets : 0,
    }
  })
}

export type DateTarget = {
  id: number
  title: string
  completed: boolean
  completedDate: string | null
  points: number
  pillarId: number
  pillarName: string
  pillarIcon: string
  pillarColor: string
}

/** All targets originally planned for the given day, with their current completion state. */
export async function getTargetsForDate(date: string): Promise<DateTarget[]> {
  const userId = await getUserId()

  return db
    .select({
      id: targets.id,
      title: targets.title,
      completed: targets.completed,
      completedDate: targets.completedDate,
      points: targets.points,
      pillarId: targets.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      pillarColor: pillars.color,
    })
    .from(targets)
    .innerJoin(pillars, eq(targets.pillarId, pillars.id))
    .where(and(eq(targets.userId, userId), eq(targets.originalDate, date)))
    .orderBy(asc(targets.sortOrder), asc(targets.id))
}

export type DayPillarStat = {
  date: string
  pillars: {
    pillarId: number
    name: string
    icon: string
    color: string
    completed: number
    total: number
  }[]
}

/** Per-day, per-pillar completion stats for every day in the given month. */
export async function getMonthPillarStats(year: number, month: number): Promise<DayPillarStat[]> {
  const userId = await getUserId()

  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  const rows = await db
    .select({
      date: targets.originalDate,
      pillarId: targets.pillarId,
      name: pillars.name,
      icon: pillars.icon,
      color: pillars.color,
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${targets.completed})`,
    })
    .from(targets)
    .innerJoin(pillars, eq(targets.pillarId, pillars.id))
    .where(and(eq(targets.userId, userId), gte(targets.originalDate, start), lt(targets.originalDate, end)))
    .groupBy(targets.originalDate, targets.pillarId, pillars.name, pillars.icon, pillars.color)

  const byDate = new Map<string, DayPillarStat["pillars"]>()
  for (const row of rows) {
    const list = byDate.get(row.date) ?? []
    list.push({
      pillarId: row.pillarId,
      name: row.name,
      icon: row.icon,
      color: row.color,
      completed: Number(row.completed),
      total: Number(row.total),
    })
    byDate.set(row.date, list)
  }

  return [...byDate.entries()].map(([date, pillarStats]) => ({ date, pillars: pillarStats }))
}

export type WeekDayTargets = {
  date: string
  targets: DateTarget[]
}

/** The Monday-Sunday week containing `dateInWeek`, with each day's targets grouped by pillar. */
export async function getWeekTargets(dateInWeek: string): Promise<WeekDayTargets[]> {
  const userId = await getUserId()

  const [y, m, d] = dateInWeek.split("-").map(Number)
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = shiftDateString(dateInWeek, mondayOffset)

  const days = Array.from({ length: 7 }, (_, i) => shiftDateString(monday, i))
  const start = days[0]
  const end = shiftDateString(days[6], 1)

  const rows = await db
    .select({
      date: targets.originalDate,
      id: targets.id,
      title: targets.title,
      completed: targets.completed,
      completedDate: targets.completedDate,
      points: targets.points,
      pillarId: targets.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      pillarColor: pillars.color,
    })
    .from(targets)
    .innerJoin(pillars, eq(targets.pillarId, pillars.id))
    .where(and(eq(targets.userId, userId), gte(targets.originalDate, start), lt(targets.originalDate, end)))
    .orderBy(asc(targets.sortOrder), asc(targets.id))

  const byDate = new Map<string, DateTarget[]>()
  for (const day of days) byDate.set(day, [])
  for (const row of rows) {
    byDate.get(row.date)?.push({
      id: row.id,
      title: row.title,
      completed: row.completed,
      completedDate: row.completedDate,
      points: row.points,
      pillarId: row.pillarId,
      pillarName: row.pillarName,
      pillarIcon: row.pillarIcon,
      pillarColor: row.pillarColor,
    })
  }

  return days.map((date) => ({ date, targets: byDate.get(date) ?? [] }))
}

// ---------------------------------------------------------------------------
// Per-pillar monthly stats with streak
// ---------------------------------------------------------------------------

function computeStreak(sortedDescDates: string[], today: string): number {
  if (sortedDescDates.length === 0) return 0
  const dateSet = new Set(sortedDescDates)
  const mostRecent = sortedDescDates[0]
  const [ry, rm, rd] = mostRecent.split("-").map(Number)
  const [ty, tm, td] = today.split("-").map(Number)
  const diff = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(ry, rm - 1, rd)) / 864e5)
  if (diff > 1) return 0
  let current = dateSet.has(today) ? today : mostRecent
  let count = 0
  while (dateSet.has(current)) {
    count++
    const [y, m, d] = current.split("-").map(Number)
    current = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  }
  return count
}

export type PillarFullStat = {
  pillarId: number
  name: string
  icon: string
  color: string
  totalTasks: number
  completedTasks: number
  pointsEarned: number
  currentStreak: number
  lastActivityDate: string | null
}

/**
 * Per-pillar aggregated stats for the month, plus current streak computed
 * from up to the last 365 days of completed-task history.
 */
export async function getMonthPillarFullStats(year: number, month: number): Promise<PillarFullStat[]> {
  const userId = await getUserId()
  const today = await getToday()

  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  const monthlyRows = await db
    .select({
      pillarId: targets.pillarId,
      name: pillars.name,
      icon: pillars.icon,
      color: pillars.color,
      totalTasks: sql<number>`count(*)`,
      completedTasks: sql<number>`count(*) filter (where ${targets.completed})`,
      pointsEarned: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
      lastActivityDate: sql<string>`max(${targets.originalDate})`,
    })
    .from(targets)
    .innerJoin(pillars, eq(targets.pillarId, pillars.id))
    .where(and(eq(targets.userId, userId), gte(targets.originalDate, start), lt(targets.originalDate, end)))
    .groupBy(targets.pillarId, pillars.name, pillars.icon, pillars.color)

  if (monthlyRows.length === 0) return []

  // Distinct (pillarId, date) pairs where ≥1 task was completed, last 365 days
  const streakRows = await db
    .select({ pillarId: targets.pillarId, date: targets.originalDate })
    .from(targets)
    .where(
      and(
        eq(targets.userId, userId),
        eq(targets.completed, true),
        gte(targets.originalDate, shiftDateString(today, -365)),
      )
    )
    .groupBy(targets.pillarId, targets.originalDate)
    .orderBy(asc(targets.originalDate))

  const streakDatesByPillar = new Map<number, string[]>()
  for (const row of streakRows) {
    const list = streakDatesByPillar.get(row.pillarId) ?? []
    list.push(row.date)
    streakDatesByPillar.set(row.pillarId, list)
  }
  for (const list of streakDatesByPillar.values()) list.reverse() // DESC for computeStreak

  return monthlyRows.map((row) => ({
    pillarId: row.pillarId,
    name: row.name,
    icon: row.icon,
    color: row.color,
    totalTasks: Number(row.totalTasks),
    completedTasks: Number(row.completedTasks),
    pointsEarned: Number(row.pointsEarned),
    currentStreak: computeStreak(streakDatesByPillar.get(row.pillarId) ?? [], today),
    lastActivityDate: row.lastActivityDate ?? null,
  }))
}

/** User's current all-day streak (all targets complete), based on daily_stats. */
export async function getCurrentStreak(): Promise<number> {
  const userId = await getUserId()
  const today = await getToday()
  const start = shiftDateString(today, -90)

  const rows = await db
    .select({
      date: dailyStats.date,
      totalTargets: dailyStats.totalTargets,
      completedTargets: dailyStats.completedTargets,
      allCompleted: dailyStats.allCompleted,
    })
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start)))

  return computeGlobalStreak(buildStatsMap(rows), today)
}
