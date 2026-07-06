"use client"

import { useEffect, useState, useTransition } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronRight, Target, Trash2 } from "lucide-react"

import {
  deletePillarGoal,
  getPillarGoalBreakdown,
  type PillarGoalContribution,
  type PillarGoalWithProgress,
} from "@/app/actions/goals"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function PillarGoalCard({ initialGoals }: { initialGoals: PillarGoalWithProgress[] }) {
  const [goals, setGoals] = useState(initialGoals)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const reduceMotion = useReducedMotion()
  const [, startTransition] = useTransition()

  function handleDelete(id: number) {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    if (expandedId === id) setExpandedId(null)
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
            {goals.map((g) => {
              const expanded = expandedId === g.id
              const pct = Math.min(100, g.progress)
              return (
                <li key={g.id}>
                  <div className="flex items-center justify-between gap-2">
                    {/* Chevron + icon + name toggles the contributing-tasks breakdown */}
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Collapse" : "Expand"} ${g.pillarName} goal breakdown`}
                      onClick={() => setExpandedId((cur) => (cur === g.id ? null : g.id))}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-medium"
                    >
                      <ChevronRight
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground transition-transform",
                          expanded && "rotate-90"
                        )}
                        aria-hidden
                      />
                      <span aria-hidden>{g.pillarIcon}</span>
                      <span className="truncate">{g.pillarName}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {g.used}/{g.targetValue} {g.metric === "points" ? "pts" : "sessions"}
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

                  {/* Progress bar in the pillar's accent color (pillar token, no hardcoded color) */}
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: g.pillarColor }}
                    />
                  </div>

                  <p className="mt-1.5 text-xs text-muted-foreground">{g.daysLeft}d left this month</p>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <PillarGoalBreakdown pillarId={g.pillarId} accent={g.pillarColor} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Read-only list of the completed tasks feeding a pillar goal's current cycle.
 * Lazy-loaded the first time its row is expanded, mirroring PillarChecklist.
 */
function PillarGoalBreakdown({ pillarId, accent }: { pillarId: number; accent: string }) {
  const [items, setItems] = useState<PillarGoalContribution[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getPillarGoalBreakdown(pillarId).then((rows) => {
      if (!cancelled) setItems(rows)
    })
    return () => {
      cancelled = true
    }
  }, [pillarId])

  if (items === null) {
    return <p className="px-1 pt-2 text-xs text-muted-foreground">Loading…</p>
  }
  if (items.length === 0) {
    return <p className="px-1 pt-2 text-xs text-muted-foreground">Nothing in this cycle yet.</p>
  }

  return (
    <ul className="mt-2 flex flex-col gap-1 border-l-2 pl-3" style={{ borderColor: accent }}>
      {items.map((it) => (
        <li key={it.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-foreground">{it.title}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {it.metric === "sessions" ? `${it.value}m` : `+${it.value}`}
          </span>
        </li>
      ))}
    </ul>
  )
}
