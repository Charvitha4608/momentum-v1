"use server"

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { challengeParticipants, challenges, pillars, targets, user } from "@/lib/db/schema"
import { daysBetween, getToday, shiftDateString } from "@/lib/date"
import { getFriendIds } from "@/lib/friend-ids"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/** Verify the current user may view/join a challenge created by `creatorId`. */
async function assertAccess(userId: string, creatorId: string) {
  if (creatorId === userId) return
  const friendIds = await getFriendIds(userId)
  if (!friendIds.includes(creatorId)) throw new Error("You're not friends with this challenge's creator.")
}

/** Per-participant totals for a challenge's metric over its date range. */
async function getParticipantTotals(
  participantIds: string[],
  pillarId: number | null,
  metric: "points" | "tasks",
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  if (participantIds.length === 0) return new Map()

  const endExclusive = shiftDateString(endDate, 1)
  const conditions = [
    inArray(targets.userId, participantIds),
    eq(targets.completed, true),
    gte(targets.originalDate, startDate),
    sql`${targets.originalDate} < ${endExclusive}`,
  ]
  if (pillarId != null) conditions.push(eq(targets.pillarId, pillarId))

  const valueExpr = metric === "points" ? sql<number>`coalesce(sum(${targets.points}), 0)` : sql<number>`count(*)`

  const rows = await db
    .select({ userId: targets.userId, value: valueExpr })
    .from(targets)
    .where(and(...conditions))
    .groupBy(targets.userId)

  return new Map(rows.map((r) => [r.userId, Number(r.value)]))
}

export type ChallengeSummary = {
  id: number
  title: string
  pillarId: number | null
  pillarName: string | null
  pillarIcon: string | null
  pillarColor: string | null
  metric: "points" | "tasks"
  startDate: string
  endDate: string
  creatorId: string
  creatorName: string
  participantCount: number
  joined: boolean
  status: "upcoming" | "active" | "ended"
  daysRemaining: number
  myValue: number
  winner: { userId: string; name: string; emoji: string; value: number } | null
}

/** Challenges created by the current user or any of their friends. */
export async function getChallenges(): Promise<ChallengeSummary[]> {
  const userId = await getUserId()
  const today = await getToday()
  const friendIds = await getFriendIds(userId)
  const creatorIds = [userId, ...friendIds]

  const rows = await db
    .select({
      id: challenges.id,
      title: challenges.title,
      pillarId: challenges.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      pillarColor: pillars.color,
      metric: challenges.metric,
      startDate: challenges.startDate,
      endDate: challenges.endDate,
      creatorId: challenges.creatorId,
      creatorName: user.name,
    })
    .from(challenges)
    .leftJoin(pillars, eq(challenges.pillarId, pillars.id))
    .innerJoin(user, eq(challenges.creatorId, user.id))
    .where(inArray(challenges.creatorId, creatorIds))
    .orderBy(desc(challenges.createdAt))

  if (rows.length === 0) return []

  const participantRows = await db
    .select({ challengeId: challengeParticipants.challengeId, userId: challengeParticipants.userId })
    .from(challengeParticipants)
    .where(
      inArray(
        challengeParticipants.challengeId,
        rows.map((r) => r.id)
      )
    )

  const participantsByChallenge = new Map<number, string[]>()
  for (const p of participantRows) {
    if (!participantsByChallenge.has(p.challengeId)) participantsByChallenge.set(p.challengeId, [])
    participantsByChallenge.get(p.challengeId)!.push(p.userId)
  }

  const result: ChallengeSummary[] = []
  for (const r of rows) {
    const participantIds = participantsByChallenge.get(r.id) ?? []
    const metric = r.metric as "points" | "tasks"
    const status: "upcoming" | "active" | "ended" = today < r.startDate ? "upcoming" : today > r.endDate ? "ended" : "active"

    let myValue = 0
    let winner: ChallengeSummary["winner"] = null
    if (participantIds.length > 0) {
      const totals = await getParticipantTotals(participantIds, r.pillarId, metric, r.startDate, r.endDate)
      myValue = totals.get(userId) ?? 0

      if (status === "ended") {
        let bestId: string | null = null
        let bestValue = -1
        for (const pid of participantIds) {
          const v = totals.get(pid) ?? 0
          if (v > bestValue) {
            bestValue = v
            bestId = pid
          }
        }
        if (bestId) {
          const [winnerUser] = await db.select({ name: user.name, emoji: user.emoji }).from(user).where(eq(user.id, bestId))
          winner = { userId: bestId, name: winnerUser.name, emoji: winnerUser.emoji, value: bestValue }
        }
      }
    }

    result.push({
      id: r.id,
      title: r.title,
      pillarId: r.pillarId,
      pillarName: r.pillarName,
      pillarIcon: r.pillarIcon,
      pillarColor: r.pillarColor,
      metric,
      startDate: r.startDate,
      endDate: r.endDate,
      creatorId: r.creatorId,
      creatorName: r.creatorName,
      participantCount: participantIds.length,
      joined: participantIds.includes(userId),
      status,
      daysRemaining: Math.max(0, daysBetween(today, r.endDate)),
      myValue,
      winner,
    })
  }

  return result
}

/** Create a challenge starting today, running for `durationDays` days (inclusive). The creator auto-joins. */
export async function createChallenge(title: string, pillarId: number | null, metric: "points" | "tasks", durationDays: number) {
  const userId = await getUserId()
  const trimmed = title.trim()
  if (!trimmed) return null
  if (!Number.isFinite(durationDays) || durationDays <= 0) return null

  const today = await getToday()
  const startDate = today
  const endDate = shiftDateString(today, Math.round(durationDays) - 1)

  const [created] = await db.insert(challenges).values({ creatorId: userId, title: trimmed, pillarId, metric, startDate, endDate }).returning()
  await db.insert(challengeParticipants).values({ challengeId: created.id, userId }).onConflictDoNothing()

  revalidatePath("/friends")
  return created
}

/** Join a challenge created by the current user or one of their friends. */
export async function joinChallenge(id: number) {
  const userId = await getUserId()
  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, id))
  if (!challenge) return

  await assertAccess(userId, challenge.creatorId)
  await db.insert(challengeParticipants).values({ challengeId: id, userId }).onConflictDoNothing()
  revalidatePath("/friends")
}

export type ChallengeParticipantRow = { userId: string; name: string; emoji: string; value: number; isMe: boolean }

export type ChallengeDetail = {
  id: number
  title: string
  pillarName: string | null
  pillarIcon: string | null
  metric: "points" | "tasks"
  startDate: string
  endDate: string
  status: "upcoming" | "active" | "ended"
  participants: ChallengeParticipantRow[]
}

/** Full rankings for one challenge, sorted by the challenge's metric (desc). */
export async function getChallengeDetail(id: number): Promise<ChallengeDetail | null> {
  const userId = await getUserId()

  const [row] = await db
    .select({
      id: challenges.id,
      title: challenges.title,
      pillarId: challenges.pillarId,
      pillarName: pillars.name,
      pillarIcon: pillars.icon,
      metric: challenges.metric,
      startDate: challenges.startDate,
      endDate: challenges.endDate,
      creatorId: challenges.creatorId,
    })
    .from(challenges)
    .leftJoin(pillars, eq(challenges.pillarId, pillars.id))
    .where(eq(challenges.id, id))

  if (!row) return null
  await assertAccess(userId, row.creatorId)

  const today = await getToday()
  const metric = row.metric as "points" | "tasks"
  const status: "upcoming" | "active" | "ended" = today < row.startDate ? "upcoming" : today > row.endDate ? "ended" : "active"

  const participantRows = await db
    .select({ userId: challengeParticipants.userId, name: user.name, emoji: user.emoji })
    .from(challengeParticipants)
    .innerJoin(user, eq(challengeParticipants.userId, user.id))
    .where(eq(challengeParticipants.challengeId, id))

  const totals = await getParticipantTotals(participantRows.map((p) => p.userId), row.pillarId, metric, row.startDate, row.endDate)

  const participants: ChallengeParticipantRow[] = participantRows.map((p) => ({
    userId: p.userId,
    name: p.name,
    emoji: p.emoji,
    value: totals.get(p.userId) ?? 0,
    isMe: p.userId === userId,
  }))
  participants.sort((a, b) => b.value - a.value)

  return {
    id: row.id,
    title: row.title,
    pillarName: row.pillarName,
    pillarIcon: row.pillarIcon,
    metric,
    startDate: row.startDate,
    endDate: row.endDate,
    status,
    participants,
  }
}
