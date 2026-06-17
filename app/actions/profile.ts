"use server"

import { and, eq, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { targets, user } from "@/lib/db/schema"
import { ALLOWED_EMOJIS } from "@/lib/emojis"
import { getMyStats } from "@/app/actions/targets"
import { checkAndUnlockAchievements, getBadgeCatalog } from "@/app/actions/achievements"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export async function getProfile() {
  const userId = await getUserId()

  await checkAndUnlockAchievements()

  const [[me], stats, [{ totalCompleted }], badges] = await Promise.all([
    db.select({ name: user.name, email: user.email, emoji: user.emoji }).from(user).where(eq(user.id, userId)),
    getMyStats(),
    db
      .select({ totalCompleted: sql<number>`count(*)` })
      .from(targets)
      .where(and(eq(targets.userId, userId), eq(targets.completed, true))),
    getBadgeCatalog(userId),
  ])

  return {
    name: me.name,
    email: me.email,
    emoji: me.emoji,
    points: stats.points,
    streak: stats.streak,
    bestStreak: stats.bestStreak,
    totalCompleted: Number(totalCompleted),
    badges,
  }
}

export async function updateProfile(data: { name: string; emoji: string }) {
  const userId = await getUserId()
  const name = data.name.trim()
  if (!name) return { ok: false, message: "Display name can't be empty." }
  if (!ALLOWED_EMOJIS.includes(data.emoji as (typeof ALLOWED_EMOJIS)[number])) {
    return { ok: false, message: "Pick one of the available emojis." }
  }

  await db.update(user).set({ name, emoji: data.emoji }).where(eq(user.id, userId))
  revalidatePath("/profile")
  revalidatePath("/")
  revalidatePath("/friends")
  return { ok: true, message: "Profile updated." }
}
