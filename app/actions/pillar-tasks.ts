"use server"

import { and, asc, eq, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { pillarTasks } from "@/lib/db/schema"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type PillarTask = typeof pillarTasks.$inferSelect

/** A pillar's checklist items, active-first order (sortOrder, then createdAt). */
export async function getPillarTasks(pillarId: number): Promise<PillarTask[]> {
  const userId = await getUserId()
  return db
    .select()
    .from(pillarTasks)
    .where(and(eq(pillarTasks.userId, userId), eq(pillarTasks.pillarId, pillarId)))
    .orderBy(asc(pillarTasks.sortOrder), asc(pillarTasks.createdAt))
}

export async function addPillarTask(pillarId: number, title: string) {
  const userId = await getUserId()
  const trimmed = title.trim()
  if (!trimmed) return null

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${pillarTasks.sortOrder}), 0)` })
    .from(pillarTasks)
    .where(and(eq(pillarTasks.userId, userId), eq(pillarTasks.pillarId, pillarId)))

  const [created] = await db
    .insert(pillarTasks)
    .values({ userId, pillarId, title: trimmed, sortOrder: (max ?? 0) + 1 })
    .returning()

  revalidatePath("/goals")
  return created
}

/** Flip an item's done state, stamping/clearing completedAt to match. */
export async function togglePillarTask(taskId: number) {
  const userId = await getUserId()

  const [task] = await db
    .select({ isDone: pillarTasks.isDone })
    .from(pillarTasks)
    .where(and(eq(pillarTasks.id, taskId), eq(pillarTasks.userId, userId)))

  if (!task) return null

  const nextDone = !task.isDone
  const [updated] = await db
    .update(pillarTasks)
    .set({ isDone: nextDone, completedAt: nextDone ? new Date() : null })
    .where(and(eq(pillarTasks.id, taskId), eq(pillarTasks.userId, userId)))
    .returning()

  revalidatePath("/goals")
  return updated
}

export async function deletePillarTask(taskId: number) {
  const userId = await getUserId()
  await db.delete(pillarTasks).where(and(eq(pillarTasks.id, taskId), eq(pillarTasks.userId, userId)))
  revalidatePath("/goals")
}
