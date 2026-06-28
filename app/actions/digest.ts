"use server"

import { and, eq, sql } from "drizzle-orm"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { longTermGoals, pillars, targets } from "@/lib/db/schema"
import { getToday } from "@/lib/date"
import { getBalanceScore, getNeglectedPillars } from "@/app/actions/reflection"
import { getMyStats } from "@/app/actions/targets"
import { getDailyDigest, type DigestInput } from "@/lib/ai/digest"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/**
 * Assembles the full DigestInput from live DB data and calls the AI generator.
 * Called server-side on dashboard load. Returns an empty string on any failure
 * so the dashboard never shows an error state for this feature.
 */
export async function getDashboardDigest(): Promise<string> {
  try {
    const userId = await getUserId()
    const today = await getToday()

    const [stats, neglected, balanceScore, activeGoals] = await Promise.all([
      getMyStats(),
      getNeglectedPillars().catch(() => []),
      getBalanceScore().catch(() => null),
      db
        .select({
          title: longTermGoals.title,
          pillarName: pillars.name,
          targetValue: longTermGoals.targetValue,
          deadline: longTermGoals.deadline,
          createdAt: longTermGoals.createdAt,
        })
        .from(longTermGoals)
        .innerJoin(pillars, eq(longTermGoals.pillarId, pillars.id))
        .where(and(eq(longTermGoals.userId, userId), eq(longTermGoals.completed, false)))
        .limit(8),
    ])

    // Today's task counts
    const [todayRow] = await db
      .select({
        total: sql<number>`count(*)`,
        done: sql<number>`count(*) filter (where ${targets.completed})`,
      })
      .from(targets)
      .where(and(eq(targets.userId, userId), eq(targets.date, today)))

    const todayTargetCount = Number(todayRow?.total ?? 0)
    const completedToday = Number(todayRow?.done ?? 0)

    // Progress for each active long-term goal
    const goalSummaries = await Promise.all(
      activeGoals.map(async (g) => {
        const created = g.createdAt.toISOString().slice(0, 10)
        const [row] = await db
          .select({ done: sql<number>`coalesce(sum(${targets.quantity}) filter (where ${targets.completed}), 0)` })
          .from(targets)
          .where(and(eq(targets.userId, userId)))

        const done = Number(row?.done ?? 0)
        const progressPercent = Math.min(100, Math.round((done / Math.max(1, g.targetValue)) * 100))

        const [dy, dm, dd] = g.deadline.split("-").map(Number)
        const [ty, tm, td] = today.split("-").map(Number)
        const daysUntilDeadline = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 864e5)

        return { title: g.title, progress: progressPercent, daysUntilDeadline }
      })
    )

    const input: DigestInput = {
      today,
      todayTargetCount,
      completedToday,
      streak: stats.streak,
      neglectedPillars: neglected.map((n) => ({
        pillarName: n.pillarName,
        daysSinceLastActivity: n.daysSinceLastActivity,
      })),
      longTermGoals: goalSummaries,
      balanceScore,
    }

    return getDailyDigest(input)
  } catch {
    return ""
  }
}
