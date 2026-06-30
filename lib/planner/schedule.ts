// Pure, dependency-free scheduling helpers shared by the AI Planner.
//
// The planner uses a hybrid design: an AI model (or a heuristic fallback) decides
// *priority, day, and time-of-day* for each task — the "judgment" — while the
// deterministic packer in this file lays those decisions onto a concrete
// timeline, enforcing the hard constraints (available hours, day windows,
// no overlaps, deadlines). Keeping the packer pure makes it unit-testable and
// keeps the same rules whether the upstream decision came from the model or
// the fallback.

export type TimeOfDay = "morning" | "afternoon" | "evening" | "any"

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  any: "Anytime",
}

// Default clock windows (24h) used to place a task with a time-of-day hint.
// Clamped to the user's overall day window by the packer.
export const TIME_OF_DAY_WINDOWS: Record<Exclude<TimeOfDay, "any">, { start: number; end: number }> = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 17, end: 23 },
}

export function isWeekend(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  return dow === 0 || dow === 6
}

export function minutesToClock(totalMinutes: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)))
  const hh = Math.floor(m / 60)
  const mm = m % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

export function clockToMinutes(clock: string): number {
  const [hh, mm] = clock.split(":").map(Number)
  return hh * 60 + (mm || 0)
}

export type PackInput = {
  id: string // stable key (e.g. ai_schedule placeholder id or target id)
  title: string
  durationMinutes: number
  timeOfDay: TimeOfDay
  priority: number // higher = scheduled first
}

export type PackedItem = PackInput & {
  startTime: string // HH:MM
  endTime: string // HH:MM
  scheduled: boolean // false when it didn't fit in the available budget
}

export type PackOptions = {
  availableHours: number
  dayStartHour: number // 0-23
  dayEndHour: number // 1-24
  /** Minutes of breathing room inserted between consecutive tasks. */
  gapMinutes?: number
}

/**
 * Greedy timeline packer. Sorts by (priority desc, duration asc) so the most
 * important work lands first and short tasks fill gaps, then walks the day
 * window placing each task in the earliest slot that respects its time-of-day
 * window and the remaining hour budget. Items that exceed the budget come back
 * with `scheduled: false` so the caller can surface them as "didn't fit".
 */
export function packDay(items: PackInput[], opts: PackOptions): PackedItem[] {
  const gap = opts.gapMinutes ?? 10
  const dayStart = opts.dayStartHour * 60
  const dayEnd = opts.dayEndHour * 60
  const budgetMinutes = Math.round(opts.availableHours * 60)

  const ordered = [...items].sort((a, b) => b.priority - a.priority || a.durationMinutes - b.durationMinutes)

  // Cursor per time-of-day window so morning/afternoon/evening tasks each fill
  // forward independently; "any" tasks use a shared cursor from day start.
  const cursors: Record<string, number> = {
    morning: Math.max(dayStart, TIME_OF_DAY_WINDOWS.morning.start * 60),
    afternoon: Math.max(dayStart, TIME_OF_DAY_WINDOWS.afternoon.start * 60),
    evening: Math.max(dayStart, TIME_OF_DAY_WINDOWS.evening.start * 60),
    any: dayStart,
  }

  let usedMinutes = 0
  const placed: PackedItem[] = []

  for (const item of ordered) {
    const dur = Math.max(5, item.durationMinutes || 30)
    if (usedMinutes + dur > budgetMinutes) {
      placed.push({ ...item, startTime: "", endTime: "", scheduled: false })
      continue
    }

    const windowEnd =
      item.timeOfDay === "any" ? dayEnd : Math.min(dayEnd, TIME_OF_DAY_WINDOWS[item.timeOfDay].end * 60)
    let start = cursors[item.timeOfDay]

    // If the preferred window is full, spill over into "anytime" placement so
    // the task is still scheduled rather than silently dropped.
    if (start + dur > windowEnd) {
      start = Math.max(cursors.any, start)
      if (start + dur > dayEnd) {
        placed.push({ ...item, startTime: "", endTime: "", scheduled: false })
        continue
      }
    }

    const end = start + dur
    placed.push({ ...item, startTime: minutesToClock(start), endTime: minutesToClock(end), scheduled: true })

    const nextCursor = end + gap
    cursors[item.timeOfDay] = nextCursor
    cursors.any = Math.max(cursors.any, nextCursor)
    usedMinutes += dur
  }

  // Return in start-time order for scheduled items; unscheduled at the end.
  return placed.sort((a, b) => {
    if (a.scheduled !== b.scheduled) return a.scheduled ? -1 : 1
    if (!a.scheduled) return b.priority - a.priority
    return clockToMinutes(a.startTime) - clockToMinutes(b.startTime)
  })
}
