"use client"

import { Flame } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { PillarFullStat } from "@/app/actions/history"

function statusInfo(rate: number): { label: string; className: string } {
  if (rate >= 0.75) return { label: "Strong", className: "text-primary" }
  if (rate >= 0.5) return { label: "Good", className: "text-blue-400" }
  if (rate >= 0.25) return { label: "Moderate", className: "text-yellow-500" }
  return { label: "Needs Attention", className: "text-destructive" }
}

function formatLastActive(dateStr: string | null): string {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function CalendarPillarsView({ pillars }: { pillars: PillarFullStat[] }) {
  // Sort by completion rate desc, points as tiebreaker
  const ranked = [...pillars].sort((a, b) => {
    const rateA = a.totalTasks > 0 ? a.completedTasks / a.totalTasks : 0
    const rateB = b.totalTasks > 0 ? b.completedTasks / b.totalTasks : 0
    return rateB !== rateA ? rateB - rateA : b.pointsEarned - a.pointsEarned
  })

  if (pillars.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No pillar activity this month.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Per-pillar detail cards */}
      {ranked.map((pillar) => {
        const rate = pillar.totalTasks > 0 ? pillar.completedTasks / pillar.totalTasks : 0
        const ratePct = Math.round(rate * 100)
        const { label: statusLabel, className: statusClass } = statusInfo(rate)

        return (
          <Card key={pillar.pillarId}>
            <CardContent>
              {/* Pillar header */}
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  {pillar.icon}
                </span>
                <span className="flex-1 text-base font-semibold">{pillar.name}</span>
              </div>

              {/* Task completion */}
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  {pillar.completedTasks} / {pillar.totalTasks} Tasks Completed
                </span>
                <span className="text-sm font-bold">{ratePct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${ratePct}%` }}
                />
              </div>

              {/* Stats grid */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-secondary/40 px-2 py-2.5 text-center">
                  <div className="text-sm font-bold text-primary">{pillar.pointsEarned}</div>
                  <div className="mt-0.5 text-[0.6rem] text-muted-foreground">Points Earned</div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="text-sm font-bold text-primary">{pillar.currentStreak}</span>
                    {pillar.currentStreak > 0 && <Flame className="size-3.5 text-primary" />}
                  </div>
                  <div className="mt-0.5 text-[0.6rem] text-muted-foreground">Day Streak</div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-2.5 text-center">
                  <div className="text-sm font-bold">{formatLastActive(pillar.lastActivityDate)}</div>
                  <div className="mt-0.5 text-[0.6rem] text-muted-foreground">Last Active</div>
                </div>
              </div>

              {/* Status */}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className={cn("text-xs font-bold", statusClass)}>{statusLabel}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
