"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type CalendarView = "month" | "pillars" | "week"

export function CalendarViewSwitcher({ view }: { view: CalendarView }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setView(next: CalendarView) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", next)
    router.push(`/calendar?${params.toString()}`)
  }

  return (
    <ToggleGroup value={[view]} onValueChange={(v) => v[0] && setView(v[0] as CalendarView)}>
      <ToggleGroupItem value="month" aria-label="Month view">
        Month
      </ToggleGroupItem>
      <ToggleGroupItem value="pillars" aria-label="Pillars view">
        Pillars
      </ToggleGroupItem>
      <ToggleGroupItem value="week" aria-label="Week view">
        Week
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
