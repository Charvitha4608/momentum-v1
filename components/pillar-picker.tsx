"use client"

import { useState, useTransition } from "react"
import { ChevronDown, Pencil, Plus } from "lucide-react"

import { createPillar, updatePillar } from "@/app/actions/pillars"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PILLAR_COLORS, PILLAR_ICONS } from "@/lib/pillar-icons"
import { cn } from "@/lib/utils"

export type PillarOption = {
  id: number
  name: string
  icon: string
  color: string
}

export function PillarPicker({
  pillars,
  value,
  onChange,
  onPillarCreated,
  onPillarUpdated,
}: {
  pillars: PillarOption[]
  value: number | null
  onChange: (id: number) => void
  onPillarCreated?: (pillar: PillarOption) => void
  onPillarUpdated?: (pillar: PillarOption) => void
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(PILLAR_ICONS[0])
  const [color, setColor] = useState(PILLAR_COLORS[0])
  const [isPending, startTransition] = useTransition()

  const selected = pillars.find((p) => p.id === value)
  const formOpen = creating || editingId !== null

  function resetForm() {
    setCreating(false)
    setEditingId(null)
    setName("")
    setIcon(PILLAR_ICONS[0])
    setColor(PILLAR_COLORS[0])
  }

  function startCreate() {
    setEditingId(null)
    setCreating(true)
    setName("")
    setIcon(PILLAR_ICONS[0])
    setColor(PILLAR_COLORS[0])
  }

  function startEdit(p: PillarOption) {
    setCreating(false)
    setEditingId(p.id)
    setName(p.name)
    setIcon(p.icon)
    setColor(p.color)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    if (editingId !== null) {
      const id = editingId
      startTransition(async () => {
        await updatePillar(id, { name: trimmed, icon, color })
        onPillarUpdated?.({ id, name: trimmed, icon, color })
        resetForm()
      })
    } else {
      startTransition(async () => {
        const created = await createPillar(trimmed, icon, color)
        if (created) {
          onPillarCreated?.(created)
          onChange(created.id)
          resetForm()
          setOpen(false)
        }
      })
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <PopoverTrigger
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-3"
        aria-label="Choose pillar"
      >
        {selected ? (
          <>
            <span aria-hidden>{selected.icon}</span>
            <span className="max-w-20 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Pillar</span>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start">
        <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
          {pillars.map((p) => (
            <li key={p.id}>
              <div
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg pr-1.5 transition-colors hover:bg-surface-3",
                  (p.id === value || p.id === editingId) && "bg-surface-3"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(p.id)
                    setOpen(false)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                >
                  <span aria-hidden>{p.icon}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Edit ${p.name}`}
                  onClick={() => startEdit(p)}
                  className="shrink-0 px-1 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {formOpen ? (
          <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pillar name"
              className="rounded-lg border border-line bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            <div className="flex flex-wrap gap-1">
              {PILLAR_ICONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIcon(opt)}
                  aria-label={`Icon ${opt}`}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg text-base transition-colors hover:bg-surface-3",
                    icon === opt && "bg-surface-3"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PILLAR_COLORS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setColor(opt)}
                  aria-label={`Color ${opt}`}
                  className={cn(
                    "size-5 rounded-full ring-2 ring-offset-2 ring-offset-surface-overlay transition-shadow",
                    color === opt ? "ring-foreground" : "ring-transparent"
                  )}
                  style={{ backgroundColor: opt }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!name.trim() || isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
              >
                {editingId !== null ? "Save" : "Create"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={startCreate}
            className="mt-2 flex w-full items-center gap-2 rounded-lg border-t border-line px-2 pt-2 text-sm text-primary transition-colors hover:text-primary/80"
          >
            <Plus className="size-3.5" aria-hidden />
            New pillar
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
