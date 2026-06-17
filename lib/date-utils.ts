/** Formats a Date as YYYY-MM-DD in the given IANA timezone. */
export function formatDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/**
 * Shifts a YYYY-MM-DD date string by `days` (negative to go back). Operates
 * on the calendar date only, anchored at UTC midnight, so it's unaffected by
 * DST and doesn't require a timezone.
 */
export function shiftDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Whole-day difference between two YYYY-MM-DD strings (to - from), UTC-anchored. */
export function daysBetween(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split("-").map(Number)
  const [ty, tm, td] = toDate.split("-").map(Number)
  const from = Date.UTC(fy, fm - 1, fd)
  const to = Date.UTC(ty, tm - 1, td)
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}

/**
 * Returns the Sunday-Saturday week (YYYY-MM-DD, inclusive) containing `dateStr`.
 * Used by weekly leaderboards, weekly reviews, and weekly breakdown analytics.
 */
export function getWeekRange(dateStr: string): { start: string; end: string } {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayOfWeek = date.getUTCDay() // 0 = Sunday, 6 = Saturday
  return {
    start: shiftDateString(dateStr, -dayOfWeek),
    end: shiftDateString(dateStr, 6 - dayOfWeek),
  }
}
