import { redirect } from "next/navigation"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { getLongTermGoals, getPillarGoals, checkGoalReminders } from "@/app/actions/goals"
import { getPillars } from "@/app/actions/pillars"
import { GoalsBoard } from "@/components/goals-board"
import { AppShell } from "@/components/app-shell"
import { getToday } from "@/lib/date"

export default async function GoalsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  await checkGoalReminders()

  const today = await getToday()
  const [pillarGoals, longTermGoals, activePillars, allPillars] = await Promise.all([
    getPillarGoals(),
    getLongTermGoals(),
    getPillars(),
    getPillars(true),
  ])

  return (
    <AppShell active="/goals" title="Goals" subtitle="Set targets for your pillars and track long-term progress.">
      <GoalsBoard
        initialPillarGoals={pillarGoals}
        initialLongTermGoals={longTermGoals}
        initialActivePillars={activePillars}
        initialAllPillars={allPillars}
        today={today}
      />
    </AppShell>
  )
}
