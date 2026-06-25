"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"

import { createChallenge } from "@/app/actions/challenges"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PillarPicker, type PillarOption } from "@/components/pillar-picker"
import { cn } from "@/lib/utils"

const METRIC_OPTIONS: { value: "points" | "tasks"; label: string }[] = [
  { value: "points", label: "Points" },
  { value: "tasks", label: "Tasks" },
]

export function ChallengeFormDialog({
  pillars,
  onPillarCreated,
  onCreated,
}: {
  pillars: PillarOption[]
  onPillarCreated?: (pillar: PillarOption) => void
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [scoped, setScoped] = useState(false)
  const [pillarId, setPillarId] = useState<number | null>(pillars[0]?.id ?? null)
  const [metric, setMetric] = useState<"points" | "tasks">("points")
  const [durationDays, setDurationDays] = useState(7)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setTitle("")
    setScoped(false)
    setMetric("points")
    setDurationDays(7)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    if (scoped && pillarId === null) return

    startTransition(async () => {
      await createChallenge(trimmed, scoped ? pillarId : null, metric, durationDays)
      reset()
      setOpen(false)
      onCreated()
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
        New challenge
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>New Challenge</DialogTitle>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Challenge title (e.g. Most points this week)"
            className="rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
          />

          <div>
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">Scope</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScoped(false)}
                className={cn(
                  "rounded-lg border border-line px-3 py-1.5 text-sm transition-colors",
                  !scoped ? "border-primary bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                All pillars
              </button>
              <button
                type="button"
                onClick={() => setScoped(true)}
                className={cn(
                  "rounded-lg border border-line px-3 py-1.5 text-sm transition-colors",
                  scoped ? "border-primary bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                One pillar
              </button>
              {scoped && <PillarPicker pillars={pillars} value={pillarId} onChange={setPillarId} onPillarCreated={onPillarCreated} />}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">Metric</p>
            <div className="flex flex-wrap gap-1.5">
              {METRIC_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMetric(opt.value)}
                  className={cn(
                    "rounded-lg border border-line px-3 py-1.5 text-sm transition-colors",
                    metric === opt.value ? "border-primary bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Duration (days)</span>
            <input
              type="number"
              min={1}
              max={90}
              value={durationDays}
              onChange={(e) => setDurationDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm text-foreground outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim() || (scoped && pillarId === null) || isPending}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            Create challenge
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
