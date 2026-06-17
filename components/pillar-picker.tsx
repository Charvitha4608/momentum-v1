"use client"

import { useState, useTransition } from "react"
import { ChevronDown, Plus } from "lucide-react"

import { createPillar } from "@/app/actions/pillars"
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
}: {
  pillars: PillarOption[]
  value: number | null
  onChange: (id: number) => void
  onPillarCreated?: (pillar: PillarOption) => void
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(PILLAR_ICONS[0])
  const [color, setColor] = useState(PILLAR_COLORS[0])
  const [isPending, startTransition] = useTransition()

  const selected = pillars.find((p) => p.id === value)

  function resetCreateForm() {
    setCreating(false)
    setName("")
    setIcon(PILLAR_ICONS[0])
    setColor(PILLAR_COLORS[0])
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    startTransition(async () => {
      const created = await createPillar(trimmed, icon, color)
      if (created) {
        onPillarCreated?.(created)
        onChange(created.id)
        resetCreateForm()
        setOpen(false)
      }
    })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetCreateForm()
      }}
    >
      <PopoverTrigger
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/50"
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
              <button
                type="button"
                onClick={() => {
                  onChange(p.id)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/50",
                  p.id === value && "bg-secondary"
                )}
              >
                <span aria-hidden>{p.icon}</span>
                <span className="flex-1 truncate">{p.name}</span>
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        {creating ? (
          <form onSubmit={handleCreate} className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pillar name"
              className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            <div className="flex flex-wrap gap-1">
              {PILLAR_ICONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIcon(opt)}
                  aria-label={`Icon ${opt}`}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg text-base transition-colors hover:bg-secondary/50",
                    icon === opt && "bg-secondary"
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
                    "size-5 rounded-full ring-2 ring-offset-2 ring-offset-card transition-shadow",
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
                Create
              </button>
              <button
                type="button"
                onClick={resetCreateForm}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-2 flex w-full items-center gap-2 rounded-lg border-t border-border px-2 pt-2 text-sm text-primary transition-colors hover:text-primary/80"
          >
            <Plus className="size-3.5" aria-hidden />
            New pillar
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
