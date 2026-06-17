import { Gauge } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { computeWeeklyScores } from "@/lib/weekly-score"
import type { DayStat } from "@/app/actions/history"

export function WeeklyScoreCard({ year, month, days }: { year: number; month: number; days: DayStat[] }) {
  const weeks = computeWeeklyScores(year, month, days)
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" })

  return (
    <Card className="w-full">
      <CardContent>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Gauge className="size-4.5 text-primary" />
          Weekly score
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">Points earned ÷ tasks created, per week.</p>
        <ul className="flex flex-col gap-2">
          {weeks.map((week) => (
            <li
              key={week.weekIndex}
              className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2.5"
            >
              <span className="text-sm text-muted-foreground">
                {monthLabel} {week.startDay}
                {week.endDay !== week.startDay ? `–${week.endDay}` : ""}
              </span>
              {/* COLOR: score value uses primary, matching points/score figures elsewhere */}
              <span className="text-sm font-semibold tabular-nums text-primary">
                {week.totalTasks > 0 ? week.score.toFixed(2) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
