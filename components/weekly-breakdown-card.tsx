import { BarChart3 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { PillarBreakdownRow, WeeklyBreakdown } from "@/app/actions/reflection"

function BreakdownSection({
  title,
  rows,
  mostActive,
  leastActive,
}: {
  title: string
  rows: PillarBreakdownRow[]
  mostActive: PillarBreakdownRow | null
  leastActive: PillarBreakdownRow | null
}) {
  const active = rows.filter((r) => r.points > 0).sort((a, b) => b.percent - a.percent)

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h3>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((r) => (
            <li key={r.pillarId} className="flex items-center gap-2">
              <span className="flex w-24 shrink-0 items-center gap-1 truncate text-xs text-foreground" title={r.pillarName}>
                <span aria-hidden>{r.pillarIcon}</span>
                <span className="truncate">{r.pillarName}</span>
              </span>
              <Progress value={r.percent} />
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{r.percent}%</span>
            </li>
          ))}
        </ul>
      )}
      {(mostActive || leastActive) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {mostActive && (
            <span>
              Most active:{" "}
              <span className="text-foreground">
                {mostActive.pillarIcon} {mostActive.pillarName}
              </span>
            </span>
          )}
          {leastActive && (
            <span>
              Least active:{" "}
              <span className="text-foreground">
                {leastActive.pillarIcon} {leastActive.pillarName}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function WeeklyBreakdownCard({ data }: { data: WeeklyBreakdown }) {
  return (
    <Card>
      <CardContent>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="size-4.5 text-primary" />
          Weekly Breakdown
        </h2>
        <div className="flex flex-col gap-5">
          <BreakdownSection title="This week" rows={data.week} mostActive={data.weekMostActive} leastActive={data.weekLeastActive} />
          <BreakdownSection title="This month" rows={data.month} mostActive={data.monthMostActive} leastActive={data.monthLeastActive} />
        </div>
      </CardContent>
    </Card>
  )
}
