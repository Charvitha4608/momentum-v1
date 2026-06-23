"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type CalendarView = "month" | "pillars" | "week" | "planner"

export function CalendarViewSwitcher({ view }: { view: CalendarView }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setView(next: CalendarView) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", next)
    router.push(`/calendar?${params.toString()}`)
  }

  // COLOR: redesign tab control — surface-1 track with a hairline border; the
  // active tab is a brand-soft pill with a brand-line outline (design .tabs).
  const itemClass =
    "rounded-chip px-4 py-1.5 text-[13px] data-[pressed]:border data-[pressed]:border-brand-line data-[pressed]:bg-brand-soft data-[pressed]:text-white data-[pressed]:shadow-none"

  return (
    <ToggleGroup
      value={[view]}
      onValueChange={(v) => v[0] && setView(v[0] as CalendarView)}
      className="gap-1 rounded-control border border-line bg-surface-1 p-1"
    >
      <ToggleGroupItem value="month" aria-label="Month view" className={itemClass}>
        Month
      </ToggleGroupItem>
      <ToggleGroupItem value="pillars" aria-label="Pillars view" className={itemClass}>
        Pillars
      </ToggleGroupItem>
      <ToggleGroupItem value="week" aria-label="Week view" className={itemClass}>
        Week
      </ToggleGroupItem>
      <ToggleGroupItem value="planner" aria-label="AI Planner view" className={itemClass}>
        Planner
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
