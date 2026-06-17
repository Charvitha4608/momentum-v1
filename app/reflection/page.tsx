import { redirect } from "next/navigation"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import {
  generateMissingWeeklyReviews,
  getBalanceScore,
  getEffortComparison,
  getNeglectedPillars,
  getWeeklyBreakdown,
  getWeeklyReviews,
} from "@/app/actions/reflection"
import { AppShell } from "@/components/app-shell"
import { BalanceScoreCard } from "@/components/balance-score-card"
import { EffortComparisonCard } from "@/components/effort-comparison-card"
import { NeglectedPillarsCard } from "@/components/neglected-pillars-card"
import { WeeklyBreakdownCard } from "@/components/weekly-breakdown-card"
import { WeeklyReviewList } from "@/components/weekly-review-list"

export default async function ReflectionPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  await generateMissingWeeklyReviews()

  const [balanceScore, effort, breakdown, neglected, reviews] = await Promise.all([
    getBalanceScore(),
    getEffortComparison(),
    getWeeklyBreakdown(),
    getNeglectedPillars(),
    getWeeklyReviews(),
  ])

  return (
    <AppShell active="/reflection" title="Reflection" subtitle="Understand where your effort is really going.">
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <BalanceScoreCard score={balanceScore} />
          <NeglectedPillarsCard pillars={neglected} />
        </div>
        <EffortComparisonCard rows={effort} />
        <WeeklyBreakdownCard data={breakdown} />
        <WeeklyReviewList reviews={reviews} />
      </div>
    </AppShell>
  )
}
