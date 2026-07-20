"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CalendarArrowUp } from "lucide-react"

import { toggleTarget, type UpcomingTarget } from "@/app/actions/targets"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

/**
 * Two-part day rail label ("Tue" / "21") derived from the target's own
 * `originalDate`. Parsed as a local midnight so the weekday matches the date
 * string the server computed in the user's timezone.
 */
function dayRail(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`)
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    day: date.toLocaleDateString("en-US", { day: "numeric" }),
  }
}

/**
 * "Get ahead": the nearest upcoming targets, offered for early completion.
 * Checking a row runs the ordinary `toggleTarget` — because `originalDate` is
 * still in the future and the action stamps `completedDate` with the real
 * today, the target lands as "ahead" with no special-casing here.
 */
export function GetAheadCard({ items, today }: { items: UpcomingTarget[]; today: string }) {
  const reduceMotion = useReducedMotion()
  const [rows, setRows] = useState(items)
  const [, startTransition] = useTransition()
  const router = useRouter()

  function handleComplete(id: number) {
    // Completed means no longer upcoming, so the row leaves the card outright.
    setRows((prev) => prev.filter((row) => row.id !== id))
    startTransition(async () => {
      await toggleTarget(id, true, today)
      router.refresh()
    })
  }

  return (
    <Card className="w-full">
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CalendarArrowUp className="size-4 text-primary" aria-hidden />
            Planned tasks
          </h2>
          {rows.length > 0 && (
            <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {rows.length} upcoming
            </span>
          )}
        </div>

        {rows.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            Nothing planned ahead yet — add a target and pick a future date (and a goal) to line up work for the days
            to come.
          </p>
        )}

        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {rows.map((row) => {
              const { weekday, day } = dayRail(row.originalDate)
              return (
                <motion.li
                  key={row.id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18 }}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-3"
                >
                  {/* Fixed-width rail keeps the dates aligned down the column */}
                  <span className="w-11 shrink-0 text-center text-xs leading-tight text-muted-foreground">
                    <span className="block font-medium">{weekday}</span>
                    <span className="block">{day}</span>
                  </span>
                  <Checkbox
                    aria-label={`Complete "${row.title}" early`}
                    checked={false}
                    onCheckedChange={() => handleComplete(row.id)}
                  />
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.pillarColor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.title}</span>
                  <span className="shrink-0 text-[11.5px] font-medium text-muted-foreground">{row.pillarName}</span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      </CardContent>
    </Card>
  )
}
