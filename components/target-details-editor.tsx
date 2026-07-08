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

// One focus session is 25 minutes; the quick chips set the estimate to a whole
// number of sessions (n × 25m), while the free input still accepts any minutes.
const SESSION_MINUTES = 25
const SESSION_CHOICES = [1, 2, 3, 4]

/** ceil(estimate / 25) — the passive "≈ N sessions" read-out. Null when unset. */
function sessionsFor(minutes: number | null): number | null {
  if (minutes == null || minutes <= 0) return null
  return Math.ceil(minutes / SESSION_MINUTES)
}

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
  onPillarUpdated,
  onSave,
}: {
  value: TargetDetailsValue
  pillars: PillarOption[]
  longTermGoals: ActiveLongTermGoal[]
  onPillarCreated: (pillar: PillarOption) => void
  onPillarUpdated?: (pillar: PillarOption) => void
  onSave: (next: TargetDetailsValue) => void
}) {
  const [open, setOpen] = useState(false)
  // Quantity may be temporarily blank while editing; it's coerced back to a
  // number on commit (see onOpenChange below), so callers always get a number.
  const [draft, setDraft] = useState<Omit<TargetDetailsValue, "quantity"> & { quantity: number | "" }>(value)

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
        else onSave({ ...draft, quantity: typeof draft.quantity === "number" && draft.quantity > 0 ? draft.quantity : 1 })
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
            onPillarUpdated={onPillarUpdated}
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
              onChange={(e) => {
                const v = e.target.value
                if (v === "") return setDraft((d) => ({ ...d, quantity: "" }))
                const n = Math.round(Number(v))
                setDraft((d) => ({ ...d, quantity: Number.isFinite(n) && n > 0 ? n : "" }))
              }}
              className="w-full rounded-md border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <p className="mb-1.5 text-xs text-foreground">Estimate</p>
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
              placeholder="minutes"
              className="w-full rounded-md border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Session-count shortcuts: chip n sets the estimate to n × 25m. */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            {SESSION_CHOICES.map((n) => {
              const minutes = n * SESSION_MINUTES
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, estimatedMinutes: d.estimatedMinutes === minutes ? null : minutes }))}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    draft.estimatedMinutes === minutes
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-secondary-foreground hover:bg-surface-3"
                  }`}
                >
                  {n} {n === 1 ? "session" : "sessions"}
                </button>
              )
            })}
          </div>
          {sessionsFor(draft.estimatedMinutes) !== null && (
            <p className="mt-1.5 text-xs text-muted-foreground">≈ {sessionsFor(draft.estimatedMinutes)} sessions</p>
          )}
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
