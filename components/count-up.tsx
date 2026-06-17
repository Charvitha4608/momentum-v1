"use client"

import { useEffect, useRef } from "react"
import { animate, useMotionValue, useMotionValueEvent } from "framer-motion"

/** Animates a number counting up from 0 to `value` on mount/change. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.6, ease: "easeOut" })
    return controls.stop
  }, [value, motionValue])

  useMotionValueEvent(motionValue, "change", (latest) => {
    if (ref.current) ref.current.textContent = latest.toFixed(decimals)
  })

  return <span ref={ref}>{value.toFixed(decimals)}</span>
}
