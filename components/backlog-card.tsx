"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUpRight, CalendarClock, Check, CircleX, ListTodo } from "lucide-react"

import { moveTargetToToday, postponeTarget, toggleTarget } from "@/app/actions/targets"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { completionStatus, COMPLETION_META } from "@/lib/completion"
import { shiftDateString } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

type BacklogItem = {
  id: number
  title: string
  points: number
  originalDate: string
  sortOrder: number
  pillarIcon: string
  pillarColor: string
  pillarName: string
  // Set optimistically once the user completes a backlog item, so the row can
  // flash its timing badge ("Late") before it clears on the next refresh.
  completed?: boolean
  completedDate?: string | null
}

function formatDateLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function BacklogCard({ initialItems, today }: { initialItems: BacklogItem[]; today: string }) {
  const [items, setItems] = useState(initialItems)
  const [, startTransition] = useTransition()
  const router = useRouter()

  function handleMoveToToday(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id))
    startTransition(async () => {
      await moveTargetToToday(id, today)
      router.refresh()
    })
  }

  function handlePostpone(id: number, date: string) {
    // The task now lives on a future day — drop it from the backlog and resync.
    setItems((prev) => prev.filter((item) => item.id !== id))
    startTransition(async () => {
      await postponeTarget(id, date, today)
      router.refresh()
    })
  }

  function handleComplete(id: number) {
    // Mark it done in place so the user sees the "Late" badge land, then drop it
    // (a completed item is no longer backlog) and resync from the server.
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, completed: true, completedDate: today } : item)))
    startTransition(async () => {
      await toggleTarget(id, true, today)
    })
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id))
      router.refresh()
    }, 1100)
  }

  const groups: { date: string; items: BacklogItem[] }[] = []
  for (const item of items) {
    const group = groups.find((g) => g.date === item.originalDate)
    if (group) group.items.push(item)
    else groups.push({ date: item.originalDate, items: [item] })
  }
  groups.sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Card className="w-full">
      <CardContent>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <ListTodo className="size-4.5 text-primary" />
          Backlog
        </h2>

        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear — nothing carried over from earlier days 🎉</p>
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {groups.map((group) => (
                <motion.div
                  key={group.date}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <h3 className="mb-1 px-2 text-sm font-medium text-muted-foreground">{formatDateLabel(group.date)}</h3>
                  <ul className="flex flex-col gap-1">
                    {group.items.map((item) => {
                      const status = item.completed
                        ? completionStatus({
                            completed: true,
                            completedDate: item.completedDate ?? today,
                            originalDate: item.originalDate,
                          })
                        : null
                      const meta = status ? COMPLETION_META[status] : null
                      return (
                        <li key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/50">
                          {item.completed ? (
                            <Check className={cn("size-4 shrink-0", meta?.textClass ?? "text-primary")} aria-hidden />
                          ) : (
                            // COLOR: destructive marker flags an overdue, still-incomplete target
                            <CircleX className="size-4 shrink-0 text-destructive" aria-hidden />
                          )}
                          <span
                            className={cn(
                              "flex-1 truncate text-sm",
                              item.completed ? "text-muted-foreground line-through" : "text-foreground"
                            )}
                          >
                            {item.title}
                          </span>
                          {meta && <span className={cn("shrink-0 text-xs font-medium", meta.textClass)}>{meta.label}</span>}
                          <span
                            className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
                            title={item.pillarName}
                          >
                            <span aria-hidden>{item.pillarIcon}</span>
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: item.pillarColor }} aria-hidden />
                          </span>
                          {!item.completed && (
                            <div className="flex shrink-0 items-center gap-1.5">
                              <PostponeButton
                                title={item.title}
                                today={today}
                                onPick={(date) => handlePostpone(item.id, date)}
                              />
                              <button
                                type="button"
                                aria-label={`Move "${item.title}" to today`}
                                onClick={() => handleMoveToToday(item.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-primary"
                              >
                                <ArrowUpRight className="size-3.5" />
                              </button>
                              {/* COLOR: complete action mirrors FriendManager's accept button — solid primary */}
                              <button
                                type="button"
                                aria-label={`Mark "${item.title}" complete`}
                                onClick={() => handleComplete(item.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/80"
                              >
                                <Check className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Per-row "postpone" control: pick a future day to finish a backlog task. The
 * task moves to that day (its `date`) and leaves the backlog until then.
 */
function PostponeButton({
  title,
  today,
  onPick,
}: {
  title: string
  today: string
  onPick: (date: string) => void
}) {
  const [open, setOpen] = useState(false)
  const tomorrow = shiftDateString(today, 1)
  const [value, setValue] = useState(tomorrow)

  function label(date: string) {
    if (date === tomorrow) return "Tomorrow"
    if (date === shiftDateString(today, 2)) return "In 2 days"
    if (date === shiftDateString(today, 7)) return "Next week"
    const [y, m, d] = date.split("-").map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  }

  const quickDates = [tomorrow, shiftDateString(today, 2), shiftDateString(today, 7)]

  function pick(date: string) {
    setOpen(false)
    onPick(date)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={`Postpone "${title}" to a chosen day`}
        title="Postpone to a chosen day"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-primary"
      >
        <CalendarClock className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">Finish on</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quickDates.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => pick(date)}
              className="rounded-md bg-surface-2 px-2 py-1 text-xs text-secondary-foreground transition-colors hover:bg-surface-3"
            >
              {label(date)}
            </button>
          ))}
        </div>
        <input
          type="date"
          min={tomorrow}
          value={value}
          onChange={(e) => {
            if (e.target.value) setValue(e.target.value)
          }}
          aria-label="Pick a specific date"
          className="mb-2 w-full rounded-md border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => value > today && pick(value)}
          className="flex h-8 w-full items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Postpone to {label(value)}
        </button>
      </PopoverContent>
    </Popover>
  )
}
