"use client"

import type { ElementType } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronLeft, ChevronRight, Flame, Trophy, TrendingUp } from "lucide-react"

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

export function CalendarPillarsView({
  year,
  month,
  pillars,
  today,
}: {
  year: number
  month: number
  pillars: PillarFullStat[]
  today: string
}) {
  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth === 0) {
    prevMonth = 12
    prevYear -= 1
  }
  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth === 13) {
    nextMonth = 1
    nextYear += 1
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  // Sort by completion rate desc, points as tiebreaker
  const ranked = [...pillars].sort((a, b) => {
    const rateA = a.totalTasks > 0 ? a.completedTasks / a.totalTasks : 0
    const rateB = b.totalTasks > 0 ? b.completedTasks / b.totalTasks : 0
    return rateB !== rateA ? rateB - rateA : b.pointsEarned - a.pointsEarned
  })

  const strongest = ranked[0] ?? null
  const needsAttention = ranked.length > 1 ? ranked[ranked.length - 1] : null
  const mostConsistent =
    pillars.length > 0 ? [...pillars].sort((a, b) => b.currentStreak - a.currentStreak)[0] : null

  const highlights = [
    strongest && {
      key: "strongest",
      Icon: Trophy,
      label: "Strongest",
      pillar: strongest,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    needsAttention &&
      needsAttention.pillarId !== strongest?.pillarId && {
        key: "attention",
        Icon: AlertTriangle,
        label: "Needs Attention",
        pillar: needsAttention,
        colorClass: "text-destructive",
        bgClass: "bg-destructive/10",
      },
    mostConsistent &&
      mostConsistent.currentStreak > 0 && {
        key: "consistent",
        Icon: TrendingUp,
        label: "Most Consistent",
        pillar: mostConsistent,
        colorClass: "text-blue-400",
        bgClass: "bg-blue-400/10",
      },
  ].filter(Boolean) as {
    key: string
    Icon: ElementType
    label: string
    pillar: PillarFullStat
    colorClass: string
    bgClass: string
  }[]

  return (
    <div className="flex flex-col gap-4">
      {/* Header card: nav + highlights + rankings */}
      <Card>
        <CardContent>
          {/* Month navigation */}
          <div className="mb-4 flex items-center justify-between">
            <Link
              href={`/calendar?year=${prevYear}&month=${prevMonth}&view=pillars`}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <h2 className="text-lg font-semibold">{monthLabel}</h2>
            <Link
              href={`/calendar?year=${nextYear}&month=${nextMonth}&view=pillars`}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          {pillars.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No pillar activity this month.</p>
          ) : (
            <>
              {/* Highlight chips */}
              {highlights.length > 0 && (
                <div className="mb-5 flex flex-wrap gap-2">
                  {highlights.map(({ key, Icon, label, pillar, colorClass, bgClass }) => (
                    <div
                      key={key}
                      className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5", bgClass)}
                    >
                      <Icon className={cn("size-3.5 shrink-0", colorClass)} />
                      <span className={cn("text-xs font-medium", colorClass)}>{label}:</span>
                      <span className="text-xs font-semibold">
                        {pillar.icon} {pillar.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Rankings */}
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Rankings</h3>
              <ul className="flex flex-col gap-1">
                {ranked.map((p, i) => {
                  const rate = p.totalTasks > 0 ? p.completedTasks / p.totalTasks : 0
                  const { label, className } = statusInfo(rate)
                  return (
                    <li
                      key={p.pillarId}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/40"
                    >
                      <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">#{i + 1}</span>
                      <span aria-hidden>{p.icon}</span>
                      <span className="flex-1 text-sm font-medium">{p.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Math.round(rate * 100)}%
                      </span>
                      <span className={cn("text-xs font-semibold", className)}>{label}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* Per-pillar detail cards */}
      {ranked.map((pillar) => {
        const rate = pillar.totalTasks > 0 ? pillar.completedTasks / pillar.totalTasks : 0
        const ratePct = Math.round(rate * 100)
        const { label: statusLabel, className: statusClass } = statusInfo(rate)
        const isStrongest = strongest?.pillarId === pillar.pillarId
        const isConsistent =
          mostConsistent?.pillarId === pillar.pillarId && pillar.currentStreak > 0 && !isStrongest

        return (
          <Card key={pillar.pillarId}>
            <CardContent>
              {/* Pillar header */}
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  {pillar.icon}
                </span>
                <span className="flex-1 text-base font-semibold">{pillar.name}</span>
                {isStrongest && <Trophy className="size-4 text-primary" />}
                {isConsistent && <TrendingUp className="size-4 text-blue-400" />}
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
                  <div className="text-base font-bold text-primary">{pillar.pointsEarned}</div>
                  <div className="mt-0.5 text-[0.6rem] text-muted-foreground">Points Earned</div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="text-base font-bold text-primary">{pillar.currentStreak}</span>
                    {pillar.currentStreak > 0 && <Flame className="size-3.5 text-primary" />}
                  </div>
                  <div className="mt-0.5 text-[0.6rem] text-muted-foreground">Day Streak</div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-2.5 text-center">
                  <div className="text-base font-bold">{formatLastActive(pillar.lastActivityDate)}</div>
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
