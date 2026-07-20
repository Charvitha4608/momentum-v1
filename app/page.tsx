import { redirect } from "next/navigation"
import Link from "next/link"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getTodayTargets, getMyStats, getUpcomingTargets } from "@/app/actions/targets"
import { getPillars } from "@/app/actions/pillars"
import { getActiveLongTermGoals } from "@/app/actions/goals"
import { getLeaderboard } from "@/app/actions/friends"
import { getTodayAvailability } from "@/app/actions/availability"
import { checkAndUnlockAchievements } from "@/app/actions/achievements"
import { getDashboardDigest } from "@/app/actions/digest"
import { TargetList } from "@/components/target-list"
import { StatCard } from "@/components/stat-card"
import { TodayProgressCard } from "@/components/today-progress-card"
import { Leaderboard } from "@/components/leaderboard"
import { BacklogCard } from "@/components/backlog-card"
import { GetAheadCard } from "@/components/get-ahead-card"
import { AvailabilityQuickEdit } from "@/components/availability-quick-edit"
import { AppShell } from "@/components/app-shell"
import { Sparkles, Zap } from "lucide-react"
import { getToday } from "@/lib/date"

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const today = await getToday()
  const [targets, stats, leaderboard, pillars, availability, longTermGoals, digest, upcoming] = await Promise.all([
    getTodayTargets(today),
    getMyStats(),
    getLeaderboard(),
    getPillars(),
    getTodayAvailability(),
    getActiveLongTermGoals(),
    getDashboardDigest(),
    getUpcomingTargets(today),
  ])

  // Carry-over already moved every unfinished past target's `date` to today,
  // so split on the immutable `originalDate`: targets created today vs.
  // still-incomplete targets carried over from earlier days (the backlog).
  const todayTargets = targets.filter((t) => t.originalDate === today)
  const backlogItems = targets.filter((t) => t.originalDate !== today && !t.completed)

  return (
    <AppShell active="/" subtitle={`Hey ${session.user.name}, crush today's targets.`}>
      {/* AI Daily Digest — ambient one-line briefing */}
      {digest && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-muted-foreground">
          <Zap className="size-3.5 shrink-0 text-primary" />
          <span>{digest}</span>
        </div>
      )}
      <div className="grid min-w-0 gap-6 overflow-x-hidden lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Day streak" value={stats.streak} variant="streak" />
            <StatCard label="Total points" value={stats.points} variant="points" />
          </div>
          <TodayProgressCard
            completed={stats.completedTargets}
            total={stats.totalTargets}
            dailyScore={stats.dailyScore}
          />
          <TargetList initialTargets={todayTargets} date={today} pillars={pillars} longTermGoals={longTermGoals} />
          <GetAheadCard items={upcoming} today={today} />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          {/* AI Planner: accent-gradient glow card */}
          <div className="ai-glow-card rounded-card p-4">
            <div className="relative z-[1] flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-[0_4px_14px_-3px_rgba(109,93,255,0.6)]">
                    <Sparkles className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-card-foreground">AI Planner</p>
                    <p className="text-xs text-muted-foreground">
                      {availability.hours}h free today
                      {availability.hasOverride ? " (adjusted)" : ""}
                    </p>
                  </div>
                </div>
                <AvailabilityQuickEdit
                  date={availability.date}
                  hours={availability.hours}
                  hasOverride={availability.hasOverride}
                />
              </div>
              <p className="text-[13px] text-muted-foreground">
                Fits your open tasks into the time you actually have this week.
              </p>
              <Link
                href="/calendar?view=planner"
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-control bg-brand-gradient text-sm font-medium text-white shadow-[0_6px_18px_-6px_rgba(109,93,255,0.6)] transition hover:brightness-110"
              >
                <Sparkles className="size-4" />
                Plan my week
              </Link>
            </div>
          </div>
          <Leaderboard rows={leaderboard} title="Leaderboard" />
          <BacklogCard initialItems={backlogItems} today={today} />
        </div>
      </div>
    </AppShell>
  )
}
