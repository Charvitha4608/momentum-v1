import { Card, CardContent } from "@/components/ui/card"
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

  // Ring geometry: r=27 inside a 64px box, 6px stroke. The visible arc shrinks
  // by dashoffset as completion grows.
  const radius = 27
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - percent / 100)

  const status =
    total === 0
      ? "No targets yet"
      : percent === 100
        ? "All done — nice work 🎉"
        : percent === 0
          ? "Just getting started"
          : "Keep the momentum going"

  return (
    <Card className="elevate-hover">
      <CardContent className="flex items-center gap-5">
        {/* Circular progress ring */}
        <div className="relative size-16 shrink-0">
          <svg width="64" height="64" className="-rotate-90">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--line-2)" strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="url(#todayProgressRing)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
            <defs>
              <linearGradient id="todayProgressRing">
                <stop offset="0" stopColor="#9a8cff" />
                <stop offset="1" stopColor="#6d5dff" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">
            {completed}/{total}
          </div>
        </div>

        {/* Status + thin progress bar */}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-muted-foreground">Today&apos;s progress</div>
          <div className="mt-0.5 truncate text-xl font-bold tracking-tight">{status}</div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-brand-gradient transition-[width] duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Daily score chip */}
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold tabular-nums">
            <CountUp value={dailyScore} decimals={1} />
            <span className="text-[13px] font-normal text-muted-foreground">/10</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Daily score</div>
        </div>
      </CardContent>
    </Card>
  )
}
