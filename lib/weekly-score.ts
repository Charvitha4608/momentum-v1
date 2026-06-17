import type { DayStat } from "@/app/actions/history"

export type WeekScore = {
  weekIndex: number
  startDay: number
  endDay: number
  totalPoints: number
  totalTasks: number
  score: number
}

/**
 * Groups a month's days into calendar weeks (Sun-Sat, aligned to the History
 * calendar grid) and computes Weekly Score = Total Points Earned / Total
 * Tasks Created for each week, from the same `DayStat[]` the calendar uses.
 */
export function computeWeeklyScores(year: number, month: number, days: DayStat[]): WeekScore[] {
  const dayMap = new Map(days.map((d) => [d.date, d]))
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = new Date(year, month - 1, 1).getDay()

  const weeks = new Map<number, { startDay: number; endDay: number; totalPoints: number; totalTasks: number }>()

  for (let day = 1; day <= daysInMonth; day++) {
    const weekIndex = Math.floor((firstWeekday + day - 1) / 7)
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const stat = dayMap.get(date)

    let week = weeks.get(weekIndex)
    if (!week) {
      week = { startDay: day, endDay: day, totalPoints: 0, totalTasks: 0 }
      weeks.set(weekIndex, week)
    }
    week.endDay = day
    if (stat) {
      week.totalPoints += stat.pointsEarned
      week.totalTasks += stat.totalTargets
    }
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, w]) => ({
      weekIndex,
      startDay: w.startDay,
      endDay: w.endDay,
      totalPoints: w.totalPoints,
      totalTasks: w.totalTasks,
      score: w.totalTasks > 0 ? w.totalPoints / w.totalTasks : 0,
    }))
}
