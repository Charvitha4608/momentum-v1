import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CountUp } from "@/components/count-up"

export function TodayProgressCard({
  completed,
  total,
  dailyScore,
}: {
  completed: number
  total: number
  dailyScore: number
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <Card className="elevate-hover flex-1">
      <CardContent>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Today&apos;s progress</span>
          <span className="text-xs text-muted-foreground">
            Score <CountUp value={dailyScore} decimals={1} />
            /10
          </span>
        </div>
        <div className="mb-3 text-2xl font-semibold tabular-nums">
          {completed}/{total}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (<CountUp value={percent} />%)
          </span>
        </div>
        <Progress value={percent} />
      </CardContent>
    </Card>
  )
}
