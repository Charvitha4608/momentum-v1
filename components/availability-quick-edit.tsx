"use client"

import { useState, useTransition } from "react"
import { Clock, RotateCcw } from "lucide-react"

import { setAvailabilityOverride } from "@/app/actions/availability"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

const QUICK = [1, 2, 3, 4, 6, 8]

/**
 * Compact control to adjust today's free hours without opening settings.
 * Writes a per-date override that takes priority over the weekday/weekend
 * default for today only.
 */
export function AvailabilityQuickEdit({
  date,
  hours,
  hasOverride,
}: {
  date: string
  hours: number
  hasOverride: boolean
}) {
  const [current, setCurrent] = useState(hours)
  const [overridden, setOverridden] = useState(hasOverride)
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  function set(value: number | null) {
    if (value === null) {
      setOverridden(false)
    } else {
      setCurrent(value)
      setOverridden(true)
    }
    setOpen(false)
    startTransition(async () => {
      await setAvailabilityOverride(date, value)
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <Clock className="size-3.5 text-primary" aria-hidden />
        <span className="text-foreground">{current}h</span>
        <span>free today{overridden ? " ·" : ""}</span>
        {overridden && <span className="text-primary">set</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56">
        <p className="mb-2 px-1 text-sm font-medium">Free time today</p>
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => set(h)}
              className={`rounded-md border px-2 py-1.5 text-sm transition-colors ${
                current === h && overridden
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
        {overridden && (
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={() => set(null)}>
            <RotateCcw className="size-3.5" /> Use my default
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
