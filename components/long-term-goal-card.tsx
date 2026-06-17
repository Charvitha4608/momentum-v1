"use client"

import { useState, useTransition } from "react"
import { Flag, Trash2 } from "lucide-react"

import { deleteLongTermGoal, type LongTermGoalWithProgress } from "@/app/actions/goals"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

function daysUntil(today: string, deadline: string): number {
  const [ty, tm, td] = today.split("-").map(Number)
  const [dy, dm, dd] = deadline.split("-").map(Number)
  return Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 86400000)
}

function formatDeadline(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function LongTermGoalCard({ initialGoals, today }: { initialGoals: LongTermGoalWithProgress[]; today: string }) {
  const [goals, setGoals] = useState(initialGoals)
  const [, startTransition] = useTransition()

  function handleDelete(id: number) {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    startTransition(() => deleteLongTermGoal(id))
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Flag className="size-4.5 text-primary" />
          Long-Term Goals
        </h2>

        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No long-term goals yet. Use &ldquo;New goal&rdquo; to track progress toward a bigger milestone.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {goals.map((g) => {
              const daysLeft = daysUntil(today, g.deadline)
              return (
                <li key={g.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <span aria-hidden>{g.pillarIcon}</span>
                      {g.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {g.current}/{g.targetValue}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete goal "${g.title}"`}
                        onClick={() => handleDelete(g.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <Progress value={Math.min(100, g.progress)} />
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Due {formatDeadline(g.deadline)}</span>
                    {g.completed ? (
                      <span className="font-medium text-primary">Completed 🎉</span>
                    ) : (
                      <span className={cn(daysLeft < 0 && "text-destructive")}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
