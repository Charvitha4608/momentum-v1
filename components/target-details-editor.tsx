"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PillarPicker, type PillarOption } from "@/components/pillar-picker"
import type { ActiveLongTermGoal } from "@/app/actions/goals"

const TIME_OF_DAY_CHOICES = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const

const DURATION_CHOICES = [15, 30, 45, 60, 90, 120]

export type TargetDetailsValue = {
  pillarId: number
  quantity: number
  estimatedMinutes: number | null
  longTermGoalId: number | null
  durationMinutes: number | null
  preferredTimeOfDay: string | null
}

/**
 * Per-row "edit details" popover for an existing target. Mirrors the fields of
 * the add-target details panel (pillar, goal, quantity, est. minutes, duration,
 * preferred time) but pre-filled from the target's current values. Edits are
 * held in local draft state and flushed via `onSave` when the popover closes or
 * Save is pressed, so the parent can update optimistically.
 */
export function TargetDetailsEditor({
  value,
  pillars,
  longTermGoals,
  onPillarCreated,
  onSave,
}: {
  value: TargetDetailsValue
  pillars: PillarOption[]
  longTermGoals: ActiveLongTermGoal[]
  onPillarCreated: (pillar: PillarOption) => void
  onSave: (next: TargetDetailsValue) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<TargetDetailsValue>(value)

  const goalsForPillar = longTermGoals.filter((g) => g.pillarId === draft.pillarId)

  // Closing the popover is the single commit path (see onOpenChange below), so
  // Save just closes rather than firing onSave a second time.
  function commit() {
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Opening: seed the draft from the latest value. Closing (click-away):
        // commit whatever's in the draft so edits aren't silently lost.
        if (next) setDraft(value)
        else onSave(draft)
        setOpen(next)
      }}
    >
      <PopoverTrigger
        type="button"
        aria-label="Edit task details"
        title="Edit pillar, duration & effort"
        className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        <Pencil className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3" align="end">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Edit task details</p>

        <p className="mb-1.5 text-xs text-foreground">Pillar</p>
        <div className="mb-3">
          <PillarPicker
            pillars={pillars}
            value={draft.pillarId}
            onChange={(id) =>
              setDraft((d) => ({
                ...d,
                pillarId: id ?? d.pillarId,
                // Dropping into a pillar the current goal doesn't belong to clears the link.
                longTermGoalId: longTermGoals.some((g) => g.id === d.longTermGoalId && g.pillarId === id)
                  ? d.longTermGoalId
                  : null,
              }))
            }
            onPillarCreated={onPillarCreated}
          />
        </div>

        {goalsForPillar.length > 0 && (
          <>
            <p className="mb-1.5 text-xs text-foreground">Counts toward goal</p>
            <select
              value={draft.longTermGoalId ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, longTermGoalId: e.target.value === "" ? null : Number(e.target.value) }))}
              className="mb-3 w-full rounded-md border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
            >
              <option value="">None</option>
              {goalsForPillar.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="mb-1.5 text-xs text-foreground">Quantity</p>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={draft.quantity}
              onChange={(e) => setDraft((d) => ({ ...d, quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) }))}
              className="w-full rounded-md border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <p className="mb-1.5 text-xs text-foreground">Est. minutes</p>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.estimatedMinutes ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  estimatedMinutes: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value) || 0)),
                }))
              }
              placeholder="—"
              className="w-full rounded-md border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        <p className="mb-1.5 text-xs text-foreground">Duration</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {DURATION_CHOICES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, durationMinutes: d.durationMinutes === m ? null : m }))}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                draft.durationMinutes === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-secondary-foreground hover:bg-surface-3"
              }`}
            >
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </button>
          ))}
        </div>

        <p className="mb-1.5 text-xs text-foreground">Preferred time</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TIME_OF_DAY_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, preferredTimeOfDay: d.preferredTimeOfDay === c.value ? null : c.value }))}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                draft.preferredTimeOfDay === c.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-secondary-foreground hover:bg-surface-3"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={commit}
          className="w-full rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Save
        </button>
      </PopoverContent>
    </Popover>
  )
}
