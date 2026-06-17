import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  getPendingInvites,
  getPendingSentInvites,
  getConnectedFriends,
  getLeaderboard,
  getWeeklyLeaderboard,
} from "@/app/actions/friends"
import { getChallenges } from "@/app/actions/challenges"
import { getPillars } from "@/app/actions/pillars"
import { FriendManager } from "@/components/friend-manager"
import { Leaderboard } from "@/components/leaderboard"
import { WeeklyLeaderboard } from "@/components/weekly-leaderboard"
import { ChallengesCard } from "@/components/challenges-card"
import { AppShell } from "@/components/app-shell"

export default async function FriendsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const [pendingInvites, pendingSent, connectedFriends, leaderboard, weeklyLeaderboard, challenges, pillars] = await Promise.all([
    getPendingInvites(),
    getPendingSentInvites(),
    getConnectedFriends(),
    getLeaderboard(),
    getWeeklyLeaderboard(),
    getChallenges(),
    getPillars(),
  ])

  return (
    <AppShell active="/friends" title="Friends">
      <div className="flex flex-col gap-6">
        <FriendManager
          pendingInvites={pendingInvites}
          pendingSent={pendingSent}
          connectedFriends={connectedFriends}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <Leaderboard rows={leaderboard} title="Standings" />
          <WeeklyLeaderboard rows={weeklyLeaderboard} />
        </div>
        <ChallengesCard initialChallenges={challenges} pillars={pillars} />
      </div>
    </AppShell>
  )
}
