type RecurringTaskConfig = {
  frequency: string // 'daily' | 'weekly' | 'custom'
  daysOfWeek: string | null // JSON array of 0-6 (Sun-Sat), for 'weekly'
  intervalDays: number | null // for 'custom'
  anchorDate: string // YYYY-MM-DD
  endDate?: string | null // YYYY-MM-DD inclusive; past this the task stops generating
}

/** Day count between two YYYY-MM-DD dates (anchored at UTC midnight). */
function daysBetween(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split("-").map(Number)
  const [ty, tm, td] = toDate.split("-").map(Number)
  const from = Date.UTC(fy, fm - 1, fd)
  const to = Date.UTC(ty, tm - 1, td)
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}

/**
 * Whether a recurring task is due on `dateStr` (YYYY-MM-DD).
 *
 * - daily: due every day on/after `anchorDate`.
 * - weekly: due on the days of week listed in `daysOfWeek` (0=Sun..6=Sat),
 *   on/after `anchorDate`.
 * - custom: due every `intervalDays` days, counting from `anchorDate`.
 *
 * An `endDate` (inclusive) caps the schedule: nothing is due after it, so a
 * goal-backed task stops generating once its deadline passes.
 */
export function isDueOn(task: RecurringTaskConfig, dateStr: string): boolean {
  if (dateStr < task.anchorDate) return false
  if (task.endDate && dateStr > task.endDate) return false

  switch (task.frequency) {
    case "daily":
      return true
    case "weekly": {
      if (!task.daysOfWeek) return false
      const days: number[] = JSON.parse(task.daysOfWeek)
      const [y, m, d] = dateStr.split("-").map(Number)
      const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      return days.includes(dayOfWeek)
    }
    case "custom": {
      if (!task.intervalDays || task.intervalDays <= 0) return false
      return daysBetween(task.anchorDate, dateStr) % task.intervalDays === 0
    }
    default:
      return false
  }
}
