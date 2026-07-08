"use client"

import { useReducedMotion } from "framer-motion"
import { Coffee, Pause, Play, X } from "lucide-react"

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
 * bell. The timer walks the target's block plan (25-min blocks, shrinking
 * remainder); at each block's end it pings and offers a break or to keep going.
 * Renders nothing when no session is active.
 */
export function FocusDock({ collapsed = false }: { collapsed?: boolean }) {
  const { focusSession, remainingSec, pauseFocus, resumeFocus, endFocus, takeBreak, continueNext, dismissPing, skipBreak } =
    useFocus()
  const reduceMotion = useReducedMotion()

  if (!focusSession) return null

  const paused = focusSession.pausedAt != null
  const onBreak = focusSession.phase === "break"
  const isFinalBlock = focusSession.index >= focusSession.blocks.length - 1
  // The ping offer only shows for a focus block that has hit zero and not been
  // dismissed (final-block "keep going").
  const offering = focusSession.phase === "focus" && focusSession.pinged && !focusSession.dismissed

  const fractionRemaining = Math.max(0, Math.min(1, remainingSec / focusSession.segDurationSec))
  // Full ring when time remains; drains toward empty as it elapses.
  const dashOffset = C * (1 - fractionRemaining)
  // Focus blocks use the pillar accent; breaks read as neutral.
  const trackColor = "currentColor"

  const ring = (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn("shrink-0", onBreak && "text-muted-foreground")}
      aria-hidden
    >
      <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="currentColor" strokeWidth={STROKE} className="text-line" />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        fill="none"
        stroke={onBreak ? trackColor : focusSession.pillarColor}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        style={reduceMotion ? undefined : { transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  )

  const blockLabel = onBreak
    ? "Break"
    : focusSession.blocks.length > 1
      ? `Block ${focusSession.index + 1}/${focusSession.blocks.length}`
      : "Focus"

  if (collapsed) {
    return (
      <div
        className="flex items-center justify-center px-2 py-2"
        title={`${formatTime(remainingSec)} — ${blockLabel} — ${focusSession.targetTitle}`}
      >
        {ring}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2">
      <div className="flex items-center gap-2">
        {ring}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-foreground">
            {formatTime(remainingSec)}
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{blockLabel}</span>
          </span>
          <span className="truncate text-xs text-muted-foreground">{focusSession.targetTitle}</span>
        </div>
        {!offering && (
          <button
            type="button"
            onClick={paused ? resumeFocus : pauseFocus}
            aria-label={paused ? "Resume focus timer" : "Pause focus timer"}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => endFocus()}
          aria-label="End focus timer"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Zero-ping offer at the end of a focus block. */}
      {offering && !isFinalBlock && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={takeBreak}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Coffee className="size-3" /> Break
          </button>
          <button
            type="button"
            onClick={continueNext}
            className="flex-1 rounded-md bg-surface-3 px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:text-foreground"
          >
            Keep going
          </button>
        </div>
      )}
      {offering && isFinalBlock && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={dismissPing}
            className="flex-1 rounded-md bg-surface-3 px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:text-foreground"
          >
            Keep going
          </button>
          <button
            type="button"
            onClick={() => endFocus()}
            className="flex-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            End
          </button>
        </div>
      )}
      {onBreak && (
        <button
          type="button"
          onClick={skipBreak}
          className="w-full rounded-md bg-surface-3 px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:text-foreground"
        >
          Skip break
        </button>
      )}
    </div>
  )
}
