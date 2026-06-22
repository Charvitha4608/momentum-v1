"use server"

import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { availability, availabilityOverride } from "@/lib/db/schema"
import { getToday } from "@/lib/date"
import { isWeekend } from "@/lib/planner/schedule"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type AvailabilityDefaults = {
  weekdayHours: number
  weekendHours: number
  dayStartHour: number
  dayEndHour: number
}

const FALLBACK: AvailabilityDefaults = { weekdayHours: 3, weekendHours: 5, dayStartHour: 9, dayEndHour: 22 }

/** The user's default availability, lazily creating the row on first read. */
export async function getAvailability(): Promise<AvailabilityDefaults> {
  const userId = await getUserId()
  const [row] = await db.select().from(availability).where(eq(availability.userId, userId))
  if (!row) {
    await db.insert(availability).values({ userId }).onConflictDoNothing()
    return FALLBACK
  }
  return {
    weekdayHours: row.weekdayHours,
    weekendHours: row.weekendHours,
    dayStartHour: row.dayStartHour,
    dayEndHour: row.dayEndHour,
  }
}

export async function setAvailability(values: AvailabilityDefaults) {
  const userId = await getUserId()
  const clean = {
    weekdayHours: clampHours(values.weekdayHours),
    weekendHours: clampHours(values.weekendHours),
    dayStartHour: Math.max(0, Math.min(23, Math.round(values.dayStartHour))),
    dayEndHour: Math.max(1, Math.min(24, Math.round(values.dayEndHour))),
    updatedAt: new Date(),
  }
  await db
    .insert(availability)
    .values({ userId, ...clean })
    .onConflictDoUpdate({ target: availability.userId, set: clean })
  revalidatePath("/profile")
  revalidatePath("/")
  revalidatePath("/calendar")
}

/** Set (or clear, when hours is null) a per-date override of the default budget. */
export async function setAvailabilityOverride(date: string, hours: number | null) {
  const userId = await getUserId()
  if (hours === null) {
    await db
      .delete(availabilityOverride)
      .where(and(eq(availabilityOverride.userId, userId), eq(availabilityOverride.date, date)))
  } else {
    const clean = clampHours(hours)
    await db
      .insert(availabilityOverride)
      .values({ userId, date, hours: clean })
      .onConflictDoUpdate({ target: [availabilityOverride.userId, availabilityOverride.date], set: { hours: clean } })
  }
  revalidatePath("/")
  revalidatePath("/calendar")
}

/** Resolved hours for one date: per-date override wins, else weekday/weekend default. */
export async function getHoursForDate(date: string): Promise<number> {
  const userId = await getUserId()
  const [override] = await db
    .select({ hours: availabilityOverride.hours })
    .from(availabilityOverride)
    .where(and(eq(availabilityOverride.userId, userId), eq(availabilityOverride.date, date)))
  if (override) return override.hours
  const defaults = await getAvailability()
  return isWeekend(date) ? defaults.weekendHours : defaults.weekdayHours
}

/** Convenience for the dashboard quick-edit: today's resolved hours + whether an override is set. */
export async function getTodayAvailability(): Promise<{ date: string; hours: number; hasOverride: boolean }> {
  const userId = await getUserId()
  const date = await getToday()
  const [override] = await db
    .select({ hours: availabilityOverride.hours })
    .from(availabilityOverride)
    .where(and(eq(availabilityOverride.userId, userId), eq(availabilityOverride.date, date)))
  const hours = override ? override.hours : await getHoursForDate(date)
  return { date, hours, hasOverride: Boolean(override) }
}

function clampHours(h: number): number {
  if (Number.isNaN(h)) return 0
  return Math.max(0, Math.min(24, Math.round(h * 2) / 2)) // 0-24, half-hour steps
}
