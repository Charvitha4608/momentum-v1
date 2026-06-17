"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, History } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { WeeklyReview } from "@/app/actions/reflection"

function formatRange(start: string, end: string) {
  const startLabel = new Date(`${start}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const endLabel = new Date(`${end}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return `${startLabel} – ${endLabel}`
}

function formatBestDay(dateStr: string | null) {
  if (!dateStr) return "—"
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" })
}

export function WeeklyReviewList({ reviews }: { reviews: WeeklyReview[] }) {
  const [expanded, setExpanded] = useState<number | null>(reviews[0]?.id ?? null)

  return (
    <Card>
      <CardContent>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <History className="size-4.5 text-primary" />
          Weekly Reviews
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">Auto-generated every week. Revisit past summaries below.</p>

        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your first weekly review will appear once a full week has passed.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reviews.map((r) => {
              const isOpen = expanded === r.id
              return (
                <li key={r.id} className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary/40"
                  >
                    <span className="font-medium">{formatRange(r.weekStart, r.weekEnd)}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">{r.pointsEarned} pts</span>
                      {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-3 border-t border-border px-3 py-3 text-sm sm:grid-cols-3">
                      <div>
                        <span className="block text-xs text-muted-foreground">Points earned</span>
                        {r.pointsEarned}
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Tasks completed</span>
                        {r.tasksCompleted}
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Streak</span>
                        {r.currentStreak} days
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Best day</span>
                        {formatBestDay(r.bestDay)}
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Most active</span>
                        {r.mostActivePillar ? `${r.mostActivePillar.icon} ${r.mostActivePillar.name}` : "—"}
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Least active</span>
                        {r.leastActivePillar ? `${r.leastActivePillar.icon} ${r.leastActivePillar.name}` : "—"}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
