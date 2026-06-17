import { Flame, Trophy } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { CountUp } from "@/components/count-up"

export function StatCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: "streak" | "points"
}) {
  const isStreak = variant === "streak"
  return (
    <Card className="elevate-hover flex-1">
      <CardContent className="flex items-center gap-3">
        {/* COLOR: streak badge uses destructive (flame/red for an active streak); points badge uses primary */}
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
            isStreak ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
          }`}
        >
          {isStreak ? <Flame className="size-5" /> : <Trophy className="size-5" />}
        </span>
        <div>
          <div className="text-2xl font-semibold tabular-nums">
            <CountUp value={value} />
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}
