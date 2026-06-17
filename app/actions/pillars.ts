"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { pillars } from "@/lib/db/schema"
import { and, asc, eq, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

function revalidateAll() {
  revalidatePath("/")
  revalidatePath("/calendar")
  revalidatePath("/goals")
  revalidatePath("/reflection")
}

export async function getPillars(includeArchived = false) {
  const userId = await getUserId()
  const conditions = includeArchived
    ? [eq(pillars.userId, userId)]
    : [eq(pillars.userId, userId), eq(pillars.archived, false)]

  return db
    .select()
    .from(pillars)
    .where(and(...conditions))
    .orderBy(asc(pillars.sortOrder), asc(pillars.id))
}

export async function createPillar(name: string, icon: string, color: string) {
  const userId = await getUserId()
  const trimmed = name.trim()
  if (!trimmed) return null

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${pillars.sortOrder}), 0)` })
    .from(pillars)
    .where(eq(pillars.userId, userId))

  const [created] = await db
    .insert(pillars)
    .values({ userId, name: trimmed, icon, color, sortOrder: (max ?? 0) + 1 })
    .returning()

  revalidateAll()
  return created
}

export async function updatePillar(id: number, { name, icon, color }: { name: string; icon: string; color: string }) {
  const userId = await getUserId()
  const trimmed = name.trim()
  if (!trimmed) return

  await db
    .update(pillars)
    .set({ name: trimmed, icon, color })
    .where(and(eq(pillars.id, id), eq(pillars.userId, userId)))

  revalidateAll()
}

export async function archivePillar(id: number) {
  const userId = await getUserId()
  await db
    .update(pillars)
    .set({ archived: true })
    .where(and(eq(pillars.id, id), eq(pillars.userId, userId)))

  revalidateAll()
}

export async function unarchivePillar(id: number) {
  const userId = await getUserId()
  await db
    .update(pillars)
    .set({ archived: false })
    .where(and(eq(pillars.id, id), eq(pillars.userId, userId)))

  revalidateAll()
}
