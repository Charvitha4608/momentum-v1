"use client"

import { useState, useTransition } from "react"
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react"

import { archivePillar, createPillar, unarchivePillar, updatePillar } from "@/app/actions/pillars"
import { Card, CardContent } from "@/components/ui/card"
import type { PillarOption } from "@/components/pillar-picker"
import { PILLAR_COLORS, PILLAR_ICONS } from "@/lib/pillar-icons"
import { cn } from "@/lib/utils"

type ManagedPillar = PillarOption & { archived: boolean }

function PillarFormFields({
  name,
  icon,
  color,
  onNameChange,
  onIconChange,
  onColorChange,
}: {
  name: string
  icon: string
  color: string
  onNameChange: (value: string) => void
  onIconChange: (value: string) => void
  onColorChange: (value: string) => void
}) {
  return (
    <>
      <input
        autoFocus
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Pillar name"
        className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
      />
      <div className="flex flex-wrap gap-1">
        {PILLAR_ICONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onIconChange(opt)}
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
            onClick={() => onColorChange(opt)}
            aria-label={`Color ${opt}`}
            className={cn(
              "size-5 rounded-full ring-2 ring-offset-2 ring-offset-card transition-shadow",
              color === opt ? "ring-foreground" : "ring-transparent"
            )}
            style={{ backgroundColor: opt }}
          />
        ))}
      </div>
    </>
  )
}

export function PillarManager({
  initialPillars,
  onActivePillarsChange,
}: {
  initialPillars: ManagedPillar[]
  onActivePillarsChange?: (pillars: PillarOption[]) => void
}) {
  const [pillars, setPillars] = useState(initialPillars)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(PILLAR_ICONS[0])
  const [color, setColor] = useState(PILLAR_COLORS[0])
  const [, startTransition] = useTransition()

  function notifyActive(next: ManagedPillar[]) {
    onActivePillarsChange?.(next.filter((p) => !p.archived).map(({ archived, ...rest }) => rest))
  }

  function resetForm() {
    setEditingId(null)
    setCreating(false)
    setName("")
    setIcon(PILLAR_ICONS[0])
    setColor(PILLAR_COLORS[0])
  }

  function startEdit(p: ManagedPillar) {
    setCreating(false)
    setEditingId(p.id)
    setName(p.name)
    setIcon(p.icon)
    setColor(p.color)
  }

  function startCreate() {
    setEditingId(null)
    setCreating(true)
    setName("")
    setIcon(PILLAR_ICONS[0])
    setColor(PILLAR_COLORS[0])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    if (editingId !== null) {
      const id = editingId
      setPillars((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, name: trimmed, icon, color } : p))
        notifyActive(next)
        return next
      })
      startTransition(() => updatePillar(id, { name: trimmed, icon, color }))
      resetForm()
    } else {
      startTransition(async () => {
        const created = await createPillar(trimmed, icon, color)
        if (created) {
          setPillars((prev) => {
            const next: ManagedPillar[] = [
              ...prev,
              { id: created.id, name: created.name, icon: created.icon, color: created.color, archived: false },
            ]
            notifyActive(next)
            return next
          })
        }
        resetForm()
      })
    }
  }

  function handleArchiveToggle(p: ManagedPillar) {
    setPillars((prev) => {
      const next = prev.map((item) => (item.id === p.id ? { ...item, archived: !item.archived } : item))
      notifyActive(next)
      return next
    })
    startTransition(() => (p.archived ? unarchivePillar(p.id) : archivePillar(p.id)))
  }

  const active = pillars.filter((p) => !p.archived)
  const archived = pillars.filter((p) => p.archived)

  return (
    <Card>
      <CardContent>
        <h2 className="mb-4 text-lg font-semibold">Pillars</h2>

        <ul className="flex flex-col gap-1">
          {[...active, ...archived].map((p) => (
            <li key={p.id}>
              {editingId === p.id ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg bg-secondary/40 px-3 py-2.5">
                  <PillarFormFields
                    name={name}
                    icon={icon}
                    color={color}
                    onNameChange={setName}
                    onIconChange={setIcon}
                    onColorChange={setColor}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={!name.trim()}
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
                    >
                      Save
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
                <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-secondary/40", p.archived && "opacity-50")}>
                  <span aria-hidden>{p.icon}</span>
                  <span className="flex-1 truncate text-sm">{p.name}</span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                  <button
                    type="button"
                    aria-label={`Edit ${p.name}`}
                    onClick={() => startEdit(p)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={p.archived ? `Unarchive ${p.name}` : `Archive ${p.name}`}
                    onClick={() => handleArchiveToggle(p)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {p.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {creating ? (
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <PillarFormFields
              name={name}
              icon={icon}
              color={color}
              onNameChange={setName}
              onIconChange={setIcon}
              onColorChange={setColor}
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!name.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
              >
                Create
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
            className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm text-primary transition-colors hover:text-primary/80"
          >
            <Plus className="size-3.5" aria-hidden />
            New pillar
          </button>
        )}
      </CardContent>
    </Card>
  )
}
