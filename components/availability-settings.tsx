"use client"

import { useState, useTransition } from "react"
import { Clock, Check } from "lucide-react"

import { setAvailability, type AvailabilityDefaults } from "@/app/actions/availability"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const HOUR_OPTIONS = Array.from({ length: 49 }, (_, i) => i / 2) // 0..24 in half-hours

function HourField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {HOUR_OPTIONS.map((h) => (
          <option key={h} value={h} className="bg-card">
            {h} {h === 1 ? "hour" : "hours"}
          </option>
        ))}
      </select>
    </label>
  )
}

function ClockField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {Array.from({ length: 24 }, (_, h) => h).map((h) => (
          <option key={h} value={h} className="bg-card">
            {String(h).padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </label>
  )
}

export function AvailabilitySettings({ initial }: { initial: AvailabilityDefaults }) {
  const [values, setValues] = useState<AvailabilityDefaults>(initial)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function update<K extends keyof AvailabilityDefaults>(key: K, v: AvailabilityDefaults[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
    setSaved(false)
  }

  function save() {
    startTransition(async () => {
      await setAvailability(values)
      setSaved(true)
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">Availability</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          How much free time you usually have. The AI Planner uses this to fit your tasks into realistic days.
        </p>

        <div className="flex gap-3">
          <HourField label="Free hours · weekday" value={values.weekdayHours} onChange={(v) => update("weekdayHours", v)} />
          <HourField label="Free hours · weekend" value={values.weekendHours} onChange={(v) => update("weekendHours", v)} />
        </div>
        <div className="flex gap-3">
          <ClockField label="Earliest start" value={values.dayStartHour} onChange={(v) => update("dayStartHour", v)} />
          <ClockField label="Latest end" value={values.dayEndHour} onChange={(v) => update("dayEndHour", v)} />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save availability"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-primary">
              <Check className="size-4" /> Saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
