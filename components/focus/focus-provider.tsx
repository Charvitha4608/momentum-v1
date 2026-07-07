"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

import { recordFocusSession } from "@/app/actions/targets"

/** One focus block is 25 minutes; breaks between blocks are 5 minutes. */
export const FOCUS_BLOCK_MINUTES = 25
export const BREAK_SEC = 5 * 60

const STORAGE_KEY = "momentum:focus-session"

/** A target the focus timer can run against. */
export type FocusTarget = {
  id: number
  title: string
  pillarColor: string
  /** Drives the block plan; null/absent falls back to a single 25-min block. */
  estimatedMinutes?: number | null
}

type FocusPhase = "focus" | "break"

export type FocusSession = {
  targetId: number
  targetTitle: string
  pillarColor: string
  /** Planned focus-block lengths in minutes, e.g. 40 → [25, 15]. */
  blocks: number[]
  /** Index of the current (or just-finished, during a break) focus block. */
  index: number
  phase: FocusPhase
  /** ms epoch when the current segment (focus or break) started. */
  segStartedAt: number
  /** Planned length of the current segment, in seconds. */
  segDurationSec: number
  /** ms epoch when paused, or null when running. */
  pausedAt: number | null
  /** accumulated paused time in ms. */
  totalPausedMs: number
  /** The current focus segment's countdown has reached zero (ping fired). */
  pinged: boolean
  /** On the final block, "keep going" hides the ping offer while overrunning. */
  dismissed: boolean
}

type FocusContextValue = {
  focusSession: FocusSession | null
  /** Live remaining seconds of the current segment, clamped at 0. */
  remainingSec: number
  startFocus: (target: FocusTarget) => void
  pauseFocus: () => void
  resumeFocus: () => void
  /** Stop the timer. Pass finishCredit when the task itself was just finished. */
  endFocus: (opts?: { finishCredit?: boolean }) => void
  /** At a non-final block's ping: close it and begin a 5-min break. */
  takeBreak: () => void
  /** At a non-final block's ping: skip the break, start the next block now. */
  continueNext: () => void
  /** At the final block's ping: dismiss the offer and keep overrunning. */
  dismissPing: () => void
  /** During a break: end it early and start the next focus block. */
  skipBreak: () => void
}

const FocusContext = createContext<FocusContextValue | null>(null)

/** Shrinking-remainder block plan: 40→[25,15], 55→[25,25,5], 18→[18]. */
export function planBlocks(estimateMinutes: number | null | undefined): number[] {
  const est = estimateMinutes && estimateMinutes > 0 ? Math.round(estimateMinutes) : FOCUS_BLOCK_MINUTES
  const blocks: number[] = []
  let remaining = est
  while (remaining > 0) {
    const block = Math.min(FOCUS_BLOCK_MINUTES, remaining)
    blocks.push(block)
    remaining -= block
  }
  return blocks
}

/** Elapsed running milliseconds for the current segment, reading `now` fresh. */
function elapsedMs(session: FocusSession, now: number): number {
  const paused = session.pausedAt != null ? now - session.pausedAt : 0
  return now - session.segStartedAt - session.totalPausedMs - paused
}

function remainingSecOf(session: FocusSession, now: number): number {
  const left = session.segDurationSec * 1000 - elapsedMs(session, now)
  return Math.max(0, Math.ceil(left / 1000))
}

/** Best-effort ping when a block's countdown hits zero — never throws. */
function emitPing() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([120, 60, 120])
    }
  } catch {
    /* vibration unsupported */
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 660
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.18)
    osc.onended = () => ctx.close()
  } catch {
    /* audio blocked */
  }
}

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null)
  // Bump each second to drive re-renders; the real math reads Date.now() fresh.
  const [, setTick] = useState(0)
  // Latest session, so imperative callbacks read it without stale closures.
  const sessionRef = useRef<FocusSession | null>(null)
  sessionRef.current = focusSession

  // Rehydrate on mount, discarding an entry stale enough to be abandoned.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as FocusSession
      // A pinged block may legitimately overrun, so allow a wide window before
      // treating a persisted session as abandoned (e.g. tab left open overnight).
      if (Date.now() - saved.segStartedAt > 3 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      setFocusSession(saved)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Persist minimal state so a refresh keeps the timer running.
  useEffect(() => {
    if (focusSession) localStorage.setItem(STORAGE_KEY, JSON.stringify(focusSession))
    else localStorage.removeItem(STORAGE_KEY)
  }, [focusSession])

  // One interval drives re-renders while a session is active.
  useEffect(() => {
    if (!focusSession) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [focusSession])

  // Logs a finished focus segment: its elapsed whole minutes are added to the
  // target's actualMinutes and a focus_sessions row is written for the heatmaps.
  // `creditsSession` (a completed countdown, or the task being finished here)
  // also bumps the whole sessionsCompleted counter. Breaks record nothing.
  const recordSegment = useCallback((session: FocusSession, finishCredit: boolean) => {
    if (session.phase !== "focus") return
    const now = Date.now()
    const elapsed = elapsedMs(session, now)
    const minutes = Math.round(elapsed / 60000)
    if (minutes < 1) return
    recordFocusSession(session.targetId, minutes, {
      durationSec: Math.floor(elapsed / 1000),
      completed: session.pinged,
      creditsSession: session.pinged || finishCredit,
      startedAtMs: session.segStartedAt,
      endedAtMs: now,
    }).catch(() => {
      /* best-effort; UI already advanced */
    })
  }, [])

  const startFocusBlock = useCallback((base: FocusSession, index: number) => {
    setFocusSession({
      ...base,
      index,
      phase: "focus",
      segStartedAt: Date.now(),
      segDurationSec: base.blocks[index] * 60,
      pausedAt: null,
      totalPausedMs: 0,
      pinged: false,
      dismissed: false,
    })
  }, [])

  const startFocus = useCallback((target: FocusTarget) => {
    const blocks = planBlocks(target.estimatedMinutes)
    setFocusSession({
      targetId: target.id,
      targetTitle: target.title,
      pillarColor: target.pillarColor,
      blocks,
      index: 0,
      phase: "focus",
      segStartedAt: Date.now(),
      segDurationSec: blocks[0] * 60,
      pausedAt: null,
      totalPausedMs: 0,
      pinged: false,
      dismissed: false,
    })
  }, [])

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setFocusSession(null)
  }, [])

  const endFocus = useCallback(
    (opts?: { finishCredit?: boolean }) => {
      const s = sessionRef.current
      if (!s) return
      recordSegment(s, !!opts?.finishCredit)
      clearSession()
    },
    [recordSegment, clearSession]
  )

  // Non-final block ping → close it (credited) and either break or continue.
  const takeBreak = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.phase !== "focus") return
    recordSegment(s, false)
    setFocusSession({
      ...s,
      phase: "break",
      segStartedAt: Date.now(),
      segDurationSec: BREAK_SEC,
      pausedAt: null,
      totalPausedMs: 0,
      pinged: false,
      dismissed: false,
    })
  }, [recordSegment])

  const continueNext = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.phase !== "focus") return
    recordSegment(s, false)
    startFocusBlock(s, s.index + 1)
  }, [recordSegment, startFocusBlock])

  const dismissPing = useCallback(() => {
    setFocusSession((prev) => (prev ? { ...prev, dismissed: true } : prev))
  }, [])

  const skipBreak = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.phase !== "break") return
    startFocusBlock(s, s.index + 1)
  }, [startFocusBlock])

  // Segment reaching zero: a break auto-advances to the next block; a focus
  // block pings once and keeps running (soft stop — overrun still counts).
  useEffect(() => {
    const s = focusSession
    if (!s || s.pausedAt != null) return
    if (remainingSecOf(s, Date.now()) > 0) return
    if (s.phase === "break") {
      startFocusBlock(s, s.index + 1)
    } else if (!s.pinged) {
      setFocusSession((prev) => (prev ? { ...prev, pinged: true } : prev))
      emitPing()
    }
  })

  const pauseFocus = useCallback(() => {
    setFocusSession((prev) => (prev && prev.pausedAt == null ? { ...prev, pausedAt: Date.now() } : prev))
  }, [])

  const resumeFocus = useCallback(() => {
    setFocusSession((prev) =>
      prev && prev.pausedAt != null
        ? { ...prev, pausedAt: null, totalPausedMs: prev.totalPausedMs + (Date.now() - prev.pausedAt) }
        : prev
    )
  }, [])

  const remainingSec = focusSession ? remainingSecOf(focusSession, Date.now()) : 0

  return (
    <FocusContext.Provider
      value={{
        focusSession,
        remainingSec,
        startFocus,
        pauseFocus,
        resumeFocus,
        endFocus,
        takeBreak,
        continueNext,
        dismissPing,
        skipBreak,
      }}
    >
      {children}
    </FocusContext.Provider>
  )
}

export function useFocus() {
  const ctx = useContext(FocusContext)
  if (!ctx) throw new Error("useFocus must be used within a FocusProvider")
  return ctx
}
