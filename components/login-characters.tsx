"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { motion } from "framer-motion"

type Vec = { x: number; y: number }

const PUPIL_SPRING = { type: "spring" as const, stiffness: 700, damping: 35, mass: 0.4 }
const BODY_SPRING = { type: "spring" as const, stiffness: 220, damping: 18, mass: 0.6 }
const LID_TRANSITION = { duration: 0.1, ease: "easeInOut" as const }

function useBlink(minMs: number, maxMs: number) {
  const [blinking, setBlinking] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const schedule = () => {
      timeout = setTimeout(() => {
        setBlinking(true)
        timeout = setTimeout(() => {
          setBlinking(false)
          schedule()
        }, 120)
      }, minMs + Math.random() * (maxMs - minMs))
    }
    schedule()
    return () => clearTimeout(timeout)
  }, [minMs, maxMs])

  return blinking
}

/**
 * Offset of an element's center from the live cursor, clamped to
 * `maxDistance` and expressed as an angle-based {x, y} vector — or, when
 * `forced` is set, a fixed offset in that direction (used for "closed"/
 * "looking away" states).
 */
function useLookOffset<T extends HTMLElement>(
  ref: RefObject<T | null>,
  mouse: Vec,
  maxDistance: number,
  forced?: Vec | null,
) {
  const [offset, setOffset] = useState<Vec>({ x: 0, y: 0 })

  useEffect(() => {
    if (forced) {
      setOffset({ x: forced.x * maxDistance, y: forced.y * maxDistance })
      return
    }
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = mouse.x - cx
    const dy = mouse.y - cy
    const distance = Math.min(Math.hypot(dx, dy), maxDistance)
    const angle = Math.atan2(dy, dx)
    setOffset({ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance })
  }, [ref, mouse, forced, maxDistance])

  return offset
}

function Eye({
  mouse,
  size,
  pupilSize,
  maxDistance,
  closed,
  pupilOnly,
  forced,
}: {
  mouse: Vec
  size: number
  pupilSize: number
  maxDistance: number
  closed?: boolean
  pupilOnly?: boolean
  forced?: Vec | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const offset = useLookOffset(ref, mouse, maxDistance, forced)

  const pupil = (
    <motion.div
      className="rounded-full bg-[#18172d]" // COLOR: pupil — fixed dark dot (matches --background) on every character
      style={{ width: pupilSize, height: pupilSize }}
      animate={{ x: offset.x, y: offset.y }}
      transition={PUPIL_SPRING}
    />
  )

  if (pupilOnly) {
    return (
      <div ref={ref} className="flex items-center justify-center" style={{ width: size, height: size }}>
        {pupil}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className="flex items-center justify-center overflow-hidden rounded-full bg-[#e8eae7]" // COLOR: eye sclera — Character4/foreground tone reused for eye whites
      style={{ width: size }}
      animate={{ height: closed ? 2 : size }}
      transition={LID_TRANSITION}
    >
      {!closed && pupil}
    </motion.div>
  )
}

function Mouth({ mouse, forced }: { mouse: Vec; forced?: Vec | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const offset = useLookOffset(ref, mouse, 5, forced)

  return (
    <motion.div
      ref={ref}
      className="absolute h-1 w-12 rounded-full bg-[#18172d]" // COLOR: Character4 mouth — matches --background for contrast against the light fill
      style={{ left: 38, top: 78 }}
      animate={{ x: offset.x, y: offset.y }}
      transition={PUPIL_SPRING}
    />
  )
}

/**
 * Eye-tracking, blinking, body-leaning character illustration for the auth
 * screen. Interaction model adapted from inspirations/login_page/code.txt:
 * pupils track the live cursor (clamped distance + angle, via
 * getBoundingClientRect), bodies skew/shift toward the cursor with spring
 * physics, and characters react to form focus state.
 *
 * Colors follow the Character 1-4 -> MASTER_SPEC palette mapping from
 * inspirations/login_page/prompt_for_claude.txt.
 */
export function LoginCharacters({
  focused,
  shy,
  passwordFocused,
}: {
  focused: boolean
  shy: boolean
  passwordFocused: boolean
}) {
  const char1Ref = useRef<HTMLDivElement>(null)
  const char2Ref = useRef<HTMLDivElement>(null)
  const char3Ref = useRef<HTMLDivElement>(null)
  const char4Ref = useRef<HTMLDivElement>(null)

  const [mouse, setMouse] = useState<Vec>({ x: 0, y: 0 })
  const [lean, setLean] = useState({ c1: 0, c2: 0, c3: 0, c4: 0 })

  const blink1 = useBlink(2500, 5500)
  const blink2 = useBlink(3200, 6000)

  useEffect(() => {
    let raf = 0
    const leanFor = (ref: RefObject<HTMLDivElement | null>, clientX: number) => {
      const el = ref.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      const dx = clientX - (rect.left + rect.width / 2)
      return Math.max(-6, Math.min(6, -dx / 60))
    }
    const handleMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setMouse({ x: e.clientX, y: e.clientY })
        setLean({
          c1: leanFor(char1Ref, e.clientX),
          c2: leanFor(char2Ref, e.clientX),
          c3: leanFor(char3Ref, e.clientX),
          c4: leanFor(char4Ref, e.clientX),
        })
      })
    }
    window.addEventListener("mousemove", handleMove)
    return () => {
      window.removeEventListener("mousemove", handleMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Password field focused: eyelid characters (1 & 2) shut their eyes.
  // Pupil-only characters (3 & 4) can't close, so they glance down instead —
  // their version of "not watching you type".
  const lookDown: Vec = { x: 0, y: 1 }
  // Password revealed with content: everyone looks away for privacy.
  const lookAway: Vec = { x: -1, y: -1 }

  const eyesClosed = passwordFocused
  const forcedEyelid = shy ? lookAway : null
  const forcedPupilOnly = shy ? lookAway : passwordFocused ? lookDown : null

  // Bodies straighten out of their cursor-lean while giving privacy.
  const giveSpace = shy || passwordFocused
  const bodyAnim = (tilt: number) => ({ skewX: giveSpace ? 0 : tilt, x: giveSpace ? 0 : tilt * 1.5 })

  return (
    <div className="relative mx-auto h-[300px] w-[420px]">
      {/* Character 1 — back silhouette */}
      <motion.div
        ref={char1Ref}
        className="absolute bottom-0 left-[30px] rounded-t-2xl"
        style={{ width: 130, backgroundColor: "#3d3f63", transformOrigin: "bottom center" }} // COLOR: Character1 fill — see globals.css --card
        animate={{ height: focused ? 290 : 270, ...bodyAnim(lean.c1) }}
        transition={BODY_SPRING}
      >
        <div className="absolute left-[28px] top-[36px] flex gap-5">
          <Eye mouse={mouse} size={16} pupilSize={6} maxDistance={4} closed={blink1 || eyesClosed} forced={forcedEyelid} />
          <Eye mouse={mouse} size={16} pupilSize={6} maxDistance={4} closed={blink1 || eyesClosed} forced={forcedEyelid} />
        </div>
      </motion.div>

      {/* Character 2 — medium tower */}
      <motion.div
        ref={char2Ref}
        className="absolute bottom-0 left-[160px] rounded-t-2xl"
        style={{ width: 105, height: 210, backgroundColor: "#8b8fc2", transformOrigin: "bottom center" }} // COLOR: Character2 fill — see globals.css --secondary
        animate={bodyAnim(lean.c2)}
        transition={BODY_SPRING}
      >
        <div className="absolute left-[22px] top-[28px] flex gap-4">
          <Eye mouse={mouse} size={14} pupilSize={5} maxDistance={3} closed={blink2 || eyesClosed} forced={forcedEyelid} />
          <Eye mouse={mouse} size={14} pupilSize={5} maxDistance={3} closed={blink2 || eyesClosed} forced={forcedEyelid} />
        </div>
      </motion.div>

      {/* Character 3 — front mound */}
      <motion.div
        ref={char3Ref}
        className="absolute bottom-0 left-0 rounded-t-[100px]"
        style={{ width: 200, height: 130, backgroundColor: "#b6b0ea", transformOrigin: "bottom center" }} // COLOR: Character3 fill — see globals.css --primary
        animate={bodyAnim(lean.c3)}
        transition={BODY_SPRING}
      >
        <div className="absolute left-[70px] top-[44px] flex gap-7">
          <Eye mouse={mouse} size={10} pupilSize={10} maxDistance={5} pupilOnly forced={forcedPupilOnly} />
          <Eye mouse={mouse} size={10} pupilSize={10} maxDistance={5} pupilOnly forced={forcedPupilOnly} />
        </div>
      </motion.div>

      {/* Character 4 — front-right, with mouth */}
      <motion.div
        ref={char4Ref}
        className="absolute bottom-0 left-[250px] rounded-t-[60px]"
        style={{ width: 130, height: 170, backgroundColor: "#edeef4", transformOrigin: "bottom center" }} // COLOR: Character4 fill — see globals.css --foreground
        animate={bodyAnim(lean.c4)}
        transition={BODY_SPRING}
      >
        <div className="absolute left-[40px] top-[39px] flex gap-5">
          <Eye mouse={mouse} size={10} pupilSize={10} maxDistance={5} pupilOnly forced={forcedPupilOnly} />
          <Eye mouse={mouse} size={10} pupilSize={10} maxDistance={5} pupilOnly forced={forcedPupilOnly} />
        </div>
        <Mouth mouse={mouse} forced={forcedPupilOnly} />
      </motion.div>
    </div>
  )
}
