"use client"

import type React from "react"

import { useState, useTransition, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Plus, X, SlidersHorizontal } from "lucide-react"
import { addTarget, toggleTarget, deleteTarget, updateTargetTitle, getTodayTargets, type TargetSchedulingMeta } from "@/app/actions/targets"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PillarPicker, type PillarOption } from "@/components/pillar-picker"
import { RecurringTaskDialog } from "@/components/recurring-task-dialog"

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
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  return `${d}/${m}`
}

export function TargetList({
  initialTargets,
  date,
  pillars,
}: {
  initialTargets: Target[]
  date: string
  pillars: PillarOption[]
}) {
  const [items, setItems] = useState<Target[]>(initialTargets)
  const [pillarOptions, setPillarOptions] = useState<PillarOption[]>(pillars)
  const [newTitle, setNewTitle] = useState("")
  const [newPillarId, setNewPillarId] = useState<number | null>(pillars[0]?.id ?? null)
  const [newDuration, setNewDuration] = useState<number | null>(null)
  const [newTimeOfDay, setNewTimeOfDay] = useState<string | null>(null)
  const [metaOpen, setMetaOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [, startTransition] = useTransition()
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
      },
    ])
    setNewTitle("")
    inputRef.current?.focus()

    const meta: TargetSchedulingMeta | undefined =
      newDuration !== null || newTimeOfDay !== null
        ? { durationMinutes: newDuration, preferredTimeOfDay: newTimeOfDay }
        : undefined
    setNewDuration(null)
    setNewTimeOfDay(null)

    const realIdPromise = new Promise<number>((resolve) => {
      startTransition(async () => {
        const created = await addTarget(title, pillar.id, date, meta)
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

  function handleToggle(id: number, completed: boolean) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, completed } : it)))
    startTransition(async () => {
      const realId = await resolveId(id)
      await toggleTarget(realId, completed, date)
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

  function renderRow(item: Target) {
    return (
      <motion.li
        key={item.id}
        layout
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18 }}
        className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/50"
      >
        <Checkbox
          aria-label={item.completed ? `Mark "${item.title}" incomplete` : `Mark "${item.title}" complete`}
          checked={item.completed}
          onCheckedChange={(checked) => handleToggle(item.id, checked)}
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
            className="flex-1 bg-transparent text-base outline-none"
          />
        ) : (
          // COLOR: completed targets fade to muted-foreground + strikethrough; active targets use foreground
          <button
            type="button"
            onClick={() => startEdit(item)}
            className={`flex-1 text-left text-base ${
              item.completed ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {item.title}
          </button>
        )}

        {/* Pillar badge: icon + color dot identifying which pillar this target belongs to */}
        <span
          className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
          title={item.pillarName}
        >
          <span aria-hidden>{item.pillarIcon}</span>
          <span className="size-1.5 rounded-full" style={{ backgroundColor: item.pillarColor }} aria-hidden />
        </span>

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
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold">{formatDate(date)}</h2>
          <span className="text-sm text-muted-foreground">
            {completedItems.length}/{items.length} done
          </span>
        </div>

        <h3 className="mb-1 px-2 text-sm font-medium text-muted-foreground">Today's Targets</h3>
        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {activeItems.map(renderRow)}
            {items.length === 0 ? (
              <motion.li
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-2 py-2 text-sm text-muted-foreground"
              >
                No targets created for today.
              </motion.li>
            ) : (
              activeItems.length === 0 && (
                <motion.li
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-2 py-2 text-sm text-muted-foreground"
                >
                  All done for today 🎉
                </motion.li>
              )
            )}
          </AnimatePresence>
        </ul>

        {/* Add new target row */}
        <form onSubmit={handleAdd} className="mt-1 flex items-center gap-3 px-2 py-2">
          {/* COLOR: primary marks the "add" affordance */}
          <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add today's target…"
            aria-label="Add a new target"
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/60 outline-none"
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
                newDuration !== null || newTimeOfDay !== null
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <p className="mb-2 text-xs font-medium text-muted-foreground">For the AI Planner (optional)</p>
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
