"use server"

import { and, asc, eq, gte, inArray, sql } from "drizzle-orm"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { dailyStats, longTermGoals, pillars, recurringTasks, targets, user, userUnlocks } from "@/lib/db/schema"
import { getToday, shiftDateString } from "@/lib/date"
import { buildStatsMap, computeStreak } from "@/lib/streak"
import { isDueOn } from "@/lib/recurring"
import { upsertDailyStats } from "@/app/actions/targets"
import { getLongTermGoals, getPillarGoals } from "@/app/actions/goals"
import { getNeglectedPillars } from "@/app/actions/reflection"
import {
  FIXED_UNLOCKS,
  getNewlyMetUnlocks,
  longTermGoalUnlock,
  pillarGoalUnlock,
  pillarMasterUnlock,
  type AchievementContext,
  type UnlockDef,
} from "@/lib/achievements"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/** Count of Sun-Sat weeks where every day had `totalTargets > 0 && allCompleted`. */
async function getPerfectWeekCount(userId: string): Promise<number> {
  const rows = await db
    .select({ weekStart: sql<string>`date_trunc('week', (${dailyStats.date}::date) + interval '1 day')` })
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), sql`${dailyStats.totalTargets} > 0`, eq(dailyStats.allCompleted, true)))
    .groupBy(sql`date_trunc('week', (${dailyStats.date}::date) + interval '1 day')`)
    .having(sql`count(*) = 7`)

  return rows.length
}

/**
 * True if at least one recurring task (active for the full last 30 days) had
 * a completed target for every day it was due in that window.
 */
async function getRecurringCompliance30(userId: string, today: string): Promise<boolean> {
  const windowStart = shiftDateString(today, -29)

  const activeRecurring = await db
    .select()
    .from(recurringTasks)
    .where(and(eq(recurringTasks.userId, userId), eq(recurringTasks.active, true)))

  const eligible = activeRecurring.filter((t) => t.anchorDate <= windowStart)
  if (eligible.length === 0) return false

  const completedRows = await db
    .select({ recurringTaskId: targets.recurringTaskId, originalDate: targets.originalDate })
    .from(targets)
    .where(
      and(
        eq(targets.userId, userId),
        eq(targets.completed, true),
        inArray(
          targets.recurringTaskId,
          eligible.map((t) => t.id)
        ),
        gte(targets.originalDate, windowStart)
      )
    )
  const completedSet = new Set(completedRows.map((r) => `${r.recurringTaskId}_${r.originalDate}`))

  for (const task of eligible) {
    let dueCount = 0
    let allDue = true
    for (let d = windowStart; d <= today; d = shiftDateString(d, 1)) {
      if (!isDueOn(task, d)) continue
      dueCount++
      if (!completedSet.has(`${task.id}_${d}`)) {
        allDue = false
        break
      }
    }
    if (dueCount > 0 && allDue) return true
  }
  return false
}

/**
 * Checks the current user's stats against the achievement/badge catalog and
 * inserts any newly-met `userUnlocks` rows. Cheap and idempotent - safe to
 * call on every dashboard load.
 */
export async function checkAndUnlockAchievements(): Promise<void> {
  const userId = await getUserId()
  const today = await getToday()

  await upsertDailyStats(userId, today)

  const [statsRows, [me], perfectWeekCount, recurringCompliance30, pillarGoalsList, longTermGoalsList, neglected, allPillars, completedRows, existing] =
    await Promise.all([
      db
        .select({
          date: dailyStats.date,
          totalTargets: dailyStats.totalTargets,
          completedTargets: dailyStats.completedTargets,
          allCompleted: dailyStats.allCompleted,
        })
        .from(dailyStats)
        .where(eq(dailyStats.userId, userId)),
      db.select({ bestStreak: user.bestStreak }).from(user).where(eq(user.id, userId)),
      getPerfectWeekCount(userId),
      getRecurringCompliance30(userId, today),
      getPillarGoals(),
      getLongTermGoals(),
      getNeglectedPillars(),
      db.select({ id: pillars.id, name: pillars.name, icon: pillars.icon }).from(pillars).where(eq(pillars.userId, userId)),
      db
        .select({ pillarId: targets.pillarId, count: sql<number>`count(*)` })
        .from(targets)
        .where(and(eq(targets.userId, userId), eq(targets.completed, true)))
        .groupBy(targets.pillarId),
      db.select({ key: userUnlocks.key }).from(userUnlocks).where(eq(userUnlocks.userId, userId)),
    ])

  const currentStreak = computeStreak(buildStatsMap(statsRows), today)
  const completedMap = new Map(completedRows.map((r) => [r.pillarId, Number(r.count)]))

  const ctx: AchievementContext = {
    bestStreak: Math.max(me.bestStreak, currentStreak),
    currentStreak,
    perfectWeekCount,
    pillars: allPillars.map((p) => ({ id: p.id, name: p.name, icon: p.icon, completedCount: completedMap.get(p.id) ?? 0 })),
    metPillarGoals: pillarGoalsList
      .filter((g) => g.progress >= 100)
      .map((g) => ({ pillarId: g.pillarId, pillarName: g.pillarName, pillarIcon: g.pillarIcon })),
    allPillarGoalsMetThisMonth: pillarGoalsList.length > 0 && pillarGoalsList.every((g) => g.progress >= 100),
    completedLongTermGoals: longTermGoalsList.filter((g) => g.completed).map((g) => ({ id: g.id, title: g.title })),
    recurringCompliance30,
    neglectedPillarCount: neglected.length,
  }

  const existingKeys = new Set(existing.map((r) => r.key))
  const toInsert = getNewlyMetUnlocks(ctx).filter((u) => !existingKeys.has(u.key))
  if (toInsert.length === 0) return

  await db
    .insert(userUnlocks)
    .values(toInsert.map((u) => ({ userId, key: u.key, kind: u.kind })))
    .onConflictDoNothing()
}

export type Unlock = UnlockDef & { unlockedAt: string }

/** All unlocked achievements/badges for a user, with full label/description/icon. */
export async function getUserUnlocks(targetUserId: string): Promise<Unlock[]> {
  const rows = await db
    .select()
    .from(userUnlocks)
    .where(eq(userUnlocks.userId, targetUserId))
    .orderBy(asc(userUnlocks.unlockedAt))

  if (rows.length === 0) return []

  const pillarIds = new Set<number>()
  const goalIds = new Set<number>()
  for (const r of rows) {
    const pillarMatch = r.key.match(/^pillar_(?:master|goal)_(\d+)$/)
    const goalMatch = r.key.match(/^long_term_goal_(\d+)$/)
    if (pillarMatch) pillarIds.add(Number(pillarMatch[1]))
    if (goalMatch) goalIds.add(Number(goalMatch[1]))
  }

  const [pillarRows, goalRows] = await Promise.all([
    pillarIds.size > 0
      ? db
          .select({ id: pillars.id, name: pillars.name, icon: pillars.icon })
          .from(pillars)
          .where(inArray(pillars.id, [...pillarIds]))
      : Promise.resolve([] as { id: number; name: string; icon: string }[]),
    goalIds.size > 0
      ? db
          .select({ id: longTermGoals.id, title: longTermGoals.title })
          .from(longTermGoals)
          .where(inArray(longTermGoals.id, [...goalIds]))
      : Promise.resolve([] as { id: number; title: string }[]),
  ])
  const pillarMap = new Map(pillarRows.map((p) => [p.id, p]))
  const goalMap = new Map(goalRows.map((g) => [g.id, g]))
  const fixedMap = new Map(FIXED_UNLOCKS.map((u) => [u.key, u]))

  const result: Unlock[] = []
  for (const r of rows) {
    let def: UnlockDef | undefined = fixedMap.get(r.key)
    if (!def) {
      const masterMatch = r.key.match(/^pillar_master_(\d+)$/)
      const goalMatch = r.key.match(/^pillar_goal_(\d+)$/)
      const longTermMatch = r.key.match(/^long_term_goal_(\d+)$/)
      if (masterMatch) {
        const pillar = pillarMap.get(Number(masterMatch[1]))
        if (pillar) def = pillarMasterUnlock(pillar)
      } else if (goalMatch) {
        const pillar = pillarMap.get(Number(goalMatch[1]))
        if (pillar) def = pillarGoalUnlock(pillar)
      } else if (longTermMatch) {
        const goal = goalMap.get(Number(longTermMatch[1]))
        if (goal) def = longTermGoalUnlock(goal)
      }
    }
    if (def) result.push({ ...def, unlockedAt: r.unlockedAt.toISOString().slice(0, 10) })
  }
  return result
}

export type BadgeCatalogEntry = UnlockDef & { unlocked: boolean; unlockedAt: string | null }

/**
 * The full badge catalog for a user (fixed badges + a "{icon} {Name} Master"
 * entry per pillar), each marked unlocked/locked. Powers the Profile page's
 * badges grid.
 */
export async function getBadgeCatalog(targetUserId: string): Promise<BadgeCatalogEntry[]> {
  const [userPillars, unlocked] = await Promise.all([
    db.select({ id: pillars.id, name: pillars.name, icon: pillars.icon }).from(pillars).where(eq(pillars.userId, targetUserId)),
    getUserUnlocks(targetUserId),
  ])

  const unlockedMap = new Map(unlocked.map((u) => [u.key, u.unlockedAt]))

  const catalog: UnlockDef[] = [
    ...FIXED_UNLOCKS.filter((u) => u.kind === "badge").map(({ key, kind, label, description, icon }) => ({ key, kind, label, description, icon })),
    ...userPillars.map((p) => pillarMasterUnlock(p)),
  ]

  return catalog.map((def) => ({
    ...def,
    unlocked: unlockedMap.has(def.key),
    unlockedAt: unlockedMap.get(def.key) ?? null,
  }))
}
