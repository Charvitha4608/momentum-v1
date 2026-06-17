"use client"

import { useState, useTransition } from "react"
import { Repeat } from "lucide-react"

import { addTarget } from "@/app/actions/targets"
import { createRecurringTask, type RecurringFrequency } from "@/app/actions/recurring"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PillarPicker, type PillarOption } from "@/components/pillar-picker"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DEFAULT_POINTS = 10

type Frequency = "one-time" | RecurringFrequency

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "one-time", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
]

export function RecurringTaskDialog({
  pillars,
  defaultPillarId,
  today,
  onPillarCreated,
  onSaved,
}: {
  pillars: PillarOption[]
  defaultPillarId: number | null
  today: string
  onPillarCreated?: (pillar: PillarOption) => void
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [pillarId, setPillarId] = useState<number | null>(defaultPillarId)
  const [frequency, setFrequency] = useState<Frequency>("one-time")
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [intervalDays, setIntervalDays] = useState(2)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setTitle("")
    setFrequency("one-time")
    setDaysOfWeek([])
    setIntervalDays(2)
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || pillarId === null) return
    if (frequency === "weekly" && daysOfWeek.length === 0) return

    startTransition(async () => {
      if (frequency === "one-time") {
        await addTarget(trimmed, pillarId, today)
      } else {
        await createRecurringTask(trimmed, pillarId, DEFAULT_POINTS, frequency, {
          daysOfWeek: frequency === "weekly" ? daysOfWeek : undefined,
          intervalDays: frequency === "custom" ? intervalDays : undefined,
          anchorDate: today,
        })
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
      <DialogTrigger
        aria-label="New recurring task"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-primary"
      >
        <Repeat className="size-4" aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>New Task</DialogTitle>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            <PillarPicker pillars={pillars} value={pillarId} onChange={setPillarId} onPillarCreated={onPillarCreated} />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">Frequency</p>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value)}
                  className={cn(
                    "rounded-lg border border-border px-3 py-1.5 text-sm transition-colors",
                    frequency === opt.value
                      ? "border-primary bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {frequency === "weekly" && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-muted-foreground">Days of week</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={cn(
                      "rounded-lg border border-border px-2.5 py-1.5 text-xs transition-colors",
                      daysOfWeek.includes(idx)
                        ? "border-primary bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequency === "custom" && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-muted-foreground">Repeat every</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Math.max(2, Number(e.target.value) || 2))}
                  className="w-20 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!title.trim() || pillarId === null || isPending}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            {frequency === "one-time" ? "Add target" : "Create recurring task"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
