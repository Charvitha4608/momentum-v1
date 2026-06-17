"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"

import { createLongTermGoal, createPillarGoal } from "@/app/actions/goals"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PillarPicker, type PillarOption } from "@/components/pillar-picker"
import { cn } from "@/lib/utils"

type GoalType = "pillar" | "long-term"

const TYPE_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "pillar", label: "Pillar Goal" },
  { value: "long-term", label: "Long-Term Goal" },
]

const METRIC_OPTIONS: { value: "points" | "sessions"; label: string }[] = [
  { value: "points", label: "Points" },
  { value: "sessions", label: "Sessions" },
]

export function GoalFormDialog({
  pillars,
  today,
  onPillarCreated,
  onSaved,
}: {
  pillars: PillarOption[]
  today: string
  onPillarCreated?: (pillar: PillarOption) => void
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<GoalType>("pillar")
  const [pillarId, setPillarId] = useState<number | null>(pillars[0]?.id ?? null)
  const [metric, setMetric] = useState<"points" | "sessions">("points")
  const [targetValue, setTargetValue] = useState(100)
  const [title, setTitle] = useState("")
  const [deadline, setDeadline] = useState(today)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setType("pillar")
    setMetric("points")
    setTargetValue(100)
    setTitle("")
    setDeadline(today)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pillarId === null) return
    if (type === "long-term" && !title.trim()) return

    startTransition(async () => {
      if (type === "pillar") {
        await createPillarGoal(pillarId, metric, targetValue)
      } else {
        await createLongTermGoal(title, pillarId, targetValue, deadline)
      }
      reset()
      setOpen(false)
      onSaved()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
        <Plus className="size-4" />
        New goal
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>New Goal</DialogTitle>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={cn(
                  "rounded-lg border border-border px-3 py-1.5 text-sm transition-colors",
                  type === opt.value
                    ? "border-primary bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {type === "long-term" && (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Goal title (e.g. Finish NeetCode 150)"
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Pillar</span>
            <PillarPicker pillars={pillars} value={pillarId} onChange={setPillarId} onPillarCreated={onPillarCreated} />
          </div>

          {type === "pillar" && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-muted-foreground">Metric</p>
              <div className="flex flex-wrap gap-1.5">
                {METRIC_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMetric(opt.value)}
                    className={cn(
                      "rounded-lg border border-border px-3 py-1.5 text-sm transition-colors",
                      metric === opt.value
                        ? "border-primary bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{type === "pillar" ? "Target / month" : "Target tasks"}</span>
            <input
              type="number"
              min={1}
              value={targetValue}
              onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none"
            />
          </div>

          {type === "long-term" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Deadline</span>
              <input
                type="date"
                min={today}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={pillarId === null || isPending || (type === "long-term" && !title.trim())}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            Create goal
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
