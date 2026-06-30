"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarOff, Pause, Play, Settings2, Trash2 } from "lucide-react"

import {
  deactivateRecurringTask,
  getRecurringTasks,
  pauseRecurringTask,
  setRecurringEndDate,
  updateRecurringDays,
} from "@/app/actions/recurring"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { PillarOption } from "@/components/pillar-picker"
import { shiftDateString, getWeekRange } from "@/lib/date"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type RecurringRow = Awaited<ReturnType<typeof getRecurringTasks>>[number]
type PanelKind = "pause" | "stop" | "days" | "forever"

function formatDateLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Last calendar day of the month containing `today` (YYYY-MM-DD). */
function endOfMonth(today: string) {
  const [y, m] = today.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}

function parseDays(daysOfWeek: string | null): number[] {
  if (!daysOfWeek) return []
  try {
    const parsed = JSON.parse(daysOfWeek)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function ruleSummary(task: RecurringRow): string {
  switch (task.frequency) {
    case "daily":
      return "Every day"
    case "weekly": {
      const days = parseDays(task.daysOfWeek)
      if (days.length === 0) return "Weekly (no days set)"
      return `Weekly on ${days.map((d) => WEEKDAY_LABELS[d]).join(", ")}`
    }
    case "custom":
      return task.intervalDays && task.intervalDays > 0 ? `Every ${task.intervalDays} days` : "Custom"
    default:
      return task.frequency
  }
}

export function ManageRecurringDialog({ pillars, today }: { pillars: PillarOption[]; today: string }) {
  const [open, setOpen] = useState(false)
  const [tasks, setTasks] = useState<RecurringRow[] | null>(null)
  const [activePanel, setActivePanel] = useState<{ id: number; kind: PanelKind } | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function refresh() {
    const fresh = await getRecurringTasks()
    setTasks(fresh)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setTasks(null)
      void refresh()
    } else {
      setActivePanel(null)
    }
  }

  function togglePanel(id: number, kind: PanelKind) {
    setActivePanel((cur) => (cur && cur.id === id && cur.kind === kind ? null : { id, kind }))
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      await refresh()
      setActivePanel(null)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        aria-label="Manage recurring tasks"
        title="Manage recurring tasks"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted-foreground transition-colors hover:text-primary"
      >
        <Settings2 className="size-4" aria-hidden />
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogTitle>Manage Recurring Tasks</DialogTitle>

        <div className="mt-4 flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {tasks === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active recurring tasks.</p>
          ) : (
            tasks.map((task) => {
              const pillar = pillars.find((p) => p.id === task.pillarId)
              const panel = activePanel?.id === task.id ? activePanel.kind : null
              return (
                <div key={task.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {pillar && (
                          <span className="flex items-center gap-1" title={pillar.name}>
                            <span aria-hidden>{pillar.icon}</span>
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: pillar.color }} aria-hidden />
                          </span>
                        )}
                        <span>{ruleSummary(task)}</span>
                      </p>
                      {(task.pausedUntil || task.endDate) && (
                        <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                          {task.pausedUntil && (
                            <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-muted-foreground">
                              Paused until {formatDateLabel(task.pausedUntil)}
                            </span>
                          )}
                          {task.endDate && (
                            <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-muted-foreground">
                              Stops {formatDateLabel(task.endDate)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <ControlButton active={panel === "pause"} onClick={() => togglePanel(task.id, "pause")}>
                      <Pause className="size-3.5" aria-hidden /> Pause
                    </ControlButton>
                    <ControlButton active={panel === "stop"} onClick={() => togglePanel(task.id, "stop")}>
                      <CalendarOff className="size-3.5" aria-hidden /> Stop on date
                    </ControlButton>
                    {task.frequency === "weekly" && (
                      <ControlButton active={panel === "days"} onClick={() => togglePanel(task.id, "days")}>
                        <Settings2 className="size-3.5" aria-hidden /> Edit weekdays
                      </ControlButton>
                    )}
                    <ControlButton active={panel === "forever"} onClick={() => togglePanel(task.id, "forever")}>
                      <Trash2 className="size-3.5" aria-hidden /> Stop forever
                    </ControlButton>
                  </div>

                  {panel === "pause" && (
                    <PresetRow label="Resume on">
                      <Preset onClick={() => run(() => pauseRecurringTask(task.id, shiftDateString(today, 1)))}>
                        Tomorrow
                      </Preset>
                      <Preset onClick={() => run(() => pauseRecurringTask(task.id, shiftDateString(today, 3)))}>
                        In 3 days
                      </Preset>
                      <Preset onClick={() => run(() => pauseRecurringTask(task.id, shiftDateString(today, 7)))}>
                        Next week
                      </Preset>
                      <DatePreset
                        min={shiftDateString(today, 1)}
                        onPick={(value) => run(() => pauseRecurringTask(task.id, value))}
                      />
                      {task.pausedUntil && (
                        <Preset active onClick={() => run(() => pauseRecurringTask(task.id, null))}>
                          <Play className="size-3 shrink-0" aria-hidden /> Resume now
                        </Preset>
                      )}
                    </PresetRow>
                  )}

                  {panel === "stop" && (
                    <PresetRow label="Stop after">
                      <Preset onClick={() => run(() => setRecurringEndDate(task.id, getWeekRange(today).end))}>
                        End of this week
                      </Preset>
                      <Preset onClick={() => run(() => setRecurringEndDate(task.id, endOfMonth(today)))}>
                        End of this month
                      </Preset>
                      <DatePreset min={today} onPick={(value) => run(() => setRecurringEndDate(task.id, value))} />
                      {task.endDate && (
                        <Preset active onClick={() => run(() => setRecurringEndDate(task.id, null))}>
                          Clear
                        </Preset>
                      )}
                    </PresetRow>
                  )}

                  {panel === "days" && task.frequency === "weekly" && (
                    <WeekdayEditor
                      initial={parseDays(task.daysOfWeek)}
                      onSave={(days) => run(() => updateRecurringDays(task.id, days))}
                    />
                  )}

                  {panel === "forever" && (
                    <PresetRow label="Stop forever — this template will stop generating">
                      <Preset active onClick={() => run(() => deactivateRecurringTask(task.id))}>
                        <Trash2 className="size-3 shrink-0" aria-hidden /> Confirm stop
                      </Preset>
                      <Preset onClick={() => setActivePanel(null)}>Cancel</Preset>
                    </PresetRow>
                  )}
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ControlButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs transition-colors",
        active ? "border-primary bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function PresetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2.5 border-t border-line pt-2.5">
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function Preset({
  active = false,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs transition-colors",
        active ? "border-primary bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function DatePreset({ min, onPick }: { min: string; onPick: (value: string) => void }) {
  return (
    <input
      type="date"
      min={min}
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value)
      }}
      aria-label="Pick a date"
      className="rounded-lg border border-line bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
    />
  )
}

function WeekdayEditor({ initial, onSave }: { initial: number[]; onSave: (days: number[]) => void }) {
  const [days, setDays] = useState<number[]>(initial)
  function toggle(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }
  return (
    <PresetRow label="Days of week">
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_LABELS.map((label, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => toggle(idx)}
            className={cn(
              "rounded-lg border border-line px-2 py-1 text-xs transition-colors",
              days.includes(idx)
                ? "border-primary bg-surface-3 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={days.length === 0}
        onClick={() => onSave(days)}
        className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
      >
        Save days
      </button>
    </PresetRow>
  )
}
