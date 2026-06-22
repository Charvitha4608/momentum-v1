import { redirect } from "next/navigation"
import Link from "next/link"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getTodayTargets, getMyStats } from "@/app/actions/targets"
import { getPillars } from "@/app/actions/pillars"
import { getLeaderboard } from "@/app/actions/friends"
import { getTodayAvailability } from "@/app/actions/availability"
import { checkAndUnlockAchievements } from "@/app/actions/achievements"
import { TargetList } from "@/components/target-list"
import { StatCard } from "@/components/stat-card"
import { TodayProgressCard } from "@/components/today-progress-card"
import { Leaderboard } from "@/components/leaderboard"
import { BacklogCard } from "@/components/backlog-card"
import { AvailabilityQuickEdit } from "@/components/availability-quick-edit"
import { AppShell } from "@/components/app-shell"
import { Card } from "@/components/ui/card"
import { Sparkles } from "lucide-react"
import { getToday } from "@/lib/date"

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const today = await getToday()
  const [targets, stats, leaderboard, pillars, availability] = await Promise.all([
    getTodayTargets(today),
    getMyStats(),
    getLeaderboard(),
    getPillars(),
    getTodayAvailability(),
  ])

  // Carry-over already moved every unfinished past target's `date` to today,
  // so split on the immutable `originalDate`: targets created today vs.
  // still-incomplete targets carried over from earlier days (the backlog).
  const todayTargets = targets.filter((t) => t.originalDate === today)
  const backlogItems = targets.filter((t) => t.originalDate !== today && !t.completed)

  return (
    <AppShell active="/" subtitle={`Hey ${session.user.name}, crush today's targets.`}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <StatCard label="Day streak" value={stats.streak} variant="streak" />
        <StatCard label="Total points" value={stats.points} variant="points" />
        <TodayProgressCard
          completed={stats.completedTargets}
          total={stats.totalTargets}
          dailyScore={stats.dailyScore}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TargetList initialTargets={todayTargets} date={today} pillars={pillars} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Card className="gap-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <p className="font-medium text-card-foreground">AI Planner</p>
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
            <Link
              href="/calendar?view=planner"
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Sparkles className="size-4" />
              Plan my week
            </Link>
          </Card>
          <Leaderboard rows={leaderboard} title="Leaderboard" />
          <BacklogCard initialItems={backlogItems} today={today} />
        </div>
      </div>
    </AppShell>
  )
}
