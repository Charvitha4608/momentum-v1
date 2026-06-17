import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getTodayTargets, getMyStats } from "@/app/actions/targets"
import { getPillars } from "@/app/actions/pillars"
import { getLeaderboard } from "@/app/actions/friends"
import { checkAndUnlockAchievements } from "@/app/actions/achievements"
import { TargetList } from "@/components/target-list"
import { StatCard } from "@/components/stat-card"
import { TodayProgressCard } from "@/components/today-progress-card"
import { Leaderboard } from "@/components/leaderboard"
import { BacklogCard } from "@/components/backlog-card"
import { AppShell } from "@/components/app-shell"
import { getToday } from "@/lib/date"

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const today = await getToday()
  const [targets, stats, leaderboard, pillars] = await Promise.all([
    getTodayTargets(today),
    getMyStats(),
    getLeaderboard(),
    getPillars(),
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
          <Leaderboard rows={leaderboard} title="Leaderboard" />
          <BacklogCard initialItems={backlogItems} today={today} />
        </div>
      </div>
    </AppShell>
  )
}
