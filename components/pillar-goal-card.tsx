"use client"

import { useState, useTransition } from "react"
import { Target, Trash2 } from "lucide-react"

import { deletePillarGoal, type PillarGoalWithProgress } from "@/app/actions/goals"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export function PillarGoalCard({ initialGoals }: { initialGoals: PillarGoalWithProgress[] }) {
  const [goals, setGoals] = useState(initialGoals)
  const [, startTransition] = useTransition()

  function handleDelete(id: number) {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    startTransition(() => deletePillarGoal(id))
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Target className="size-4.5 text-primary" />
          Pillar Goals
        </h2>

        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No monthly goals yet. Use &ldquo;New goal&rdquo; to set a points or sessions target for a pillar.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {goals.map((g) => (
              <li key={g.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span aria-hidden>{g.pillarIcon}</span>
                    {g.pillarName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {g.actual}/{g.targetValue} {g.metric === "points" ? "points" : "sessions"} this month
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete goal for ${g.pillarName}`}
                      onClick={() => handleDelete(g.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <Progress value={Math.min(100, g.progress)} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
