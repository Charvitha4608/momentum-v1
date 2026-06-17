import { Gauge } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

export function BalanceScoreCard({ score }: { score: number | null }) {
  return (
    <Card>
      <CardContent>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Gauge className="size-4.5 text-primary" />
          Balance Score
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">How evenly your actual effort matches your pillar goals.</p>

        {score === null ? (
          <p className="text-sm text-muted-foreground">Set pillar goals on the Goals page to calculate your balance score.</p>
        ) : (
          <div className="flex items-baseline gap-1">
            {/* COLOR: headline score uses primary, matching points/score figures elsewhere */}
            <span className="text-4xl font-semibold tabular-nums text-primary">{score}</span>
            <span className="text-lg text-muted-foreground">/100</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
