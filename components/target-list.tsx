"use client"

import type React from "react"

import { useState, useEffect, useTransition, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Plus, X, SlidersHorizontal, Check } from "lucide-react"
import { addTarget, toggleTarget, deleteTarget, updateTargetTitle, updateTargetDetails, getTodayTargets, type TargetSchedulingMeta, type TargetEffortMeta } from "@/app/actions/targets"
import type { ActiveLongTermGoal } from "@/app/actions/goals"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PillarPicker, type PillarOption } from "@/components/pillar-picker"
import { RecurringTaskDialog } from "@/components/recurring-task-dialog"
import { TargetDetailsEditor, type TargetDetailsValue } from "@/components/target-details-editor"

const TIME_OF_DAY_CHOICES = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const

const DURATION_CHOICES = [15, 30, 45, 60, 90, 120]

type Target = {
  id: number
  title: string
  completed: boolean
  date: string
  points: number
  sortOrder: number
  pillarId: number
  pillarName: string
  pillarIcon: string
  pillarColor: string
  quantity: number
  estimatedMinutes: number | null
  actualMinutes: number | null
  longTermGoalId: number | null
  durationMinutes: number | null
  preferredTimeOfDay: string | null
}

export function TargetList({
  initialTargets,
  date,
  pillars,
  longTermGoals = [],
}: {
  initialTargets: Target[]
  date: string
  pillars: PillarOption[]
  longTermGoals?: ActiveLongTermGoal[]
}) {
  const [items, setItems] = useState<Target[]>(initialTargets)
  const [pillarOptions, setPillarOptions] = useState<PillarOption[]>(pillars)
  const [newTitle, setNewTitle] = useState("")
  const [newPillarId, setNewPillarId] = useState<number | null>(pillars[0]?.id ?? null)
  const [newDuration, setNewDuration] = useState<number | null>(null)
  const [newTimeOfDay, setNewTimeOfDay] = useState<string | null>(null)
  const [newQuantity, setNewQuantity] = useState(1)
  const [newEstimatedMinutes, setNewEstimatedMinutes] = useState<number | null>(null)
  const [newGoalId, setNewGoalId] = useState<number | null>(null)
  const [metaOpen, setMetaOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  // Target awaiting an actual-minutes entry after the user checked it complete.
  const [completingId, setCompletingId] = useState<number | null>(null)
  const [actualValue, setActualValue] = useState("")
  const [, startTransition] = useTransition()

  // Long-term goals available for the currently-selected pillar. Default-select
  // the lone goal when there's exactly one; otherwise leave it unset.
  const goalsForPillar = longTermGoals.filter((g) => g.pillarId === newPillarId)
  useEffect(() => {
    setNewGoalId(goalsForPillar.length === 1 ? goalsForPillar[0].id : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPillarId])
  const inputRef = useRef<HTMLInputElement>(null)
  // Maps a temporary optimistic ID (negative) to a promise that resolves once
  // the server assigns the real database ID for that target.
  const pendingIds = useRef(new Map<number, Promise<number>>())

  /** Resolves a (possibly temporary, negative) target ID to its real database ID. */
  async function resolveId(id: number): Promise<number> {
    if (id >= 0) return id
    return pendingIds.current.get(id) ?? id
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title || newPillarId === null) return
    const pillar = pillarOptions.find((p) => p.id === newPillarId)
    if (!pillar) return
    const quantity = newQuantity > 0 ? Math.round(newQuantity) : 1
    // optimistic
    const tempId = -Date.now()
    setItems((prev) => [
      ...prev,
      {
        id: tempId,
        title,
        completed: false,
        date,
        points: 10,
        sortOrder: prev.length + 1,
        pillarId: pillar.id,
        pillarName: pillar.name,
        pillarIcon: pillar.icon,
        pillarColor: pillar.color,
        quantity,
        estimatedMinutes: newEstimatedMinutes,
        actualMinutes: null,
        longTermGoalId: newGoalId,
        durationMinutes: newDuration,
        preferredTimeOfDay: newTimeOfDay,
      },
    ])
    setNewTitle("")
    inputRef.current?.focus()

    const meta: TargetSchedulingMeta | undefined =
      newDuration !== null || newTimeOfDay !== null
        ? { durationMinutes: newDuration, preferredTimeOfDay: newTimeOfDay }
        : undefined
    const effort: TargetEffortMeta = {
      quantity,
      estimatedMinutes: newEstimatedMinutes,
      longTermGoalId: newGoalId,
    }
    setNewDuration(null)
    setNewTimeOfDay(null)
    setNewQuantity(1)
    setNewEstimatedMinutes(null)
    setNewGoalId(goalsForPillar.length === 1 ? goalsForPillar[0].id : null)

    const realIdPromise = new Promise<number>((resolve) => {
      startTransition(async () => {
        const created = await addTarget(title, pillar.id, date, meta, effort)
        if (created) {
          setItems((prev) => prev.map((it) => (it.id === tempId ? { ...it, id: created.id } : it)))
          resolve(created.id)
        } else {
          setItems((prev) => prev.filter((it) => it.id !== tempId))
          resolve(tempId)
        }
        pendingIds.current.delete(tempId)
      })
    })
    pendingIds.current.set(tempId, realIdPromise)
  }

  // Checking a target opens the actual-minutes prompt instead of completing
  // immediately; unchecking completes the reverse and clears the recorded time.
  function handleCheck(id: number, checked: boolean) {
    if (checked) {
      setCompletingId(id)
      setActualValue("")
      return
    }
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, completed: false, actualMinutes: null } : it)))
    startTransition(async () => {
      const realId = await resolveId(id)
      await toggleTarget(realId, false, date)
    })
  }

  function confirmComplete(id: number) {
    const parsed = actualValue.trim() === "" ? null : Number(actualValue)
    const minutes = parsed != null && Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, completed: true, actualMinutes: minutes } : it)))
    setCompletingId(null)
    setActualValue("")
    startTransition(async () => {
      const realId = await resolveId(id)
      await toggleTarget(realId, true, date, minutes)
    })
  }

  function handleDelete(id: number) {
    setItems((prev) => prev.filter((it) => it.id !== id))
    startTransition(async () => {
      const realId = await resolveId(id)
      await deleteTarget(realId, date)
    })
  }

  function startEdit(item: Target) {
    setEditingId(item.id)
    setEditValue(item.title)
  }

  function commitEdit(id: number) {
    const title = editValue.trim()
    if (title) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, title } : it)))
      startTransition(async () => {
        const realId = await resolveId(id)
        await updateTargetTitle(realId, title)
      })
    }
    setEditingId(null)
  }

  // Saves edited details (pillar + effort/scheduling fields) for an existing
  // target. Updates the row optimistically — including the denormalised pillar
  // display fields — then persists via updateTargetDetails.
  function saveDetails(id: number, next: TargetDetailsValue) {
    const pillar = pillarOptions.find((p) => p.id === next.pillarId)
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              pillarId: next.pillarId,
              pillarName: pillar?.name ?? it.pillarName,
              pillarIcon: pillar?.icon ?? it.pillarIcon,
              pillarColor: pillar?.color ?? it.pillarColor,
              quantity: next.quantity,
              estimatedMinutes: next.estimatedMinutes,
              longTermGoalId: next.longTermGoalId,
              durationMinutes: next.durationMinutes,
              preferredTimeOfDay: next.preferredTimeOfDay,
            }
          : it
      )
    )
    startTransition(async () => {
      const realId = await resolveId(id)
      await updateTargetDetails(realId, next)
    })
  }

  /**
   * Pre-completion effort badges: a "×{quantity}" count (e.g. ×5 LeetCode
   * questions) and an "~{n}m" time estimate. Each is shown only when set
   * (quantity > 1, estimate present) as a small pill so the numbers read
   * clearly on the row.
   */
  function renderEffortHint(item: Target) {
    const showQty = item.quantity != null && item.quantity > 1
    const showEst = item.estimatedMinutes != null
    if (!showQty && !showEst) return null
    return (
      <span className="flex shrink-0 items-center gap-1">
        {showQty && (
          <span
            className="rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
            title={`Quantity: ${item.quantity}`}
          >
            ×{item.quantity}
          </span>
        )}
        {showEst && (
          <span
            className="rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
            title={`Estimated ${item.estimatedMinutes} minutes`}
          >
            ~{item.estimatedMinutes}m
          </span>
        )}
      </span>
    )
  }

  /** Post-completion summary: "est {e}m / actual {a}m" + over/under delta. */
  function renderTimeSummary(item: Target) {
    const { estimatedMinutes: est, actualMinutes: act } = item
    if (est == null && act == null) return null
    if (est == null) return <span className="shrink-0 text-xs text-muted-foreground">actual {act}m</span>
    if (act == null) return <span className="shrink-0 text-xs text-muted-foreground">est {est}m</span>
    const delta = act - est
    // COLOR: over estimate reads as a warning (amber), under/on as positive (green).
    const deltaLabel = delta > 0 ? `+${delta} over` : delta < 0 ? `${delta} under` : "on time"
    const deltaColor = delta > 0 ? "text-amber-500" : "text-emerald-500"
    return (
      <span className="shrink-0 text-xs text-muted-foreground">
        est {est}m / actual {act}m <span className={deltaColor}>({deltaLabel})</span>
      </span>
    )
  }

  function renderRow(item: Target) {
    return (
      <motion.li
        key={item.id}
        layout
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 hover:bg-secondary/50"
      >
        <Checkbox
          aria-label={item.completed ? `Mark "${item.title}" incomplete` : `Mark "${item.title}" complete`}
          checked={item.completed || completingId === item.id}
          onCheckedChange={(checked) => handleCheck(item.id, checked)}
        />

        {editingId === item.id ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => commitEdit(item.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit(item.id)
              if (e.key === "Escape") setEditingId(null)
            }}
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        ) : (
          // COLOR: completed targets fade to muted-foreground + strikethrough; active targets use foreground
          <button
            type="button"
            onClick={() => startEdit(item)}
            className={`min-w-0 flex-1 break-words text-left text-base ${
              item.completed ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {item.title}
          </button>
        )}

        {/* Effort / time tracking: hint before completion, summary after */}
        {editingId !== item.id && (item.completed ? renderTimeSummary(item) : renderEffortHint(item))}

        {/* Actual-minutes prompt shown after the user checks a target complete */}
        {completingId === item.id && (
          <span className="flex shrink-0 items-center gap-1">
            <input
              autoFocus
              type="number"
              min={0}
              inputMode="numeric"
              value={actualValue}
              onChange={(e) => setActualValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmComplete(item.id)
                if (e.key === "Escape") {
                  setCompletingId(null)
                  setActualValue("")
                }
              }}
              placeholder="actual min"
              aria-label="Actual minutes spent"
              className="w-20 rounded-md border border-border bg-transparent px-1.5 py-0.5 text-xs outline-none focus:border-primary"
            />
            <button
              type="button"
              aria-label="Confirm completion"
              onClick={() => confirmComplete(item.id)}
              className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </span>
        )}

        {/* Pillar pill: color dot + pillar name */}
        <span
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11.5px] font-medium text-muted-foreground sm:flex"
          title={item.pillarName}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: item.pillarColor }} aria-hidden />
          {item.pillarName}
        </span>

        {/* Point chip: points this target is worth */}
        <span className="shrink-0 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
          +{item.points}
        </span>

        {/* Edit details: pillar, duration & effort (rename happens via the title) */}
        {editingId !== item.id && completingId !== item.id && (
          <TargetDetailsEditor
            value={{
              pillarId: item.pillarId,
              quantity: item.quantity,
              estimatedMinutes: item.estimatedMinutes,
              longTermGoalId: item.longTermGoalId,
              durationMinutes: item.durationMinutes,
              preferredTimeOfDay: item.preferredTimeOfDay,
            }}
            pillars={pillarOptions}
            longTermGoals={longTermGoals}
            onPillarCreated={(pillar) => setPillarOptions((prev) => [...prev, pillar])}
            onSave={(next) => saveDetails(item.id, next)}
          />
        )}

        {/* COLOR: delete icon turns destructive on hover to signal a removal action */}
        <button
          type="button"
          aria-label={`Delete "${item.title}"`}
          onClick={() => handleDelete(item.id)}
          className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.li>
    )
  }

  const activeItems = items.filter((item) => !item.completed)
  const completedItems = items.filter((item) => item.completed)

  return (
    <Card className="w-full">
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            Today&apos;s targets
          </h2>
          <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {completedItems.length} / {items.length} done
          </span>
        </div>

        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {activeItems.map(renderRow)}
            {items.length === 0 ? (
              <motion.li
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-2 py-3 text-sm text-muted-foreground"
              >
                Nothing planned yet — add your first target below to get the day going.
              </motion.li>
            ) : (
              activeItems.length === 0 && (
                <motion.li
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-2 py-3 text-sm text-muted-foreground"
                >
                  All targets done — enjoy the rest of your day 🎉
                </motion.li>
              )
            )}
          </AnimatePresence>
        </ul>

        {/* Add new target row */}
        <form onSubmit={handleAdd} className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2">
          {/* COLOR: primary marks the "add" affordance */}
          <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add today's target…"
            aria-label="Add a new target"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          <PillarPicker
            pillars={pillarOptions}
            value={newPillarId}
            onChange={setNewPillarId}
            onPillarCreated={(pillar) => setPillarOptions((prev) => [...prev, pillar])}
          />
          <Popover open={metaOpen} onOpenChange={setMetaOpen}>
            <PopoverTrigger
              type="button"
              aria-label="Add planning details"
              title="Duration & preferred time (helps the AI Planner)"
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                newDuration !== null || newTimeOfDay !== null || newQuantity !== 1 || newEstimatedMinutes !== null || newGoalId !== null
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent className="w-60 p-3" align="end">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Task details (optional)</p>

              {goalsForPillar.length > 0 && (
                <>
                  <p className="mb-1.5 text-xs text-foreground">Counts toward goal</p>
                  <select
                    value={newGoalId ?? ""}
                    onChange={(e) => setNewGoalId(e.target.value === "" ? null : Number(e.target.value))}
                    className="mb-3 w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
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
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                    className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="flex-1">
                  <p className="mb-1.5 text-xs text-foreground">Est. minutes</p>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={newEstimatedMinutes ?? ""}
                    onChange={(e) => setNewEstimatedMinutes(e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    placeholder="—"
                    className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <p className="mb-1.5 text-xs text-foreground">Duration</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {DURATION_CHOICES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNewDuration((cur) => (cur === m ? null : m))}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      newDuration === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                    }`}
                  >
                    {m < 60 ? `${m}m` : `${m / 60}h`}
                  </button>
                ))}
              </div>
              <p className="mb-1.5 text-xs text-foreground">Preferred time</p>
              <div className="flex flex-wrap gap-1.5">
                {TIME_OF_DAY_CHOICES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewTimeOfDay((cur) => (cur === c.value ? null : c.value))}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      newTimeOfDay === c.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <RecurringTaskDialog
            pillars={pillarOptions}
            defaultPillarId={newPillarId}
            today={date}
            onPillarCreated={(pillar) => setPillarOptions((prev) => [...prev, pillar])}
            onSaved={() => {
              startTransition(async () => {
                const fresh = await getTodayTargets(date)
                setItems(fresh.filter((t) => t.originalDate === date))
              })
            }}
          />
        </form>

        {completedItems.length > 0 && (
          <>
            <h3 className="mt-5 mb-1 border-t border-border px-2 pt-4 text-sm font-medium text-muted-foreground">
              Completed Today
            </h3>
            <ul className="flex flex-col gap-1">
              <AnimatePresence initial={false}>{completedItems.map(renderRow)}</AnimatePresence>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
