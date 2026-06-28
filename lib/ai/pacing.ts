// lib/ai/pacing.ts
//
// Replaces the naive `perSession = ceil(total / occurrences)` in the assistant
// agent with one that accounts for the user's historical task-completion rate
// for the relevant pillar.  If someone completes ~70% of their DSA tasks, we
// need ceil(total / (occurrences * 0.7)) per session so they still hit the
// goal even with normal slip.
//
// The completion rate is fetched from the DB by the server action and passed
// in as a plain number so this file stays pure and testable.

export interface PacingInput {
  targetValue: number           // e.g. 50 questions
  occurrences: number           // sessions available before deadline
  pillarCompletionRate: number  // 0-1, e.g. 0.72 from historical data
}

export interface PacingResult {
  perSession: number            // recommended units per session
  adjustedOccurrences: number   // effective occurrences after rate discount
  rateUsed: number              // completion rate that was applied
  wasAdjusted: boolean          // true when rate < 1 meaningfully changed output
}

/** Minimum meaningful completion rate we'll trust from sparse history. */
const MIN_RATE = 0.5
/** If the rate is above this we treat it as ~perfect and skip adjustment. */
const SKIP_ADJUSTMENT_THRESHOLD = 0.95

export function computePacing(input: PacingInput): PacingResult {
  const { targetValue, occurrences } = input
  const rate = Math.max(MIN_RATE, Math.min(1, input.pillarCompletionRate))

  const shouldAdjust = rate < SKIP_ADJUSTMENT_THRESHOLD && occurrences > 0
  const effectiveOccurrences = shouldAdjust
    ? Math.floor(occurrences * rate)
    : occurrences

  const safeOccurrences = Math.max(1, effectiveOccurrences)
  const perSession = Math.max(1, Math.ceil(targetValue / safeOccurrences))

  return {
    perSession,
    adjustedOccurrences: safeOccurrences,
    rateUsed: rate,
    wasAdjusted: shouldAdjust,
  }
}

/**
 * Fetches a pillar's historical task-completion rate from the last 60 days.
 * Returns 1.0 (perfect rate / no adjustment) when data is too sparse to trust.
 *
 * This is a pure DB query — no side effects — safe to call from any server
 * action or agent.
 */
export async function getPillarCompletionRate(
  db: import("@/lib/db").DbType,
  userId: string,
  pillarId: number | null
): Promise<number> {
  if (!pillarId) return 1.0

  const { targets } = await import("@/lib/db/schema")
  const { and, eq, gte, sql } = await import("drizzle-orm")

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${targets.completed})`,
    })
    .from(targets)
    .where(
      and(
        eq(targets.userId, userId),
        eq(targets.pillarId, pillarId),
        gte(targets.originalDate, sixtyDaysAgo)
      )
    )

  const total = Number(row?.total ?? 0)
  const done = Number(row?.completed ?? 0)

  // Sparse data (< 5 tasks): don't adjust — not enough signal.
  if (total < 5) return 1.0
  return done / total
}
