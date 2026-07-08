"use client"

import Link from "next/link"
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flame, X } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { shiftDateString } from "@/lib/date-utils"
import type { WeekDayTargets, DateTarget } from "@/app/actions/history"
import type { WeeklyFocusPillar } from "@/lib/focus-stats"
import { WeeklyFocusCard } from "@/components/focus/focus-heatmap-cards"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function formatDayLabel(dateStr: string): { weekday: string; date: string } {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return {
    weekday: dt.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    date: dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  }
}

function formatRangeLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number)
  const [ey, em, ed] = end.split("-").map(Number)
  const s = new Date(Date.UTC(sy, sm - 1, sd)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
  const e = new Date(Date.UTC(ey, em - 1, ed)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  return `${s} – ${e}`
}

function dayStats(targets: DateTarget[]) {
  if (targets.length === 0) return { total: 0, completed: 0, points: 0, pct: 0, allDone: false }
  const completed = targets.filter((t) => t.completed).length
  const points = targets.filter((t) => t.completed).reduce((s, t) => s + t.points, 0)
  return {
    total: targets.length,
    completed,
    points,
    pct: Math.round((completed / targets.length) * 100),
    allDone: completed === targets.length,
  }
}

// ---------------------------------------------------------------------------
// Task row — aligned 3-column grid: title | pillar badge | pts
// ---------------------------------------------------------------------------

function TaskRow({ task, isPast }: { task: DateTarget; isPast: boolean }) {
  const isMissed = !task.completed && isPast

  return (
    <div className="grid grid-cols-[1.25rem_1fr_auto_auto] items-start gap-x-2.5 py-1">
      {/* Status icon */}
      <div className="mt-0.5 flex shrink-0 justify-center">
        {task.completed ? (
          <Check className="size-3.5 text-primary" />
        ) : isMissed ? (
          <X className="size-3.5 text-destructive/70" />
        ) : (
          <div className="size-3.5 rounded-full border-2 border-muted-foreground/40" />
        )}
      </div>

      {/* Title */}
      <span
        className={cn(
          "break-words text-sm leading-snug",
          task.completed && "text-muted-foreground line-through decoration-muted-foreground/50",
          isMissed && "text-muted-foreground/60",
        )}
      >
        {task.title}
      </span>

      {/* Pillar badge */}
      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide"
        style={{
          backgroundColor: hexToRgba(task.pillarColor, 0.15),
          color: task.pillarColor,
          border: `1px solid ${hexToRgba(task.pillarColor, 0.3)}`,
        }}
      >
        {task.pillarIcon} {task.pillarName}
      </span>

      {/* Points */}
      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{task.points}&thinsp;pts</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day card
// ---------------------------------------------------------------------------

function DayCard({ day, today }: { day: WeekDayTargets; today: string }) {
  const isToday = day.date === today
  const isPast = day.date < today
  const stats = dayStats(day.targets)
  const { weekday, date } = formatDayLabel(day.date)

  // Empty days collapse to a slim single-line row (~40px) — no tall card body.
  if (day.targets.length === 0) {
    return (
      <Card
        className={cn(
          "overflow-hidden transition-shadow !flex-row items-center justify-between gap-2 px-4 py-2.5",
          isToday && "ring-2 ring-primary",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">{weekday}</span>
          <span className="text-sm text-muted-foreground">{date}</span>
          {isToday && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary-foreground">
              Today
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground/50">No tasks scheduled</span>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow gap-1 py-3",
        isToday && "ring-2 ring-primary",
        stats.allDone && stats.total > 0 && "border-primary/30",
      )}
    >
      {/* Card header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 pb-1 pt-3",
          stats.allDone && stats.total > 0 && "bg-primary/5",
        )}
      >
        <div className="flex items-center gap-2">
          <div>
            <span className="font-semibold">{weekday}</span>
            <span className="ml-1.5 text-sm text-muted-foreground">{date}</span>
          </div>
          {isToday && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary-foreground">
              Today
            </span>
          )}
          {stats.allDone && stats.total > 0 && (
            <CheckCircle2 className="size-4 text-primary" />
          )}
        </div>

        {stats.total > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{stats.pct}%</span> complete
            </span>
            <span className="font-semibold text-primary">{stats.points}&thinsp;pts</span>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="px-4 pb-2 pt-1">
        <div className="flex flex-col">
          {day.targets.map((t) => (
            <TaskRow key={t.id} task={t} isPast={isPast} />
          ))}
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Summary panel (sticky right column)
// ---------------------------------------------------------------------------

function SummaryPanel({
  days,
  today,
  streak,
  weeklyTotal,
}: {
  days: WeekDayTargets[]
  today: string
  streak: number
  weeklyTotal: { totalSec: number; sessionCount: number }
}) {
  const allTargets = days.flatMap((d) => d.targets)
  const completed = allTargets.filter((t) => t.completed)
  const totalTasks = allTargets.length
  const completedCount = completed.length
  const pointsEarned = completed.reduce((s, t) => s + t.points, 0)
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  // Focus time this week (Section 4a — replaces the old "Missed" cell).
  const focusTotalMin = Math.round(weeklyTotal.totalSec / 60)
  const focusHours = Math.floor(focusTotalMin / 60)
  const focusMins = focusTotalMin % 60

  // Overdue = not completed on a past day
  const overdueTasks = days
    .filter((d) => d.date < today)
    .flatMap((d) => d.targets.filter((t) => !t.completed))

  // Most productive day
  const bestDay = days.reduce<{ label: string; points: number } | null>((best, d) => {
    const pts = d.targets.filter((t) => t.completed).reduce((s, t) => s + t.points, 0)
    if (pts === 0) return best
    if (!best || pts > best.points) return { label: formatDayLabel(d.date).weekday.slice(0, 3), points: pts }
    return best
  }, null)

  // Pillar distribution
  const pillarMap = new Map<number, { name: string; icon: string; color: string; total: number }>()
  for (const t of allTargets) {
    const e = pillarMap.get(t.pillarId) ?? { name: t.pillarName, icon: t.pillarIcon, color: t.pillarColor, total: 0 }
    e.total++
    pillarMap.set(t.pillarId, e)
  }
  const topPillars = [...pillarMap.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  // Insight
  function insight(): string {
    if (totalTasks === 0) return "No tasks scheduled this week."
    if (completionRate >= 90) return "Outstanding week — nearly perfect completion!"
    if (completionRate >= 70) return "Strong week. Keep the momentum going."
    if (completionRate >= 50) return "Halfway there. Push through to finish strong."
    if (completionRate > 0) return "Below pace — focus on a few key tasks today."
    return "Week not started yet. Set your first task."
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <h2 className="text-base font-semibold">Week Summary</h2>

        {/* Core stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Completion", value: `${completionRate}%`, sublabel: null },
            { label: "Points Earned", value: pointsEarned, sublabel: null },
            { label: "Completed", value: completedCount, sublabel: null },
            {
              label: "Focus time",
              value: `${focusHours}h ${focusMins}m`,
              sublabel: `${weeklyTotal.sessionCount} pomodoro${weeklyTotal.sessionCount === 1 ? "" : "s"}`,
            },
          ].map(({ label, value, sublabel }) => (
            <div key={label} className="rounded-lg bg-secondary/40 px-3 py-2.5 text-center">
              <div className="text-xl font-bold text-primary">{value}</div>
              <div className="mt-0.5 text-[0.6rem] text-muted-foreground">{label}</div>
              {sublabel && <div className="text-[0.55rem] text-muted-foreground/70">{sublabel}</div>}
            </div>
          ))}
        </div>

        {/* Streak */}
        <div className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Flame className="size-4 text-primary" />
            <span>Current Streak</span>
          </div>
          <span className="font-bold text-primary">
            {streak} day{streak !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Pillar distribution */}
        {topPillars.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Top Pillars</h3>
            <div className="flex flex-col gap-2">
              {topPillars.map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-sm" aria-hidden>
                    {p.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{p.name}</span>
                  <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((p.total / (topPillars[0]?.total || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {p.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Most productive day */}
        {bestDay && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Best day</span>
            <span className="font-semibold">
              {bestDay.label} &middot; {bestDay.points}&thinsp;pts
            </span>
          </div>
        )}

        {/* Overdue tasks */}
        {overdueTasks.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
              <Clock className="size-3.5" />
              Overdue ({overdueTasks.length})
            </h3>
            <ul className="flex flex-col gap-1">
              {overdueTasks.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.pillarColor }}
                  />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                </li>
              ))}
              {overdueTasks.length > 4 && (
                <li className="text-xs text-muted-foreground/60">+{overdueTasks.length - 4} more</li>
              )}
            </ul>
          </div>
        )}

        {/* Weekly insight */}
        <p className="rounded-lg bg-secondary/30 px-3 py-2.5 text-xs italic text-muted-foreground">
          {insight()}
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function CalendarWeekView({
  days,
  weekDate,
  today,
  streak,
  weeklyByPillar,
  weeklyTotal,
}: {
  days: WeekDayTargets[]
  weekDate: string
  today: string
  streak: number
  weeklyByPillar: WeeklyFocusPillar[]
  weeklyTotal: { totalSec: number; sessionCount: number }
}) {
  const prevWeek = shiftDateString(weekDate, -7)
  const nextWeek = shiftDateString(weekDate, 7)

  return (
    <div className="flex flex-col gap-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/calendar?view=week&week=${prevWeek}`}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          aria-label="Previous week"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h2 className="text-base font-semibold">{formatRangeLabel(days[0].date, days[6].date)}</h2>
        <Link
          href={`/calendar?view=week&week=${nextWeek}`}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          aria-label="Next week"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      {/* 70/30 two-column layout — summary after days on mobile, right column on desktop */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-6">
        {/* Left: focus heatmap + agenda */}
        <div className="flex flex-col gap-3">
          <WeeklyFocusCard pillars={weeklyByPillar} />
          {days.map((day) => (
            <DayCard key={day.date} day={day} today={today} />
          ))}
        </div>

        {/* Right: sticky summary */}
        <div className="lg:sticky lg:top-4">
          <SummaryPanel days={days} today={today} streak={streak} weeklyTotal={weeklyTotal} />
        </div>
      </div>
    </div>
  )
}
