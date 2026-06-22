"use client"

import { useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Sparkles, Check, X, Pencil, Loader2, Trash2, GripVertical, Info } from "lucide-react"

import {
  startPlanning,
  answerPlanningQuestion,
  acceptScheduleItem,
  rejectScheduleItem,
  editScheduleItem,
  acceptAllProposed,
  clearProposed,
  getWeekSchedule,
  getDaySchedule,
  type ScheduleItem,
} from "@/app/actions/planner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AiBadge } from "@/components/ai-badge"
import { TIME_OF_DAY_LABELS, type TimeOfDay } from "@/lib/planner/schedule"

type Scope = "day" | "week"
type Question = { text: string; field: string; taskRef: string | null; options: { label: string; value: string }[] }

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const TOD_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening", "any"]

function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return { dow: DOW[dt.getUTCDay()], dm: `${m}/${d}` }
}

export function AiPlanner({
  initialDays,
  initialItems,
  today,
}: {
  initialDays: string[]
  initialItems: ScheduleItem[]
  today: string
}) {
  const [scope, setScope] = useState<Scope>("week")
  const [items, setItems] = useState<ScheduleItem[]>(initialItems)
  const [question, setQuestion] = useState<Question | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  const [dragId, setDragId] = useState<number | null>(null)

  const days = scope === "day" ? [today] : initialDays

  async function refresh() {
    if (scope === "day") {
      setItems(await getDaySchedule(today))
    } else {
      const res = await getWeekSchedule(today)
      setItems(res.items)
    }
  }

  function generate() {
    setStatus(null)
    startTransition(async () => {
      const res = await startPlanning(scope, today)
      setSessionId(res.sessionId)
      if (res.kind === "question") {
        setQuestion(res.question)
      } else {
        setQuestion(null)
        await refresh()
        setStatus(
          res.count === 0
            ? "No open tasks to schedule. Add some targets first."
            : `Planned ${res.count} task${res.count === 1 ? "" : "s"}${res.source === "heuristic" ? " · heuristic mode" : ""}.`
        )
      }
    })
  }

  function answer(value: string, label: string) {
    if (sessionId == null) return
    startTransition(async () => {
      const res = await answerPlanningQuestion(sessionId, value, label)
      if (res.kind === "question") {
        setQuestion(res.question)
      } else {
        setQuestion(null)
        await refresh()
        setStatus(`Planned ${res.count} task${res.count === 1 ? "" : "s"}${res.source === "heuristic" ? " · heuristic mode" : ""}.`)
      }
    })
  }

  function accept(id: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "accepted" } : it)))
    startTransition(async () => {
      await acceptScheduleItem(id)
      await refresh()
    })
  }

  function reject(id: number) {
    setItems((prev) => prev.filter((it) => it.id !== id))
    startTransition(async () => {
      await rejectScheduleItem(id)
    })
  }

  function applyEdit(id: number, changes: { date?: string; timeOfDay?: string | null; startTime?: string | null }) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)))
    startTransition(async () => {
      await editScheduleItem(id, changes)
      await refresh()
    })
  }

  function acceptAll() {
    startTransition(async () => {
      await acceptAllProposed(days)
      await refresh()
      setStatus("Accepted all proposed tasks.")
    })
  }

  function clearAll() {
    setItems((prev) => prev.filter((it) => it.status === "accepted"))
    startTransition(async () => {
      await clearProposed(days)
      await refresh()
    })
  }

  const proposedCount = items.filter((it) => it.status === "proposed" || it.status === "edited").length

  return (
    <div className="flex flex-col gap-4">
      {/* Launcher */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold leading-tight">AI Planner</h2>
                <p className="text-xs text-muted-foreground">Fits your open tasks into the time you actually have.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
                {(["day", "week"] as Scope[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={`rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors ${
                      scope === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Button onClick={generate} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Plan my {scope}
              </Button>
            </div>
          </div>

          {status && <p className="text-sm text-muted-foreground">{status}</p>}

          {proposedCount > 0 && (
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">{proposedCount} proposed</span>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" onClick={clearAll} disabled={busy}>
                  <Trash2 className="size-3.5" /> Clear
                </Button>
                <Button variant="secondary" size="sm" onClick={acceptAll} disabled={busy}>
                  <Check className="size-3.5" /> Accept all
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clarifying question */}
      <AnimatePresence>
        {question && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="ring-1 ring-primary/30">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-sm font-medium">{question.text}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {question.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={busy}
                      onClick={() => answer(opt.value, opt.label)}
                      className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule grid */}
      <div className={scope === "week" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7" : "grid grid-cols-1 gap-3"}>
        {days.map((date) => {
          const dayItems = items.filter((it) => it.date === date).sort(sortByTime)
          const { dow, dm } = dayLabel(date)
          const isToday = date === today
          return (
            <div
              key={date}
              onDragOver={(e) => {
                if (dragId != null) e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId != null) {
                  applyEdit(dragId, { date })
                  setDragId(null)
                }
              }}
              className={`flex flex-col gap-2 rounded-xl p-2 ring-1 transition-colors ${
                dragId != null ? "ring-primary/40" : "ring-foreground/10"
              } ${isToday ? "bg-secondary/30" : "bg-card/40"}`}
            >
              <div className="flex items-baseline justify-between px-1">
                <span className={`text-sm font-medium ${isToday ? "text-primary" : ""}`}>{dow}</span>
                <span className="text-xs text-muted-foreground">{dm}</span>
              </div>

              <AnimatePresence initial={false}>
                {dayItems.map((item) => (
                  <ScheduleCard
                    key={item.id}
                    item={item}
                    days={days}
                    onAccept={accept}
                    onReject={reject}
                    onEdit={applyEdit}
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
              </AnimatePresence>

              {dayItems.length === 0 && (
                <p className="px-1 py-3 text-center text-xs text-muted-foreground/60">—</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function sortByTime(a: ScheduleItem, b: ScheduleItem) {
  if (!a.startTime && !b.startTime) return b.priority - a.priority
  if (!a.startTime) return 1
  if (!b.startTime) return -1
  return a.startTime.localeCompare(b.startTime)
}

function ScheduleCard({
  item,
  days,
  onAccept,
  onReject,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  item: ScheduleItem
  days: string[]
  onAccept: (id: number) => void
  onReject: (id: number) => void
  onEdit: (id: number, changes: { date?: string; timeOfDay?: string | null }) => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const [showWhy, setShowWhy] = useState(false)
  const accepted = item.status === "accepted"
  const fits = Boolean(item.startTime)

  return (
    <motion.div
      layout
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.16 }}
      className={`group cursor-grab rounded-lg border bg-card p-2 text-sm active:cursor-grabbing ${
        accepted ? "border-border" : "border-primary/25"
      }`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <AiBadge variant={accepted ? "accepted" : "proposed"} />
            {item.pillarColor && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: item.pillarColor }} aria-hidden />
                {item.pillarIcon}
              </span>
            )}
          </div>
          <p className={`mt-1 leading-snug ${accepted ? "" : "font-medium"}`}>{item.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fits ? (
              <>
                {item.startTime}–{item.endTime}
              </>
            ) : (
              <span className="text-destructive">Didn’t fit — needs more time</span>
            )}
            {item.timeOfDay && item.timeOfDay !== "any" && <> · {TIME_OF_DAY_LABELS[item.timeOfDay as TimeOfDay]}</>}
          </p>

          {item.reasoning && (
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground"
            >
              <Info className="size-3" /> Why here?
            </button>
          )}
          <AnimatePresence>
            {showWhy && item.reasoning && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-1 overflow-hidden text-xs text-muted-foreground"
              >
                {item.reasoning}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!accepted && (
        <div className="mt-2 flex items-center gap-1 border-t border-border pt-2 opacity-80 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            aria-label="Accept"
            onClick={() => onAccept(item.id)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
          >
            <Check className="size-3.5" /> Accept
          </button>
          <EditPopover item={item} days={days} onEdit={onEdit} />
          <button
            type="button"
            aria-label="Reject"
            onClick={() => onReject(item.id)}
            className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" /> Reject
          </button>
        </div>
      )}
    </motion.div>
  )
}

function EditPopover({
  item,
  days,
  onEdit,
}: {
  item: ScheduleItem
  days: string[]
  onEdit: (id: number, changes: { date?: string; timeOfDay?: string | null }) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground">
        <Pencil className="size-3" /> Edit
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60">
        {days.length > 1 && (
          <>
            <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">Move to day</p>
            <div className="mb-3 grid grid-cols-4 gap-1">
              {days.map((d) => {
                const { dow } = dayLabel(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      onEdit(item.id, { date: d })
                      setOpen(false)
                    }}
                    className={`rounded-md border px-1 py-1 text-xs transition-colors ${
                      d === item.date ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {dow}
                  </button>
                )
              })}
            </div>
          </>
        )}
        <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">Time of day</p>
        <div className="grid grid-cols-2 gap-1">
          {TOD_ORDER.map((tod) => (
            <button
              key={tod}
              type="button"
              onClick={() => {
                onEdit(item.id, { timeOfDay: tod })
                setOpen(false)
              }}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                item.timeOfDay === tod ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {TIME_OF_DAY_LABELS[tod]}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
