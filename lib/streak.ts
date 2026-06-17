import { shiftDateString } from "@/lib/date"

export type DayStats = {
  totalTargets: number
  completedTargets: number
  allCompleted: boolean
}

/**
 * Current streak: walks backward day by day from `today`.
 * - A day with `allCompleted = true` extends the streak.
 * - A day with targets but not all completed breaks the streak.
 * - A day with zero targets (missing entry, or totalTargets === 0) is
 *   neutral - it's skipped without extending or breaking the streak.
 * Today is only counted if it's already fully completed; otherwise it's
 * treated as neutral (in progress) and the walk continues from yesterday.
 * The walk stops once it passes the earliest date present in `statsByDate`.
 */
export function computeStreak(statsByDate: Map<string, DayStats>, today: string): number {
  let streak = 0

  if (statsByDate.get(today)?.allCompleted) streak++

  let minDate: string | undefined
  for (const date of statsByDate.keys()) {
    if (!minDate || date < minDate) minDate = date
  }
  if (!minDate) return streak

  let cursor = shiftDateString(today, -1)
  while (cursor >= minDate) {
    const stats = statsByDate.get(cursor)
    if (!stats || stats.totalTargets === 0) {
      cursor = shiftDateString(cursor, -1)
      continue
    }
    if (stats.allCompleted) {
      streak++
      cursor = shiftDateString(cursor, -1)
    } else {
      break
    }
  }
  return streak
}

/** Builds a date -> DayStats map from rows shaped like the `daily_stats` table. */
export function buildStatsMap(
  rows: { date: string; totalTargets: number; completedTargets: number; allCompleted: boolean }[]
): Map<string, DayStats> {
  const map = new Map<string, DayStats>()
  for (const row of rows) {
    map.set(row.date, {
      totalTargets: row.totalTargets,
      completedTargets: row.completedTargets,
      allCompleted: row.allCompleted,
    })
  }
  return map
}
