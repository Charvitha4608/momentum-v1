"use client"

import { useEffect, useState, useTransition } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react"

import {
  addPillarTask,
  deletePillarTask,
  getPillarTasks,
  togglePillarTask,
  type PillarTask,
} from "@/app/actions/pillar-tasks"
import { cn } from "@/lib/utils"

/**
 * The inline, TickTick-style checklist that drops open under a pillar row.
 * Tasks are lazy-loaded the first time the section is expanded. Everything here
 * is hand-ticked and never touches the targets / daily-stats machinery.
 */
export function PillarChecklist({ pillarId, accent }: { pillarId: number; accent: string }) {
  const reduceMotion = useReducedMotion()
  const [tasks, setTasks] = useState<PillarTask[]>([])
  const [loaded, setLoaded] = useState(false)
  const [title, setTitle] = useState("")
  const [showDone, setShowDone] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getPillarTasks(pillarId).then((rows) => {
      if (!cancelled) {
        setTasks(rows)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [pillarId])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setTitle("")
    startTransition(async () => {
      const created = await addPillarTask(pillarId, trimmed)
      if (created) setTasks((prev) => [...prev, created])
    })
  }

  function handleToggle(task: PillarTask) {
    const nextDone = !task.isDone
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, isDone: nextDone, completedAt: nextDone ? new Date() : null } : t
      )
    )
    startTransition(() => {
      togglePillarTask(task.id)
    })
  }

  function handleDelete(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    startTransition(() => {
      deletePillarTask(id)
    })
  }

  const active = tasks.filter((t) => !t.isDone)
  const done = tasks.filter((t) => t.isDone)

  return (
    <div className="flex flex-col gap-1.5 px-3 pb-3 pt-1">
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add an item…"
          aria-label="Add checklist item"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
        />
      </form>

      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {active.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              accent={accent}
              reduceMotion={reduceMotion}
              onToggle={() => handleToggle(task)}
              onDelete={() => handleDelete(task.id)}
            />
          ))}
        </AnimatePresence>
      </ul>

      {loaded && active.length === 0 && done.length === 0 && (
        <p className="px-1 py-1 text-xs text-muted-foreground">No items yet.</p>
      )}

      {done.length > 0 && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn("size-3 transition-transform", showDone && "rotate-180")} aria-hidden />
            {done.length} done
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.ul
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                {done.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    accent={accent}
                    reduceMotion={reduceMotion}
                    onToggle={() => handleToggle(task)}
                    onDelete={() => handleDelete(task.id)}
                  />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function TaskRow({
  task,
  accent,
  reduceMotion,
  onToggle,
  onDelete,
}: {
  task: PillarTask
  accent: string
  reduceMotion: boolean | null
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-secondary/40"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.isDone}
        aria-label={task.isDone ? `Untick "${task.title}"` : `Tick "${task.title}"`}
        onClick={onToggle}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          task.isDone ? "border-transparent text-primary-foreground" : "border-border hover:border-foreground/40"
        )}
        style={task.isDone ? { backgroundColor: accent } : undefined}
      >
        {task.isDone && <Check className="size-3" aria-hidden />}
      </button>
      <span
        className={cn(
          "flex-1 truncate text-sm",
          task.isDone ? "text-muted-foreground line-through" : "text-foreground"
        )}
      >
        {task.title}
      </span>
      <button
        type="button"
        aria-label={`Delete "${task.title}"`}
        onClick={onDelete}
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </motion.li>
  )
}
