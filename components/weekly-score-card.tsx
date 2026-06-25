import { Gauge } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { computeWeeklyScores } from "@/lib/weekly-score"
import type { DayStat } from "@/app/actions/history"

export function WeeklyScoreCard({
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
  const weeks = computeWeeklyScores(year, month, days)
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" })

  // Bars are scaled against the fixed 0-10 scale (each task is worth 10 points
  // by default), so every week's fill reflects its absolute score: 5.00 = half.
  const MAX_SCORE = 10

  // Highlight the week containing today, but only when viewing the current month.
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number)
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const currentWeekIndex =
    todayYear === year && todayMonth === month ? Math.floor((firstWeekday + todayDay - 1) / 7) : -1

  return (
    <Card className="w-full">
      <CardContent>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Gauge className="size-4.5 text-primary" />
          Weekly score
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">Points earned ÷ tasks created, per week.</p>
        <ul className="flex flex-col gap-2">
          {weeks.map((week) => {
            const isCurrent = week.weekIndex === currentWeekIndex
            const width = week.totalTasks > 0 ? Math.min(100, (week.score / MAX_SCORE) * 100) : 0
            return (
              <li
                key={week.weekIndex}
                className={cn(
                  "flex items-center gap-3 rounded-[11px] border border-line bg-surface-1 px-3 py-2.5",
                  // COLOR: current week gets the brand-soft wash + brand-line outline
                  isCurrent && "border-brand-line bg-brand-soft"
                )}
              >
                <span className="w-[78px] shrink-0 text-[13px] font-medium">
                  {monthLabel} {week.startDay}
                  {week.endDay !== week.startDay ? `–${week.endDay}` : ""}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  {/* COLOR: bar fill uses the brand gradient (design .wk-row .track i) */}
                  <div className="bg-brand-gradient h-full rounded-full" style={{ width: `${width}%` }} />
                </div>
                <span className="w-[34px] shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {week.totalTasks > 0 ? week.score.toFixed(2) : "—"}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
