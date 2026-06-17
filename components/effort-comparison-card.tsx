import { Scale } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { EffortComparisonRow } from "@/app/actions/reflection"

export function EffortComparisonCard({ rows }: { rows: EffortComparisonRow[] }) {
  return (
    <Card>
      <CardContent>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Scale className="size-4.5 text-primary" />
          Effort Comparison
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">Desired effort (from your pillar goals) vs. actual effort this month.</p>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Set pillar goals on the Goals page to see how your effort compares.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((r) => (
              <li key={r.pillarId}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span aria-hidden>{r.pillarIcon}</span>
                    {r.pillarName}
                  </span>
                  {/* COLOR: hitting/exceeding target highlighted in primary, matching points/score figures elsewhere */}
                  <span className={cn("text-sm font-semibold tabular-nums", r.percentOfTarget >= 100 ? "text-primary" : "text-muted-foreground")}>
                    {r.percentOfTarget}% of target
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">Desired</span>
                    <Progress value={Math.min(100, r.desiredPercent)} />
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{r.desiredPercent}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">Actual</span>
                    <Progress value={Math.min(100, r.actualPercent)} />
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{r.actualPercent}%</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
