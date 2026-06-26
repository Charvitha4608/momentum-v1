"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Command, Sparkles, Loader2, Check, X, Pencil, ArrowRight, CalendarRange, Target, Circle } from "lucide-react"

import {
  startAssistant,
  answerAssistant,
  answerPlannerQuestion,
  confirmRecurringProposal,
  rejectRecurringProposal,
  confirmGoalPlan,
  rejectGoalPlan,
  type AssistantResult,
} from "@/app/actions/assistant"
import {
  acceptScheduleItem,
  rejectScheduleItem,
  editScheduleItem,
  type ScheduleItem,
} from "@/app/actions/planner"
import type { RecurringProposal, GoalPlanProposal } from "@/lib/assistant/agent"
import type { ScheduleDay } from "@/app/actions/history"
import { COMPLETION_META } from "@/lib/completion"
import { PillarPicker, type PillarOption } from "@/components/pillar-picker"
import { AiBadge } from "@/components/ai-badge"
import { TIME_OF_DAY_LABELS, type TimeOfDay } from "@/lib/planner/schedule"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const TOD_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening", "any"]
const EXAMPLES = ["Learn React fundamentals", "Gym mon/wed/fri", "Plan my week", "Read 30 min every day"]

/** Visible launchers dispatch this to open the command bar (see CommandBarTrigger). */
export const OPEN_COMMAND_BAR_EVENT = "momentum:open-command-bar"

/** A discoverable button that opens the ⌘K command bar from anywhere in the chrome. */
export function CommandBarTrigger({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label="Open AI assistant"
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_BAR_EVENT))}
      className={cn(
        "flex items-center rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
        collapsed ? "justify-center px-2" : "gap-2 px-3",
        className
      )}
    >
      <Sparkles className="size-4 shrink-0 text-primary" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">Ask AI</span>
          <kbd className="flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[10px]">
            <Command className="size-2.5" />K
          </kbd>
        </>
      )}
    </button>
  )
}

export function CommandBar({ pillars }: { pillars: PillarOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [result, setResult] = useState<AssistantResult | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setInput("")
    setResult(null)
    setStatus(null)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    reset()
  }, [reset])

  // Global ⌘K / Ctrl+K toggle, Esc to close. A custom event lets visible
  // launchers (sidebar / mobile header) open the bar without lifting state.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === "Escape" && open) {
        e.preventDefault()
        close()
      }
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_COMMAND_BAR_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_COMMAND_BAR_EVENT, onOpen)
    }
  }, [open, close])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = input.trim()
    if (!value || busy) return
    setStatus(null)
    startTransition(async () => {
      setResult(await startAssistant(value))
    })
  }

  function answer(value: string, label: string) {
    if (!result || busy) return
    startTransition(async () => {
      if (result.kind === "question") {
        setResult(await answerAssistant(result.messages, value, label))
      } else if (result.kind === "planner_question") {
        setResult(await answerPlannerQuestion(result.sessionId, value, label))
      }
    })
  }

  function onApplied(message: string) {
    setResult(null)
    setStatus(message)
    router.refresh()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close command bar"
            onClick={close}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="AI assistant"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-background/60"
          >
            {/* Input row */}
            <form onSubmit={submit} className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Momentum… break down a goal, add a habit, or plan your week"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
              <kbd className="hidden items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
                <Command className="size-2.5" />K
              </kbd>
            </form>

            {/* Body */}
            <div className="max-h-[55vh] overflow-y-auto p-3">
              {!result && !status && (
                <div className="flex flex-col gap-2 p-1">
                  <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Try</p>
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        setInput(ex)
                        inputRef.current?.focus()
                      }}
                      className="group flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                    >
                      <ArrowRight className="size-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                      {ex}
                    </button>
                  ))}
                </div>
              )}

              {status && (
                <div className="flex items-center gap-2 p-2 text-sm text-foreground">
                  <Check className="size-4 text-primary" /> {status}
                </div>
              )}

              {result?.kind === "empty" && <p className="p-2 text-sm text-muted-foreground">{result.message}</p>}

              {(result?.kind === "question" || result?.kind === "planner_question") && (
                <QuestionView text={result.question.text} options={result.question.options} busy={busy} onAnswer={answer} />
              )}

              {result?.kind === "breakdown" && (
                <ProposalItems
                  heading={result.goalText ? `Tasks for “${result.goalText}”` : "Proposed tasks"}
                  initialItems={result.items}
                  confirmLabel="Add all tasks"
                  appliedLabel={(n) => `Added ${n} task${n === 1 ? "" : "s"} to your list.`}
                  onApplied={onApplied}
                />
              )}

              {result?.kind === "plan_week" && (
                <ProposalItems
                  heading="Proposed weekly schedule"
                  initialItems={result.items}
                  confirmLabel="Accept all"
                  appliedLabel={(n) => `Scheduled ${n} task${n === 1 ? "" : "s"}.`}
                  onApplied={onApplied}
                />
              )}

              {result?.kind === "recurring" && (
                <RecurringPreview proposal={result.proposal} pillars={pillars} onApplied={onApplied} />
              )}

              {result?.kind === "goal_plan" && (
                <GoalPlanPreview proposal={result.proposal} pillars={pillars} onApplied={onApplied} />
              )}

              {result?.kind === "schedule" && (
                <ScheduleView start={result.start} end={result.end} days={result.days} />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Clarifying question
// ---------------------------------------------------------------------------

function QuestionView({
  text,
  options,
  busy,
  onAnswer,
}: {
  text: string
  options: { label: string; value: string }[]
  busy: boolean
  onAnswer: (value: string, label: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm font-medium">{text}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={busy}
            onClick={() => onAnswer(opt.value, opt.label)}
            className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedulable proposals (breakdown + plan_week) — staged ai_schedule rows
// ---------------------------------------------------------------------------

function ProposalItems({
  heading,
  initialItems,
  confirmLabel,
  appliedLabel,
  onApplied,
}: {
  heading: string
  initialItems: ScheduleItem[]
  confirmLabel: string
  appliedLabel: (n: number) => string
  onApplied: (message: string) => void
}) {
  const [items, setItems] = useState<ScheduleItem[]>(initialItems)
  const [busy, startTransition] = useTransition()
  const pending = items.filter((it) => it.status === "proposed" || it.status === "edited")

  function accept(id: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "accepted" } : it)))
    startTransition(async () => {
      await acceptScheduleItem(id)
    })
  }

  function reject(id: number) {
    setItems((prev) => prev.filter((it) => it.id !== id))
    startTransition(async () => {
      await rejectScheduleItem(id)
    })
  }

  function edit(id: number, timeOfDay: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, timeOfDay } : it)))
    startTransition(async () => {
      await editScheduleItem(id, { timeOfDay })
    })
  }

  // Confirm/dismiss act on this proposal's specific staged rows (by id) so they
  // never touch unrelated AI Planner proposals, and so user-edited rows (whose
  // status is "edited") are still applied/discarded. Both routes log through the
  // ai_schedule_feedback learning loop via accept/reject.
  function confirmAll() {
    const targets = pending.map((it) => it.id)
    startTransition(async () => {
      for (const id of targets) await acceptScheduleItem(id)
      onApplied(appliedLabel(targets.length))
    })
  }

  function dismiss() {
    const targets = pending.map((it) => it.id)
    startTransition(async () => {
      for (const id of targets) await rejectScheduleItem(id)
      onApplied("Dismissed the proposal.")
    })
  }

  if (items.length === 0) {
    return <p className="p-2 text-sm text-muted-foreground">Nothing proposed.</p>
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">{heading}</p>
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <ItemCard key={item.id} item={item} busy={busy} onAccept={accept} onReject={reject} onEdit={edit} />
        ))}
      </AnimatePresence>

      <div className="mt-1 flex items-center gap-2 border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">{pending.length} to confirm</span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={dismiss}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            type="button"
            disabled={busy || pending.length === 0}
            onClick={confirmAll}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            <Check className="size-3.5" /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemCard({
  item,
  busy,
  onAccept,
  onReject,
  onEdit,
}: {
  item: ScheduleItem
  busy: boolean
  onAccept: (id: number) => void
  onReject: (id: number) => void
  onEdit: (id: number, timeOfDay: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const accepted = item.status === "accepted"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.16 }}
      className={cn("rounded-lg border bg-card p-2.5 text-sm", accepted ? "border-border opacity-70" : "border-primary/25")}
    >
      <div className="flex items-start gap-2">
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
          <p className={cn("mt-1 leading-snug", !accepted && "font-medium")}>{item.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.startTime ? `${item.startTime}–${item.endTime}` : `${item.durationMinutes} min`}
            {item.timeOfDay && item.timeOfDay !== "any" && <> · {TIME_OF_DAY_LABELS[item.timeOfDay as TimeOfDay]}</>}
          </p>
        </div>
      </div>

      {!accepted && (
        <>
          <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onAccept(item.id)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <Check className="size-3.5" /> Accept
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing((v) => !v)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-50"
            >
              <Pencil className="size-3" /> Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(item.id)}
              className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <X className="size-3.5" /> Reject
            </button>
          </div>
          {editing && (
            <div className="mt-2 grid grid-cols-4 gap-1">
              {TOD_ORDER.map((tod) => (
                <button
                  key={tod}
                  type="button"
                  onClick={() => {
                    onEdit(item.id, tod)
                    setEditing(false)
                  }}
                  className={cn(
                    "rounded-md border px-1 py-1 text-xs transition-colors",
                    item.timeOfDay === tod
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {TIME_OF_DAY_LABELS[tod]}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Recurring proposal — editable preview, applied via createRecurringTask
// ---------------------------------------------------------------------------

function RecurringPreview({
  proposal,
  pillars,
  onApplied,
}: {
  proposal: RecurringProposal
  pillars: PillarOption[]
  onApplied: (message: string) => void
}) {
  const [draft, setDraft] = useState<RecurringProposal>(proposal)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function toggleDay(day: number) {
    setDraft((d) => ({
      ...d,
      daysOfWeek: d.daysOfWeek.includes(day) ? d.daysOfWeek.filter((x) => x !== day) : [...d.daysOfWeek, day].sort(),
    }))
  }

  function confirm() {
    setError(null)
    startTransition(async () => {
      const res = await confirmRecurringProposal(draft)
      if (res.ok) onApplied(`Recurring task “${draft.title}” created.`)
      else setError(res.error ?? "Couldn't create the task.")
    })
  }

  function reject() {
    startTransition(async () => {
      await rejectRecurringProposal(draft)
      onApplied("Dismissed the proposal.")
    })
  }

  const cadence =
    draft.frequency === "daily"
      ? "Every day"
      : draft.frequency === "weekly"
        ? draft.daysOfWeek.length
          ? draft.daysOfWeek.map((d) => WEEKDAY_LABELS[d]).join(", ")
          : "Pick days"
        : `Every ${draft.intervalDays ?? 2} days`

  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="flex items-center gap-2">
        <CalendarRange className="size-4 text-primary" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">New recurring task</p>
      </div>

      <input
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        placeholder="Task title"
        className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
      />

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Pillar</span>
        <PillarPicker
          pillars={pillars}
          value={draft.pillarId}
          onChange={(id) => setDraft((d) => ({ ...d, pillarId: id }))}
        />
        <span className="ml-auto rounded-md bg-secondary/50 px-2 py-1 text-xs text-muted-foreground">{cadence}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["daily", "weekly", "custom"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setDraft((d) => ({ ...d, frequency: f }))}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors",
              draft.frequency === f
                ? "border-primary bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {draft.frequency === "weekly" && (
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDay(idx)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                draft.daysOfWeek.includes(idx)
                  ? "border-primary bg-secondary text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {draft.frequency === "custom" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Repeat every</span>
          <input
            type="number"
            min={2}
            value={draft.intervalDays ?? 2}
            onChange={(e) => setDraft((d) => ({ ...d, intervalDays: Math.max(2, Number(e.target.value) || 2) }))}
            className="w-16 rounded-lg border border-border bg-transparent px-2 py-1 text-sm text-foreground outline-none"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2 border-t border-border pt-2">
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={reject}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            <Check className="size-3.5" /> Create task
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Goal plan proposal — a quantity-by-deadline goal distributed into a repeating
// task. Applied via confirmGoalPlan (creates a long-term goal + recurring task).
// ---------------------------------------------------------------------------

/** Format YYYY-MM-DD as e.g. "Jul 7". */
function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

// ---------------------------------------------------------------------------
// Schedule readout — the direct answer to "what's planned for X?". Read-only:
// it lists each day's targets with their ahead/on-time/late status, no actions.
// ---------------------------------------------------------------------------

function formatScheduleHeader(iso: string, withWeekday: boolean): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: withWeekday ? "long" : "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function ScheduleView({ start, end, days }: { start: string; end: string; days: ScheduleDay[] }) {
  const nonEmpty = days.filter((d) => d.targets.length > 0)
  const heading = start === end ? formatScheduleHeader(start, true) : `${formatShortDate(start)} – ${formatShortDate(end)}`

  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="flex items-center gap-2">
        <CalendarRange className="size-4 text-primary" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Schedule · {heading}</p>
      </div>

      {nonEmpty.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing planned for {start === end ? "this day" : "this range"}.</p>
      ) : (
        nonEmpty.map((day) => {
          const done = day.targets.filter((t) => t.completed).length
          return (
            <div key={day.date} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-medium text-foreground">{formatScheduleHeader(day.date, false)}</p>
                <span className="text-xs text-muted-foreground">
                  {done}/{day.targets.length} done
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {day.targets.map((t) => {
                  const meta = t.status ? COMPLETION_META[t.status] : null
                  return (
                    <li key={t.id} className="flex items-center gap-2.5 rounded-lg bg-secondary/30 px-2.5 py-2 text-sm">
                      {t.completed ? (
                        <Check className={cn("size-4 shrink-0", meta?.textClass ?? "text-primary")} />
                      ) : (
                        <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: t.pillarColor }} aria-hidden />
                        {t.pillarIcon}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate", t.completed && "text-muted-foreground line-through")}>
                        {t.title}
                      </span>
                      {meta && <span className={cn("shrink-0 text-xs font-medium", meta.textClass)}>{meta.label}</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })
      )}
    </div>
  )
}

function GoalPlanPreview({
  proposal,
  pillars,
  onApplied,
}: {
  proposal: GoalPlanProposal
  pillars: PillarOption[]
  onApplied: (message: string) => void
}) {
  const [draft, setDraft] = useState<GoalPlanProposal>(proposal)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function confirm() {
    setError(null)
    startTransition(async () => {
      const res = await confirmGoalPlan(draft)
      if (res.ok) onApplied(`Goal “${draft.goalTitle}” set up — ${draft.perSession}${draft.unit ? ` ${draft.unit}` : ""} per session.`)
      else setError(res.error ?? "Couldn't set up the goal.")
    })
  }

  function reject() {
    startTransition(async () => {
      await rejectGoalPlan(draft)
      onApplied("Dismissed the proposal.")
    })
  }

  const cadence =
    draft.frequency === "daily"
      ? "every day"
      : draft.daysOfWeek.length
        ? draft.daysOfWeek.map((d) => WEEKDAY_LABELS[d]).join(", ")
        : "weekly"

  const unitLabel = draft.unit ? ` ${draft.unit}` : ""

  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="flex items-center gap-2">
        <Target className="size-4 text-primary" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">New goal plan</p>
      </div>

      <input
        value={draft.goalTitle}
        onChange={(e) => setDraft((d) => ({ ...d, goalTitle: e.target.value }))}
        placeholder="Goal name"
        className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
      />

      {/* The computed distribution — this is the whole point: spread the total
          across sessions so it finishes by the deadline. */}
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
        <p className="font-medium text-foreground">
          ≈ {draft.perSession}
          {unitLabel} per session
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {cadence} · until {formatShortDate(draft.deadline)} · {draft.occurrences} session
          {draft.occurrences === 1 ? "" : "s"} → {draft.targetValue}
          {unitLabel} total
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Pillar</span>
        <PillarPicker pillars={pillars} value={draft.pillarId} onChange={(id) => setDraft((d) => ({ ...d, pillarId: id }))} />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2 border-t border-border pt-2">
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={reject}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            <Check className="size-3.5" /> Create goal plan
          </button>
        </div>
      </div>
    </div>
  )
}
