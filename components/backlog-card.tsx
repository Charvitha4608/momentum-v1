"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUpRight, Check, CircleX, ListTodo } from "lucide-react"

import { moveTargetToToday, toggleTarget } from "@/app/actions/targets"
import { Card, CardContent } from "@/components/ui/card"

type BacklogItem = {
  id: number
  title: string
  points: number
  originalDate: string
  sortOrder: number
  pillarIcon: string
  pillarColor: string
  pillarName: string
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

  function handleComplete(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id))
    startTransition(async () => {
      await toggleTarget(id, true, today)
      router.refresh()
    })
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
          <p className="text-sm text-muted-foreground">Nothing carried over from previous days 🎉</p>
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
                    {group.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/50">
                        {/* COLOR: destructive marker flags an overdue, still-incomplete target */}
                        <CircleX className="size-4 shrink-0 text-destructive" aria-hidden />
                        <span className="flex-1 truncate text-sm text-foreground">{item.title}</span>
                        <span
                          className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
                          title={item.pillarName}
                        >
                          <span aria-hidden>{item.pillarIcon}</span>
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: item.pillarColor }} aria-hidden />
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
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
                      </li>
                    ))}
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
