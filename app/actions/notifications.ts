"use server"

import { and, desc, eq, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "all_completed"
  | "overtaken"
  | "goal_reminder"
  | "neglected_pillar"

/** Insert a notification for a user. Used as a trigger from friend/target actions. */
export async function createNotification(userId: string, type: NotificationType, message: string, relatedId?: number) {
  await db.insert(notifications).values({ userId, type, message, relatedId })
}

export async function getNotifications() {
  const userId = await getUserId()
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
}

export async function getUnreadCount() {
  const userId = await getUserId()
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
  return Number(count)
}

export async function markAsRead(id: number) {
  const userId = await getUserId()
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
  revalidatePath("/notifications")
}

export async function markAllAsRead() {
  const userId = await getUserId()
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
  revalidatePath("/notifications")
}
