import { and, eq, gte, lte, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { focusSessions, pillars } from "@/lib/db/schema"
import { getUserTimeZone } from "@/lib/date"
import { shiftDateString } from "@/lib/date-utils"

// ---------------------------------------------------------------------------
// Focus-time aggregation for the Calendar heatmaps.
//
// The single source of truth is `focus_sessions.startedAt` (a naive `timestamp`
// storing UTC wall-clock) and `durationSec`. Every bucket is computed in the
// user's IANA timezone: the column is reinterpreted as UTC and converted into
// the user's local wall-clock before truncation —
//   (startedAt AT TIME ZONE 'UTC') AT TIME ZONE $tz
// so a session at 11pm local lands on the right local day/week regardless of
// the server's zone. We never bucket on the `date` text column (that stays for
// the pillar-goals sessions counter).
// ---------------------------------------------------------------------------

/** Local-day bucket ('YYYY-MM-DD') of a session's start, in the user's tz. */
function localDayExpr(tz: string) {
  return sql<string>`to_char(date_trunc('day', (${focusSessions.startedAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), 'YYYY-MM-DD')`
}

/** Local ISO-week (Monday) bucket ('YYYY-MM-DD') of a session's start. */
function localWeekExpr(tz: string) {
  return sql<string>`to_char(date_trunc('week', (${focusSessions.startedAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), 'YYYY-MM-DD')`
}

/** ISO-week Monday (YYYY-MM-DD) for any date string. */
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  return shiftDateString(dateStr, dow === 0 ? -6 : 1 - dow)
}

export type WeeklyFocusPillar = {
  pillarId: number
  pillarName: string
  pillarColor: string
  /** Exactly 7 entries, Mon → Sun. */
  days: { date: string; totalSec: number }[]
  weekTotalSec: number
}

/**
 * Per-pillar focus for the Mon–Sun week containing `weekStart` (which must be
 * the Monday). Each pillar carries a fixed 7-cell Mon→Sun array; pillars with
 * no focus this week are omitted. Ordered by weekTotalSec desc.
 */
export async function getWeeklyFocusByPillar(userId: string, weekStart: string): Promise<WeeklyFocusPillar[]> {
  const tz = await getUserTimeZone()
  const weekEnd = shiftDateString(weekStart, 6)
  const day = localDayExpr(tz)

  const rows = await db
    .select({
      pillarId: focusSessions.pillarId,
      pillarName: pillars.name,
      pillarColor: pillars.color,
      day,
      totalSec: sql<number>`sum(${focusSessions.durationSec})::int`,
    })
    .from(focusSessions)
    .innerJoin(pillars, eq(focusSessions.pillarId, pillars.id))
    .where(and(eq(focusSessions.userId, userId), gte(day, weekStart), lte(day, weekEnd)))
    .groupBy(focusSessions.pillarId, pillars.name, pillars.color, day)

  const days7 = Array.from({ length: 7 }, (_, i) => shiftDateString(weekStart, i))
  const byPillar = new Map<
    number,
    { pillarId: number; pillarName: string; pillarColor: string; totals: Map<string, number> }
  >()
  for (const r of rows) {
    const e =
      byPillar.get(r.pillarId) ??
      { pillarId: r.pillarId, pillarName: r.pillarName, pillarColor: r.pillarColor, totals: new Map() }
    e.totals.set(r.day, Number(r.totalSec))
    byPillar.set(r.pillarId, e)
  }

  return [...byPillar.values()]
    .map((e) => {
      const days = days7.map((date) => ({ date, totalSec: e.totals.get(date) ?? 0 }))
      const weekTotalSec = days.reduce((s, d) => s + d.totalSec, 0)
      return { pillarId: e.pillarId, pillarName: e.pillarName, pillarColor: e.pillarColor, days, weekTotalSec }
    })
    .sort((a, b) => b.weekTotalSec - a.weekTotalSec)
}

/** Totals across all pillars for the Mon–Sun week containing `weekStart`. */
export async function getWeeklyFocusTotal(
  userId: string,
  weekStart: string
): Promise<{ totalSec: number; sessionCount: number }> {
  const tz = await getUserTimeZone()
  const weekEnd = shiftDateString(weekStart, 6)
  const day = localDayExpr(tz)

  const [row] = await db
    .select({
      totalSec: sql<number>`coalesce(sum(${focusSessions.durationSec}), 0)::int`,
      sessionCount: sql<number>`count(*)::int`,
    })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), gte(day, weekStart), lte(day, weekEnd)))

  return { totalSec: Number(row?.totalSec ?? 0), sessionCount: Number(row?.sessionCount ?? 0) }
}

export type MonthlyFocusPillar = {
  pillarId: number
  pillarName: string
  pillarColor: string
  /** One entry per ISO week the month spans (weekIndex is 0-based). */
  weeks: { weekIndex: number; totalSec: number }[]
  monthTotalSec: number
}

/**
 * Per-pillar focus for the calendar month starting at `monthStart` (YYYY-MM-01),
 * bucketed into the ISO weeks the month spans. The number of week buckets is
 * dynamic (4–6) — derived from the month's calendar, not from the data, so every
 * pillar row shares the same n columns even when a spanned week has no focus.
 * Pillars with no focus this month are omitted. Ordered by monthTotalSec desc.
 */
export async function getMonthlyFocusByPillarByWeek(
  userId: string,
  monthStart: string
): Promise<MonthlyFocusPillar[]> {
  const tz = await getUserTimeZone()
  const [y, m] = monthStart.split("-").map(Number)
  // Last day of the month = day before the 1st of the next month.
  const monthEnd = shiftDateString(new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10), -1)

  // Week columns: every ISO-week Monday from the week of the 1st through the
  // week of the last day.
  const weekStarts: string[] = []
  const lastMonday = mondayOf(monthEnd)
  for (let cursor = mondayOf(monthStart); cursor <= lastMonday; cursor = shiftDateString(cursor, 7)) {
    weekStarts.push(cursor)
  }
  const weekIndexOf = new Map(weekStarts.map((ws, i) => [ws, i]))

  const day = localDayExpr(tz)
  const week = localWeekExpr(tz)

  const rows = await db
    .select({
      pillarId: focusSessions.pillarId,
      pillarName: pillars.name,
      pillarColor: pillars.color,
      week,
      totalSec: sql<number>`sum(${focusSessions.durationSec})::int`,
    })
    .from(focusSessions)
    .innerJoin(pillars, eq(focusSessions.pillarId, pillars.id))
    .where(and(eq(focusSessions.userId, userId), gte(day, monthStart), lte(day, monthEnd)))
    .groupBy(focusSessions.pillarId, pillars.name, pillars.color, week)

  const byPillar = new Map<
    number,
    { pillarId: number; pillarName: string; pillarColor: string; totals: Map<number, number> }
  >()
  for (const r of rows) {
    const idx = weekIndexOf.get(r.week)
    if (idx === undefined) continue // defensive: session's week outside the span
    const e =
      byPillar.get(r.pillarId) ??
      { pillarId: r.pillarId, pillarName: r.pillarName, pillarColor: r.pillarColor, totals: new Map() }
    e.totals.set(idx, (e.totals.get(idx) ?? 0) + Number(r.totalSec))
    byPillar.set(r.pillarId, e)
  }

  return [...byPillar.values()]
    .map((e) => {
      const weeks = weekStarts.map((_, i) => ({ weekIndex: i, totalSec: e.totals.get(i) ?? 0 }))
      const monthTotalSec = weeks.reduce((s, w) => s + w.totalSec, 0)
      return { pillarId: e.pillarId, pillarName: e.pillarName, pillarColor: e.pillarColor, weeks, monthTotalSec }
    })
    .sort((a, b) => b.monthTotalSec - a.monthTotalSec)
}
