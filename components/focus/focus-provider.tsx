"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

import { recordFocusSession } from "@/app/actions/targets"

/** Default Pomodoro length: 25 minutes. */
export const FOCUS_DEFAULT_DURATION_SEC = 25 * 60

const STORAGE_KEY = "momentum:focus-session"

/** A target the focus timer can run against. */
export type FocusTarget = {
  id: number
  title: string
  pillarColor: string
}

export type FocusSession = {
  targetId: number
  targetTitle: string
  pillarColor: string
  /** ms epoch when the session started. */
  startedAt: number
  durationSec: number
  /** ms epoch when paused, or null when running. */
  pausedAt: number | null
  /** accumulated paused time in ms. */
  totalPausedMs: number
}

type FocusContextValue = {
  focusSession: FocusSession | null
  /** live remaining seconds, clamped at 0 — re-derived each tick. */
  remainingSec: number
  startFocus: (target: FocusTarget, durationSec?: number) => void
  pauseFocus: () => void
  resumeFocus: () => void
  endFocus: () => void
}

const FocusContext = createContext<FocusContextValue | null>(null)

/** Elapsed running milliseconds for a session, reading `Date.now()` fresh. */
function elapsedMs(session: FocusSession, now: number): number {
  const paused = session.pausedAt != null ? now - session.pausedAt : 0
  return now - session.startedAt - session.totalPausedMs - paused
}

function remainingSecOf(session: FocusSession, now: number): number {
  const left = session.durationSec * 1000 - elapsedMs(session, now)
  return Math.max(0, Math.ceil(left / 1000))
}

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null)
  // Bump each second to drive re-renders; the real math reads Date.now() fresh.
  const [, setTick] = useState(0)
  // Guards the completion mutation so a natural-completion tick fires it once.
  const finishingRef = useRef(false)
  // Latest session, so imperative callbacks (endFocus) read it without stale closures.
  const sessionRef = useRef<FocusSession | null>(null)
  sessionRef.current = focusSession

  // Rehydrate on mount, discarding a stale entry (finished long ago).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as FocusSession
      const now = Date.now()
      if (now - saved.startedAt > saved.durationSec * 1000 + 60000) {
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
    if (focusSession) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(focusSession))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [focusSession])

  // One interval drives re-renders while a session is active.
  useEffect(() => {
    if (!focusSession) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [focusSession])

  // Logs elapsed whole minutes to the target, then clears the session. The
  // same call also persists a focus_sessions row carrying the precise timing
  // (start/end/actual seconds/whether it ran to completion) the Focus heatmaps
  // aggregate on — strictly additive to Tier 1's actualMinutes increment.
  const finish = useCallback((session: FocusSession) => {
    if (finishingRef.current) return
    finishingRef.current = true
    const now = Date.now()
    const elapsed = elapsedMs(session, now)
    const elapsedMinutes = Math.round(elapsed / 60000)
    localStorage.removeItem(STORAGE_KEY)
    setFocusSession(null)
    const done = () => {
      finishingRef.current = false
    }
    if (elapsedMinutes >= 1) {
      const durationSec = Math.floor(elapsed / 1000)
      recordFocusSession(session.targetId, elapsedMinutes, {
        durationSec,
        completed: durationSec >= session.durationSec * 0.95,
        startedAtMs: session.startedAt,
        endedAtMs: now,
      }).then(done, done)
    } else {
      done()
    }
  }, [])

  // Natural completion: when a running session hits zero, finish it.
  useEffect(() => {
    if (!focusSession || focusSession.pausedAt != null) return
    if (remainingSecOf(focusSession, Date.now()) <= 0) finish(focusSession)
  })

  const startFocus = useCallback((target: FocusTarget, durationSec = FOCUS_DEFAULT_DURATION_SEC) => {
    finishingRef.current = false
    setFocusSession({
      targetId: target.id,
      targetTitle: target.title,
      pillarColor: target.pillarColor,
      startedAt: Date.now(),
      durationSec,
      pausedAt: null,
      totalPausedMs: 0,
    })
  }, [])

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

  const endFocus = useCallback(() => {
    if (sessionRef.current) finish(sessionRef.current)
  }, [finish])

  const remainingSec = focusSession ? remainingSecOf(focusSession, Date.now()) : 0

  return (
    <FocusContext.Provider
      value={{ focusSession, remainingSec, startFocus, pauseFocus, resumeFocus, endFocus }}
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
