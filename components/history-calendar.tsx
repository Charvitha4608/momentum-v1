"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight, Clock, X } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getTargetsForDate, type DateTarget, type DayStat } from "@/app/actions/history"
import { toggleTarget } from "@/app/actions/targets"
import { completionStatus, COMPLETION_META } from "@/lib/completion"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

// COLOR: calendar heatmap is now a single dot inside each subtle square cell.
// Dot color comes from the redesign tokens (globals.css): inert grey → coral →
// amber → brand → green as on-time completion climbs.
//
// The dot scores ON-TIME completion only — a target counts toward the day's
// color just when it was finished on that day (completedDate === originalDate).
// Carried-over targets finished late still earn their points, but they no longer
// turn the original day green; green means "done on the day", not "done later".
const LEGEND = [
  { label: "No targets", dot: "var(--tx-faint)" },
  { label: "0% on time", dot: "var(--coral)" },
  { label: "1-49% on time", dot: "var(--amber)" },
  { label: "50-99% on time", dot: "var(--accent-1)" },
  { label: "100% on time", dot: "var(--green)" },
  { label: "Planned", dot: "var(--color-calendar-planned)" },
] as const

// Heatmap dot color for a cell, or null for cells that should stay dot-free
// (no targets, and today before anything is done on time — no discouraging red).
function heatDot(day: DayStat | undefined, isToday: boolean, isFuture: boolean): string | null {
  if (!day || day.totalTargets === 0) return null
  // A future day that already has targets is *planned*, not failed — give it a
  // neutral pending tone instead of the red "0% on time" colour.
  if (isFuture) return LEGEND[5].dot
  if (day.onTimePercent === 0) return isToday ? null : LEGEND[1].dot
  if (day.onTimePercent < 0.5) return LEGEND[2].dot
  if (day.onTimePercent < 1) return LEGEND[3].dot
  return LEGEND[4].dot
}

export function HistoryCalendar({
  year,
  month,
  days,
  today,
}: {
  year: number
  month: number
  days: DayStat[]
  today: string
}) {
  const [selected, setSelected] = useState<{ date: string } | null>(null)
  const [dayTargets, setDayTargets] = useState<DateTarget[] | null>(null)
  const router = useRouter()
  const [, startToggle] = useTransition()

  // Toggle a target from the day-detail panel (today or any future day). The
  // panel updates optimistically; router.refresh() then re-pulls the month so
  // the heatmap dot and weekly score reflect the change.
  function toggleDayTarget(t: DateTarget, checked: boolean, viewedDate: string) {
    setDayTargets((prev) =>
      prev ? prev.map((x) => (x.id === t.id ? { ...x, completed: checked, completedDate: checked ? today : null } : x)) : prev
    )
    startToggle(async () => {
      await toggleTarget(t.id, checked, viewedDate)
      router.refresh()
    })
  }

  // On desktop the day-detail popup floats inside the calendar card (portaled
  // into cardRef + absolute-positioned). On mobile it stays the standard
  // viewport-centered modal (default body portal), so we gate on a media query
  // rather than CSS alone — a transform ancestor (PageTransition) would
  // otherwise trap the mobile `fixed` popup inside the card.
  const cardRef = useRef<HTMLDivElement>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  function openDay(date: string) {
    setSelected({ date })
    setDayTargets(null)
    getTargetsForDate(date).then(setDayTargets)
  }

  const dayMap = new Map(days.map((d) => [d.date, d]))
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = new Date(year, month - 1, 1).getDay()

  const cells: ({ day: number; date: string } | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    cells.push({ day, date })
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const selectedDate = selected?.date ?? ""
  const isFutureDay = selectedDate > today
  // Today and future days are checkable from the panel; past days stay read-only.
  const isEditable = selectedDate !== "" && selectedDate >= today
  const onTimeCount = dayTargets?.filter((t) => t.completed && (!t.completedDate || t.completedDate === selectedDate)).length ?? 0
  const lateCount = dayTargets?.filter((t) => t.completed && t.completedDate && t.completedDate !== selectedDate).length ?? 0
  const completedCount = dayTargets?.filter((t) => t.completed).length ?? 0
  const pointsEarned = dayTargets?.filter((t) => t.completed).reduce((sum, t) => sum + t.points, 0) ?? 0

  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth === 0) {
    prevMonth = 12
    prevYear -= 1
  }
  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth === 13) {
    nextMonth = 1
    nextYear += 1
  }

  return (
    <Card ref={cardRef} className="relative">
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/calendar?year=${prevYear}&month=${prevMonth}`}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <h2 className="text-lg font-semibold">{monthLabel}</h2>
          <Link
            href={`/calendar?year=${nextYear}&month=${nextMonth}`}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>

        <div className="mx-auto w-full max-w-[280px]">
          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-center text-[0.65rem] font-medium text-muted-foreground">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} className="aspect-square" />
              const stat = dayMap.get(cell.date)
              const isToday = cell.date === today
              const isFuture = cell.date > today
              const dot = heatDot(stat, isToday, isFuture)
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => openDay(cell.date)}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-[10px] border border-line bg-surface-1 text-xs font-medium text-muted-foreground transition-colors hover:border-line-2 hover:bg-surface-3",
                    // COLOR: today gets a brand-tinted fill + a glowing accent ring (the ::after below)
                    isToday && "border-brand bg-brand-soft font-semibold text-foreground"
                  )}
                >
                  <span className="tabular-nums">{cell.day}</span>
                  <span className="size-[5px] rounded-full" style={{ backgroundColor: dot ?? "transparent" }} />
                  {isToday && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-px rounded-[10px]"
                      style={{ boxShadow: "0 0 0 1px var(--accent-1), 0 0 16px -4px rgba(139, 124, 255, 0.7)" }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          {LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.dot }} />
              <span className="text-[0.65rem] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent container={isDesktop ? cardRef : undefined} contained={isDesktop}>
          {selected && (
            <div>
              <DialogTitle>
                {new Date(`${selected.date}T00:00:00`).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </DialogTitle>

              {dayTargets === null ? (
                <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
              ) : dayTargets.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No targets were set on this day.</p>
              ) : (
                <>
                  <ul className="mt-4 flex flex-col gap-2">
                    {dayTargets.map((t) => {
                      const status = completionStatus(t)
                      const meta = status ? COMPLETION_META[status] : null
                      const lateLabel =
                        status === "late" && t.completedDate
                          ? new Date(`${t.completedDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : null
                      return (
                        <li
                          key={t.id}
                          className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5"
                        >
                          {isEditable ? (
                            // Today / future days are checkable straight from the panel.
                            <Checkbox
                              checked={t.completed}
                              onCheckedChange={(checked) => toggleDayTarget(t, checked, selectedDate)}
                              aria-label={t.completed ? `Mark "${t.title}" incomplete` : `Mark "${t.title}" complete`}
                            />
                          ) : status === "late" ? (
                            // COLOR: completed-late marker uses amber to signal "done, but not on this day"
                            <Clock className="size-4 shrink-0 text-amber-500" />
                          ) : t.completed ? (
                            <Check className={cn("size-4 shrink-0", meta?.textClass ?? "text-primary")} />
                          ) : (
                            <X className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className={cn("flex-1 text-sm", !t.completed && "text-muted-foreground")}>
                            {t.title}
                          </span>
                          {meta && <span className={cn("shrink-0 text-xs font-medium", meta.textClass)}>{meta.label}</span>}
                          {lateLabel && (
                            <span className="shrink-0 text-xs text-muted-foreground">{lateLabel}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  <div className="mt-3 flex items-center justify-between px-1 text-sm text-muted-foreground">
                    {isFutureDay ? (
                      <span>
                        {completedCount}/{dayTargets.length} planned
                      </span>
                    ) : (
                      <span>
                        {onTimeCount}/{dayTargets.length} on time{lateCount > 0 ? ` · ${lateCount} completed later` : ""}
                      </span>
                    )}
                    {/* COLOR: points earned uses primary, matching the points stat elsewhere */}
                    <span className="font-semibold text-primary">
                      {pointsEarned} points{isFutureDay ? "" : " earned"}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
