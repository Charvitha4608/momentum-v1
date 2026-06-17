"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight, Clock, X } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getTargetsForDate, type DateTarget, type DayStat } from "@/app/actions/history"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

// COLOR: calendar heatmap cells — bg from --calendar-* scale (globals.css), text is
// whichever of background/foreground reads legibly against that cell's fill.
const LEGEND = [
  { label: "No targets", bg: "var(--color-calendar-none)", text: "#18172d" },
  { label: "0% completed", bg: "var(--color-calendar-empty)", text: "#e8eae7" },
  { label: "1-49% completed", bg: "var(--color-calendar-low)", text: "#18172d" },
  { label: "50-99% completed", bg: "var(--color-calendar-mid)", text: "#e8eae7" },
  { label: "100% completed", bg: "var(--color-calendar-full)", text: "#e8eae7" },
] as const

function cellStyle(day: DayStat | undefined, isToday: boolean) {
  if (!day || day.totalTargets === 0) return LEGEND[0]
  if (day.completionPercent === 0) return isToday ? LEGEND[0] : LEGEND[1]
  if (day.completionPercent < 0.5) return LEGEND[2]
  if (day.completionPercent < 1) return LEGEND[3]
  return LEGEND[4]
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
  const onTimeCount = dayTargets?.filter((t) => t.completed && (!t.completedDate || t.completedDate === selectedDate)).length ?? 0
  const lateCount = dayTargets?.filter((t) => t.completed && t.completedDate && t.completedDate !== selectedDate).length ?? 0
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
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/calendar?year=${prevYear}&month=${prevMonth}`}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <h2 className="text-lg font-semibold">{monthLabel}</h2>
          <Link
            href={`/calendar?year=${nextYear}&month=${nextMonth}`}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
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
              const style = cellStyle(stat, isToday)
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => openDay(cell.date)}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md border border-border text-xs font-medium transition-transform hover:scale-105",
                    isToday && "ring-2 ring-primary" // COLOR: today indicator — primary-color ring around the current day's cell
                  )}
                  style={{ backgroundColor: style.bg, color: style.text }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          {LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border border-border" style={{ backgroundColor: item.bg }} />
              <span className="text-[0.65rem] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
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
                      const isLate = t.completed && t.completedDate && t.completedDate !== selectedDate
                      const lateLabel = isLate
                        ? new Date(`${t.completedDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : null
                      return (
                        <li
                          key={t.id}
                          className="flex items-center gap-2.5 rounded-lg bg-secondary/40 px-3 py-2.5"
                        >
                          {isLate ? (
                            // COLOR: completed-late marker uses amber to signal "done, but not on this day"
                            <Clock className="size-4 shrink-0 text-amber-500" />
                          ) : t.completed ? (
                            // COLOR: completed marker uses primary, matching the points/score figures elsewhere
                            <Check className="size-4 shrink-0 text-primary" />
                          ) : (
                            <X className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className={cn("flex-1 text-sm", !t.completed && "text-muted-foreground")}>
                            {t.title}
                          </span>
                          {lateLabel && (
                            <span className="shrink-0 text-xs text-muted-foreground">completed {lateLabel}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  <div className="mt-3 flex items-center justify-between px-1 text-sm text-muted-foreground">
                    <span>
                      {onTimeCount}/{dayTargets.length} on time{lateCount > 0 ? ` · ${lateCount} completed later` : ""}
                    </span>
                    {/* COLOR: points earned uses primary, matching the points stat elsewhere */}
                    <span className="font-semibold text-primary">{pointsEarned} points earned</span>
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
