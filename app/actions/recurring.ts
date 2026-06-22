"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { recurringTasks } from "@/lib/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getToday } from "@/lib/date"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type RecurringFrequency = "daily" | "weekly" | "custom"

export async function getRecurringTasks() {
  const userId = await getUserId()
  return db
    .select()
    .from(recurringTasks)
    .where(and(eq(recurringTasks.userId, userId), eq(recurringTasks.active, true)))
    .orderBy(asc(recurringTasks.id))
}

/**
 * Creates a recurring task template. `daysOfWeek` (0=Sun..6=Sat) is required
 * for 'weekly', `intervalDays` for 'custom'. `anchorDate` defaults to today.
 */
export async function createRecurringTask(
  title: string,
  pillarId: number,
  points: number,
  frequency: RecurringFrequency,
  config: { daysOfWeek?: number[]; intervalDays?: number; anchorDate?: string; durationMinutes?: number | null; preferredTimeOfDay?: string | null }
) {
  const userId = await getUserId()
  const trimmed = title.trim()
  if (!trimmed) return null

  const anchorDate = config.anchorDate ?? (await getToday())

  const [created] = await db
    .insert(recurringTasks)
    .values({
      userId,
      pillarId,
      title: trimmed,
      points,
      frequency,
      daysOfWeek: frequency === "weekly" ? JSON.stringify(config.daysOfWeek ?? []) : null,
      intervalDays: frequency === "custom" ? config.intervalDays ?? null : null,
      anchorDate,
      durationMinutes: config.durationMinutes ?? null,
      preferredTimeOfDay: config.preferredTimeOfDay ?? null,
    })
    .returning()

  revalidatePath("/")
  return created
}

export async function deactivateRecurringTask(id: number) {
  const userId = await getUserId()
  await db
    .update(recurringTasks)
    .set({ active: false })
    .where(and(eq(recurringTasks.id, id), eq(recurringTasks.userId, userId)))

  revalidatePath("/")
}
