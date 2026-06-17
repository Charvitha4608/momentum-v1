"use server"

import { and, desc, eq, gte, sql } from "drizzle-orm"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { dailyStats, notifications, pillarGoals, pillars, targets, weeklyReviews } from "@/lib/db/schema"
import { daysBetween, getToday, getWeekRange, shiftDateString } from "@/lib/date"
import { buildStatsMap, computeStreak } from "@/lib/streak"
import { createNotification } from "@/app/actions/notifications"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/** [start, end) for the calendar month containing `dateStr`. */
function monthRange(dateStr: string): { start: string; end: string } {
  const [year, month] = dateStr.split("-").map(Number)
  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  return { start, end }
}

export type EffortComparisonRow = {
  pillarId: number
  pillarName: string
  pillarIcon: string
  pillarColor: string
  desiredPercent: number
  actualPercent: number
  percentOfTarget: number
}

/**
 * Desired vs actual effort for the current month, one row per pillar with an
 * active pillar goal. Desired% is each goal's share of the total target value
 * across all active goals; actual% is each goal-pillar's share of points
 * earned this month across ALL pillars (so effort spent outside goal pillars
 * lowers the actual% of goal pillars too).
 */
export async function getEffortComparison(): Promise<EffortComparisonRow[]> {
  const userId = await getUserId()
  const today = await getToday()
  const { start, end } = monthRange(today)

  const goals = await db
    .select({
      pillarId: pillarGoals.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      pillarColor: pillars.color,
      targetValue: pillarGoals.targetValue,
    })
    .from(pillarGoals)
    .innerJoin(pillars, eq(pillarGoals.pillarId, pillars.id))
    .where(and(eq(pillarGoals.userId, userId), eq(pillarGoals.active, true)))

  if (goals.length === 0) return []

  const totalTarget = goals.reduce((sum, g) => sum + g.targetValue, 0)

  const pointsRows = await db
    .select({
      pillarId: targets.pillarId,
      points: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
    })
    .from(targets)
    .where(and(eq(targets.userId, userId), gte(targets.originalDate, start), sql`${targets.originalDate} < ${end}`))
    .groupBy(targets.pillarId)

  const pointsMap = new Map(pointsRows.map((r) => [r.pillarId, Number(r.points)]))
  const totalPoints = pointsRows.reduce((sum, r) => sum + Number(r.points), 0)

  return goals.map((g) => {
    const points = pointsMap.get(g.pillarId) ?? 0
    const desiredPercent = totalTarget > 0 ? (g.targetValue / totalTarget) * 100 : 0
    const actualPercent = totalPoints > 0 ? (points / totalPoints) * 100 : 0
    const percentOfTarget = desiredPercent > 0 ? (actualPercent / desiredPercent) * 100 : 0
    return {
      pillarId: g.pillarId,
      pillarName: g.pillarName,
      pillarIcon: g.pillarIcon,
      pillarColor: g.pillarColor,
      desiredPercent: Math.round(desiredPercent),
      actualPercent: Math.round(actualPercent),
      percentOfTarget: Math.round(percentOfTarget),
    }
  })
}

/**
 * Balance Score = 100 - (sum of |actual% - desired%| across goal pillars) / 2,
 * clamped to 0-100. `null` when no active pillar goals exist (no "intended"
 * distribution to measure against).
 */
export async function getBalanceScore(): Promise<number | null> {
  const rows = await getEffortComparison()
  if (rows.length === 0) return null

  const diffSum = rows.reduce((sum, r) => sum + Math.abs(r.actualPercent - r.desiredPercent), 0)
  const score = 100 - diffSum / 2
  return Math.max(0, Math.min(100, Math.round(score)))
}

export type PillarBreakdownRow = {
  pillarId: number
  pillarName: string
  pillarIcon: string
  pillarColor: string
  points: number
  percent: number
}

async function breakdownForRange(userId: string, start: string, end: string): Promise<PillarBreakdownRow[]> {
  const activePillars = await db
    .select({ id: pillars.id, name: pillars.name, icon: pillars.icon, color: pillars.color })
    .from(pillars)
    .where(and(eq(pillars.userId, userId), eq(pillars.archived, false)))
    .orderBy(pillars.sortOrder, pillars.id)

  const pointsRows = await db
    .select({
      pillarId: targets.pillarId,
      points: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
    })
    .from(targets)
    .where(and(eq(targets.userId, userId), gte(targets.originalDate, start), sql`${targets.originalDate} < ${end}`))
    .groupBy(targets.pillarId)

  const pointsMap = new Map(pointsRows.map((r) => [r.pillarId, Number(r.points)]))
  const totalPoints = [...pointsMap.values()].reduce((sum, v) => sum + v, 0)

  return activePillars.map((p) => {
    const points = pointsMap.get(p.id) ?? 0
    return {
      pillarId: p.id,
      pillarName: p.name,
      pillarIcon: p.icon,
      pillarColor: p.color,
      points,
      percent: totalPoints > 0 ? Math.round((points / totalPoints) * 100) : 0,
    }
  })
}

function mostActive(rows: PillarBreakdownRow[]): PillarBreakdownRow | null {
  if (rows.length === 0 || rows.every((r) => r.points === 0)) return null
  return rows.reduce((max, r) => (r.points > max.points ? r : max))
}

function leastActive(rows: PillarBreakdownRow[]): PillarBreakdownRow | null {
  if (rows.length === 0 || rows.every((r) => r.points === 0)) return null
  return rows.reduce((min, r) => (r.points < min.points ? r : min))
}

export type WeeklyBreakdown = {
  week: PillarBreakdownRow[]
  month: PillarBreakdownRow[]
  weekMostActive: PillarBreakdownRow | null
  weekLeastActive: PillarBreakdownRow | null
  monthMostActive: PillarBreakdownRow | null
  monthLeastActive: PillarBreakdownRow | null
}

/** Per-pillar share of points earned this week (Sun-Sat) and this month. */
export async function getWeeklyBreakdown(): Promise<WeeklyBreakdown> {
  const userId = await getUserId()
  const today = await getToday()

  const { start: weekStart, end: weekEndInclusive } = getWeekRange(today)
  const weekEnd = shiftDateString(weekEndInclusive, 1)
  const { start: monthStart, end: monthEnd } = monthRange(today)

  const [week, month] = await Promise.all([
    breakdownForRange(userId, weekStart, weekEnd),
    breakdownForRange(userId, monthStart, monthEnd),
  ])

  return {
    week,
    month,
    weekMostActive: mostActive(week),
    weekLeastActive: leastActive(week),
    monthMostActive: mostActive(month),
    monthLeastActive: leastActive(month),
  }
}

export type NeglectedPillar = {
  pillarId: number
  pillarName: string
  pillarIcon: string
  pillarColor: string
  daysSinceLastActivity: number
  message: string
}

const NEGLECTED_THRESHOLD_DAYS = 5

/**
 * Pillars with no completed target in the last 5+ days. Also creates a
 * deduped "neglected_pillar" notification per qualifying pillar (skipped if
 * one was already created for that pillar in the last 5 days).
 */
export async function getNeglectedPillars(): Promise<NeglectedPillar[]> {
  const userId = await getUserId()
  const today = await getToday()

  const activePillars = await db
    .select()
    .from(pillars)
    .where(and(eq(pillars.userId, userId), eq(pillars.archived, false)))

  if (activePillars.length === 0) return []

  const lastActivityRows = await db
    .select({ pillarId: targets.pillarId, lastDate: sql<string>`max(${targets.originalDate})` })
    .from(targets)
    .where(and(eq(targets.userId, userId), eq(targets.completed, true)))
    .groupBy(targets.pillarId)

  const lastActivityMap = new Map(lastActivityRows.map((r) => [r.pillarId, r.lastDate]))
  const fiveDaysAgo = new Date(Date.now() - NEGLECTED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

  const result: NeglectedPillar[] = []
  for (const p of activePillars) {
    const lastDate = lastActivityMap.get(p.id) ?? p.createdAt.toISOString().slice(0, 10)
    const daysSince = daysBetween(lastDate, today)
    if (daysSince < NEGLECTED_THRESHOLD_DAYS) continue

    const message = `You haven't touched ${p.name} in ${daysSince} days.`
    result.push({
      pillarId: p.id,
      pillarName: p.name,
      pillarIcon: p.icon,
      pillarColor: p.color,
      daysSinceLastActivity: daysSince,
      message,
    })

    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "neglected_pillar"),
          eq(notifications.relatedId, p.id),
          gte(notifications.createdAt, fiveDaysAgo)
        )
      )
    if (!existing) await createNotification(userId, "neglected_pillar", message, p.id)
  }

  return result
}

const MAX_WEEKLY_REVIEWS = 52

/**
 * Backfills `weeklyReviews` rows for every fully-completed Sun-Sat week since
 * the user's first recorded day, capped to the last 52 weeks. Called once on
 * Reflection-page load.
 */
export async function generateMissingWeeklyReviews() {
  const userId = await getUserId()
  const today = await getToday()

  const [earliest] = await db
    .select({ date: sql<string | null>`min(${dailyStats.date})` })
    .from(dailyStats)
    .where(eq(dailyStats.userId, userId))

  if (!earliest?.date) return

  const thisWeekStart = getWeekRange(today).start
  const lastCompletedWeekEnd = shiftDateString(thisWeekStart, -1)
  if (lastCompletedWeekEnd < earliest.date) return

  const lastCompletedWeekStart = shiftDateString(lastCompletedWeekEnd, -6)
  let weekStart = getWeekRange(earliest.date).start

  const earliestAllowedStart = shiftDateString(lastCompletedWeekStart, -7 * (MAX_WEEKLY_REVIEWS - 1))
  if (weekStart < earliestAllowedStart) weekStart = earliestAllowedStart

  const existing = await db
    .select({ weekStart: weeklyReviews.weekStart })
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.userId, userId), gte(weeklyReviews.weekStart, weekStart)))
  const existingSet = new Set(existing.map((r) => r.weekStart))

  const statsRows = await db
    .select({
      date: dailyStats.date,
      totalTargets: dailyStats.totalTargets,
      completedTargets: dailyStats.completedTargets,
      allCompleted: dailyStats.allCompleted,
      pointsEarned: dailyStats.pointsEarned,
      dailyScore: dailyStats.dailyScore,
    })
    .from(dailyStats)
    .where(eq(dailyStats.userId, userId))
  const statsMap = buildStatsMap(statsRows)
  const statsByDate = new Map(statsRows.map((r) => [r.date, r]))

  while (weekStart <= lastCompletedWeekStart) {
    if (!existingSet.has(weekStart)) {
      const weekEnd = shiftDateString(weekStart, 6)
      await createWeeklyReview(userId, weekStart, weekEnd, statsMap, statsByDate)
    }
    weekStart = shiftDateString(weekStart, 7)
  }
}

async function createWeeklyReview(
  userId: string,
  weekStart: string,
  weekEnd: string,
  statsMap: Map<string, { totalTargets: number; completedTargets: number; allCompleted: boolean }>,
  statsByDate: Map<string, { totalTargets: number; completedTargets: number; pointsEarned: number; dailyScore: number }>
) {
  const weekEndExclusive = shiftDateString(weekEnd, 1)

  let pointsEarned = 0
  let tasksCompleted = 0
  let bestDay: string | null = null
  let bestScore = -1
  for (let d = weekStart; d < weekEndExclusive; d = shiftDateString(d, 1)) {
    const s = statsByDate.get(d)
    if (!s) continue
    pointsEarned += s.pointsEarned
    tasksCompleted += s.completedTargets
    if (s.totalTargets > 0 && s.dailyScore > bestScore) {
      bestScore = s.dailyScore
      bestDay = d
    }
  }

  const pillarRows = await db
    .select({
      pillarId: targets.pillarId,
      points: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
    })
    .from(targets)
    .where(
      and(eq(targets.userId, userId), gte(targets.originalDate, weekStart), sql`${targets.originalDate} < ${weekEndExclusive}`)
    )
    .groupBy(targets.pillarId)

  let mostActivePillarId: number | null = null
  let leastActivePillarId: number | null = null
  if (pillarRows.length > 0) {
    let max = pillarRows[0]
    let min = pillarRows[0]
    for (const r of pillarRows) {
      if (Number(r.points) > Number(max.points)) max = r
      if (Number(r.points) < Number(min.points)) min = r
    }
    mostActivePillarId = max.pillarId
    leastActivePillarId = min.pillarId
  }

  const currentStreak = computeStreak(statsMap, weekEnd)

  await db
    .insert(weeklyReviews)
    .values({ userId, weekStart, weekEnd, pointsEarned, tasksCompleted, mostActivePillarId, leastActivePillarId, currentStreak, bestDay })
    .onConflictDoNothing()
}

export type WeeklyReview = {
  id: number
  weekStart: string
  weekEnd: string
  pointsEarned: number
  tasksCompleted: number
  currentStreak: number
  bestDay: string | null
  mostActivePillar: { id: number; name: string; icon: string; color: string } | null
  leastActivePillar: { id: number; name: string; icon: string; color: string } | null
}

/** All weekly reviews for the current user, most recent first. */
export async function getWeeklyReviews(): Promise<WeeklyReview[]> {
  const userId = await getUserId()

  const [rows, pillarRows] = await Promise.all([
    db
      .select({
        id: weeklyReviews.id,
        weekStart: weeklyReviews.weekStart,
        weekEnd: weeklyReviews.weekEnd,
        pointsEarned: weeklyReviews.pointsEarned,
        tasksCompleted: weeklyReviews.tasksCompleted,
        currentStreak: weeklyReviews.currentStreak,
        bestDay: weeklyReviews.bestDay,
        mostActivePillarId: weeklyReviews.mostActivePillarId,
        leastActivePillarId: weeklyReviews.leastActivePillarId,
      })
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, userId))
      .orderBy(desc(weeklyReviews.weekStart)),
    db.select({ id: pillars.id, name: pillars.name, icon: pillars.icon, color: pillars.color }).from(pillars).where(eq(pillars.userId, userId)),
  ])

  const pillarMap = new Map(pillarRows.map((p) => [p.id, p]))

  return rows.map((r) => ({
    id: r.id,
    weekStart: r.weekStart,
    weekEnd: r.weekEnd,
    pointsEarned: r.pointsEarned,
    tasksCompleted: r.tasksCompleted,
    currentStreak: r.currentStreak,
    bestDay: r.bestDay,
    mostActivePillar: r.mostActivePillarId != null ? pillarMap.get(r.mostActivePillarId) ?? null : null,
    leastActivePillar: r.leastActivePillarId != null ? pillarMap.get(r.leastActivePillarId) ?? null : null,
  }))
}
