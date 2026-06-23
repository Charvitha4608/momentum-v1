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
      <CardContent className="flex items-center gap-4">
        {/* COLOR: streak badge uses coral (flame for an active streak); points badge uses brand */}
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
            isStreak ? "bg-coral-soft text-coral" : "bg-brand-soft text-brand"
          }`}
        >
          {isStreak ? <Flame className="size-5" /> : <Trophy className="size-5" />}
        </span>
        <div>
          <div className="text-[26px] font-extrabold leading-none tracking-tight tabular-nums">
            <CountUp value={value} />
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}
