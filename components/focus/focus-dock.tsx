"use client"

import { useReducedMotion } from "framer-motion"
import { Pause, Play, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useFocus } from "@/components/focus/focus-provider"

/** SVG ring geometry (28px box, 2.5px stroke). */
const SIZE = 28
const STROKE = 2.5
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/**
 * Sidebar focus dock: shows the running Pomodoro timer above the notification
 * bell. Renders nothing when no session is active.
 */
export function FocusDock({ collapsed = false }: { collapsed?: boolean }) {
  const { focusSession, remainingSec, pauseFocus, resumeFocus, endFocus } = useFocus()
  const reduceMotion = useReducedMotion()

  if (!focusSession) return null

  const paused = focusSession.pausedAt != null
  const fractionRemaining = Math.max(0, Math.min(1, remainingSec / focusSession.durationSec))
  // Full ring when time remains; drains toward empty as it elapses.
  const dashOffset = C * (1 - fractionRemaining)
  const color = focusSession.pillarColor

  const ring = (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0" aria-hidden>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        className="text-line"
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        style={reduceMotion ? undefined : { transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  )

  if (collapsed) {
    return (
      <div
        className="flex items-center justify-center px-2 py-2"
        title={`${formatTime(remainingSec)} — ${focusSession.targetTitle}`}
      >
        {ring}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2">
      {ring}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatTime(remainingSec)}</span>
        <span className="truncate text-xs text-muted-foreground">{focusSession.targetTitle}</span>
      </div>
      <button
        type="button"
        onClick={paused ? resumeFocus : pauseFocus}
        aria-label={paused ? "Resume focus timer" : "Pause focus timer"}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
        )}
      >
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={endFocus}
        aria-label="End focus timer"
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-destructive"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
