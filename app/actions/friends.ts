"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { dailyStats, friendships, notifications, pillars, targets, user } from "@/lib/db/schema"
import { and, asc, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getToday, getWeekRange } from "@/lib/date"
import { getFriendIds } from "@/lib/friend-ids"
import { computeStreak, type DayStats } from "@/lib/streak"
import { getPoints } from "@/app/actions/targets"
import { createNotification } from "@/app/actions/notifications"
import { getUserUnlocks, type Unlock } from "@/app/actions/achievements"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/** Send a friend invite by email. */
export async function inviteFriend(email: string): Promise<{ ok: boolean; message: string }> {
  const userId = await getUserId()
  const normalized = email.trim().toLowerCase()
  if (!normalized) return { ok: false, message: "Enter an email." }

  const [target] = await db.select().from(user).where(eq(user.email, normalized)).limit(1)
  if (!target) return { ok: false, message: "No user found with that email." }
  if (target.id === userId) return { ok: false, message: "You can't send a friend request to yourself." }

  // Already connected or pending in either direction?
  const [existing] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, target.id)),
        and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, userId)),
      ),
    )
    .limit(1)

  if (existing) {
    if (existing.status === "accepted") {
      return { ok: false, message: "You're already friends with this person." }
    }
    if (existing.requesterId === userId) {
      return { ok: false, message: "You've already sent a request to this person." }
    }
    return { ok: false, message: "This person already sent you a request — check your pending invites." }
  }

  const [[me], [friendship]] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, userId)),
    db
      .insert(friendships)
      .values({
        requesterId: userId,
        addresseeId: target.id,
        status: "pending",
      })
      .returning({ id: friendships.id }),
  ])
  await createNotification(target.id, "friend_request", `${me.name} sent you a friend request.`, friendship.id)
  revalidatePath("/friends")
  return { ok: true, message: `Invite sent to ${target.name}.` }
}

export async function respondToInvite(friendshipId: number, accept: boolean) {
  const userId = await getUserId()
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(
      and(eq(friendships.id, friendshipId), eq(friendships.addresseeId, userId), eq(friendships.status, "pending")),
    )
  if (!friendship) return

  if (accept) {
    const [[me]] = await Promise.all([
      db.select({ name: user.name }).from(user).where(eq(user.id, userId)),
      db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, friendshipId)),
    ])
    await createNotification(friendship.requesterId, "friend_accepted", `${me.name} accepted your friend request.`)
  } else {
    await db.delete(friendships).where(eq(friendships.id, friendshipId))
  }
  revalidatePath("/friends")
  revalidatePath("/")
}

/**
 * Accept or reject a friend request directly from its notification. Looks up
 * the friendship via the notification's `relatedId`, reuses `respondToInvite`
 * for the friendship side-effects, then removes the notification itself.
 */
export async function respondToFriendRequestNotification(notificationId: number, accept: boolean) {
  const userId = await getUserId()
  const [notification] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
  if (!notification || notification.type !== "friend_request" || notification.relatedId == null) return

  await respondToInvite(notification.relatedId, accept)
  await db.delete(notifications).where(eq(notifications.id, notificationId))
  revalidatePath("/notifications")
}

/** Pending invites that the current user has received. */
export async function getPendingInvites() {
  const userId = await getUserId()
  return db
    .select({
      id: friendships.id,
      name: user.name,
      email: user.email,
    })
    .from(friendships)
    .innerJoin(user, eq(user.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending")))
}

/** Friend requests the current user has sent that are still awaiting a response. */
export async function getPendingSentInvites() {
  const userId = await getUserId()
  return db
    .select({
      id: friendships.id,
      name: user.name,
      email: user.email,
    })
    .from(friendships)
    .innerJoin(user, eq(user.id, friendships.addresseeId))
    .where(and(eq(friendships.requesterId, userId), eq(friendships.status, "pending")))
}

/** Withdraw a friend request the current user sent. */
export async function cancelSentInvite(friendshipId: number) {
  const userId = await getUserId()
  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, friendshipId),
        eq(friendships.requesterId, userId),
        eq(friendships.status, "pending"),
      ),
    )
  revalidatePath("/friends")
}

/** Accepted friends of the current user. */
export async function getConnectedFriends() {
  const userId = await getUserId()
  const rows = await db
    .select({
      friendshipId: friendships.id,
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    )
  if (rows.length === 0) return []

  const friendIds = rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId))
  const users = await db
    .select({ id: user.id, name: user.name, emoji: user.emoji })
    .from(user)
    .where(inArray(user.id, friendIds))
  const userMap = new Map(users.map((u) => [u.id, u]))

  return rows.map((r) => {
    const friend = userMap.get(r.requesterId === userId ? r.addresseeId : r.requesterId)!
    return { friendshipId: r.friendshipId, userId: friend.id, name: friend.name, emoji: friend.emoji }
  })
}

/** Remove an accepted friendship. Either party may remove it, and either may send a new request later. */
export async function removeFriend(friendshipId: number) {
  const userId = await getUserId()
  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, friendshipId),
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    )
  revalidatePath("/friends")
  revalidatePath("/")
}

type LeaderboardRow = {
  userId: string
  name: string
  emoji: string
  points: number
  streak: number
  isMe: boolean
}

/**
 * Builds a per-user date -> DayStats map for the given user IDs: frozen
 * `daily_stats` rows for past days, plus today's stats computed live from
 * `targets` (daily_stats for today may be stale for friends who haven't
 * loaded their own dashboard yet today).
 */
async function getStatsByUser(allIds: string[], today: string) {
  const pastStatsRows = await db
    .select({
      userId: dailyStats.userId,
      date: dailyStats.date,
      totalTargets: dailyStats.totalTargets,
      completedTargets: dailyStats.completedTargets,
      allCompleted: dailyStats.allCompleted,
    })
    .from(dailyStats)
    .where(and(inArray(dailyStats.userId, allIds), lt(dailyStats.date, today)))

  const todayRows = await db
    .select({
      userId: targets.userId,
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${targets.completed})`,
    })
    .from(targets)
    .where(and(inArray(targets.userId, allIds), eq(targets.date, today)))
    .groupBy(targets.userId)

  const statsByUser = new Map<string, Map<string, DayStats>>()
  for (const row of pastStatsRows) {
    if (!statsByUser.has(row.userId)) statsByUser.set(row.userId, new Map())
    statsByUser.get(row.userId)!.set(row.date, {
      totalTargets: row.totalTargets,
      completedTargets: row.completedTargets,
      allCompleted: row.allCompleted,
    })
  }
  for (const row of todayRows) {
    const total = Number(row.total)
    const completed = Number(row.completed)
    if (!statsByUser.has(row.userId)) statsByUser.set(row.userId, new Map())
    statsByUser.get(row.userId)!.set(today, {
      totalTargets: total,
      completedTargets: completed,
      allCompleted: total > 0 && completed === total,
    })
  }
  return statsByUser
}

/** Leaderboard of the current user + accepted friends, sorted by points then streak. */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const userId = await getUserId()
  const today = await getToday()
  const friendIds = await getFriendIds(userId)
  const allIds = [userId, ...friendIds]

  const users = await db
    .select({ id: user.id, name: user.name, emoji: user.emoji })
    .from(user)
    .where(inArray(user.id, allIds))

  // Points per user (sum of completed target points)
  const pointsRows = await db
    .select({
      userId: targets.userId,
      points: sql<number>`coalesce(sum(${targets.points}), 0)`,
    })
    .from(targets)
    .where(and(inArray(targets.userId, allIds), eq(targets.completed, true)))
    .groupBy(targets.userId)
  const pointsMap = new Map(pointsRows.map((r) => [r.userId, Number(r.points)]))

  const statsByUser = await getStatsByUser(allIds, today)

  const rows: LeaderboardRow[] = users.map((u) => ({
    userId: u.id,
    name: u.name,
    emoji: u.emoji,
    points: pointsMap.get(u.id) ?? 0,
    streak: computeStreak(statsByUser.get(u.id) ?? new Map(), today),
    isMe: u.id === userId,
  }))

  rows.sort((a, b) => b.points - a.points || b.streak - a.streak)
  return rows
}

export type WeeklyLeaderboardRow = {
  userId: string
  name: string
  emoji: string
  weeklyPoints: number
  weeklyTasks: number
  isMe: boolean
}

/**
 * Leaderboard of the current user + accepted friends for the current Sun-Sat
 * week, sorted by points then tasks completed this week. Past days come from
 * `daily_stats`; today is computed live from `targets`.
 */
export async function getWeeklyLeaderboard(): Promise<WeeklyLeaderboardRow[]> {
  const userId = await getUserId()
  const today = await getToday()
  const { start: weekStart } = getWeekRange(today)
  const friendIds = await getFriendIds(userId)
  const allIds = [userId, ...friendIds]

  const [users, pastRows, todayRows] = await Promise.all([
    db.select({ id: user.id, name: user.name, emoji: user.emoji }).from(user).where(inArray(user.id, allIds)),
    db
      .select({
        userId: dailyStats.userId,
        pointsEarned: dailyStats.pointsEarned,
        completedTargets: dailyStats.completedTargets,
      })
      .from(dailyStats)
      .where(and(inArray(dailyStats.userId, allIds), gte(dailyStats.date, weekStart), lt(dailyStats.date, today))),
    db
      .select({
        userId: targets.userId,
        points: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
        tasks: sql<number>`count(*) filter (where ${targets.completed})`,
      })
      .from(targets)
      .where(and(inArray(targets.userId, allIds), eq(targets.date, today)))
      .groupBy(targets.userId),
  ])

  const totals = new Map<string, { points: number; tasks: number }>()
  for (const row of pastRows) {
    const cur = totals.get(row.userId) ?? { points: 0, tasks: 0 }
    cur.points += row.pointsEarned
    cur.tasks += row.completedTargets
    totals.set(row.userId, cur)
  }
  for (const row of todayRows) {
    const cur = totals.get(row.userId) ?? { points: 0, tasks: 0 }
    cur.points += Number(row.points)
    cur.tasks += Number(row.tasks)
    totals.set(row.userId, cur)
  }

  const rows: WeeklyLeaderboardRow[] = users.map((u) => {
    const t = totals.get(u.id) ?? { points: 0, tasks: 0 }
    return { userId: u.id, name: u.name, emoji: u.emoji, weeklyPoints: t.points, weeklyTasks: t.tasks, isMe: u.id === userId }
  })

  rows.sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.weeklyTasks - a.weeklyTasks)
  return rows
}

export type FriendProfile = {
  userId: string
  name: string
  emoji: string
  points: number
  streak: number
  longestStreak: number
  weeklyPoints: number
  dailyScore: number
  completionPercent: number
  todayTargets: { id: number; title: string; completed: boolean }[]
  topPillars: { pillarId: number; pillarName: string; pillarIcon: string; pillarColor: string; points: number }[]
  badges: Unlock[]
}

/**
 * Friend Profile panel data: emoji, name, lifetime points, current/longest
 * streak, weekly points, top pillars, badges, daily score, today's targets,
 * and today's progress. Only the current user's own data or an accepted
 * friend's data may be viewed - per the privacy rules, history beyond today
 * is never exposed here.
 */
export async function getFriendProfile(targetUserId: string): Promise<FriendProfile> {
  const userId = await getUserId()
  if (targetUserId !== userId) {
    const friendIds = await getFriendIds(userId)
    if (!friendIds.includes(targetUserId)) throw new Error("You're not friends with this user.")
  }

  const today = await getToday()
  const { start: weekStart, end: weekEndInclusive } = getWeekRange(today)
  const [[targetUser], points, todayTargetsRows, statsByUser, weeklyPointsRow, topPillarRows, badges] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, emoji: user.emoji, bestStreak: user.bestStreak })
      .from(user)
      .where(eq(user.id, targetUserId)),
    getPoints(targetUserId),
    db
      .select({ id: targets.id, title: targets.title, completed: targets.completed, points: targets.points })
      .from(targets)
      .where(and(eq(targets.userId, targetUserId), eq(targets.date, today)))
      .orderBy(asc(targets.sortOrder), asc(targets.id)),
    getStatsByUser([targetUserId], today),
    db
      .select({ total: sql<number>`coalesce(sum(${targets.points}), 0)` })
      .from(targets)
      .where(
        and(
          eq(targets.userId, targetUserId),
          eq(targets.completed, true),
          gte(targets.originalDate, weekStart),
          sql`${targets.originalDate} <= ${weekEndInclusive}`
        )
      ),
    db
      .select({
        pillarId: targets.pillarId,
        pillarName: pillars.name,
        pillarIcon: pillars.icon,
        pillarColor: pillars.color,
        points: sql<number>`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`,
      })
      .from(targets)
      .innerJoin(pillars, eq(targets.pillarId, pillars.id))
      .where(eq(targets.userId, targetUserId))
      .groupBy(targets.pillarId, pillars.name, pillars.icon, pillars.color)
      .orderBy(desc(sql`coalesce(sum(${targets.points}) filter (where ${targets.completed}), 0)`))
      .limit(3),
    getUserUnlocks(targetUserId),
  ])

  const total = todayTargetsRows.length
  const completed = todayTargetsRows.filter((t) => t.completed).length
  const pointsEarnedToday = todayTargetsRows.filter((t) => t.completed).reduce((sum, t) => sum + t.points, 0)
  const streak = computeStreak(statsByUser.get(targetUserId) ?? new Map(), today)

  return {
    userId: targetUser.id,
    name: targetUser.name,
    emoji: targetUser.emoji,
    points,
    streak,
    longestStreak: Math.max(targetUser.bestStreak, streak),
    weeklyPoints: Number(weeklyPointsRow[0]?.total ?? 0),
    dailyScore: total > 0 ? pointsEarnedToday / total : 0,
    completionPercent: total > 0 ? completed / total : 0,
    todayTargets: todayTargetsRows.map(({ id, title, completed }) => ({ id, title, completed })),
    topPillars: topPillarRows
      .filter((p) => Number(p.points) > 0)
      .map((p) => ({ pillarId: p.pillarId, pillarName: p.pillarName, pillarIcon: p.pillarIcon, pillarColor: p.pillarColor, points: Number(p.points) })),
    badges: badges.filter((b) => b.kind === "badge"),
  }
}
