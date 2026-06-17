import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getMonthStats, getMonthPillarFullStats, getWeekTargets, getCurrentStreak } from "@/app/actions/history"
import { HistoryCalendar } from "@/components/history-calendar"
import { CalendarPillarsView } from "@/components/calendar-pillars-view"
import { CalendarWeekView } from "@/components/calendar-week-view"
import { CalendarViewSwitcher, type CalendarView } from "@/components/calendar-view-switcher"
import { WeeklyScoreCard } from "@/components/weekly-score-card"
import { AppShell } from "@/components/app-shell"
import { getToday } from "@/lib/date"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; view?: string; week?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const params = await searchParams
  const today = await getToday()
  const [todayYear, todayMonth] = today.split("-").map(Number)
  const year = params.year ? Number(params.year) : todayYear
  const month = params.month ? Number(params.month) : todayMonth
  const view: CalendarView = params.view === "pillars" || params.view === "week" ? params.view : "month"

  if (view === "week") {
    const [weekDays, streak] = await Promise.all([
      getWeekTargets(params.week ?? today),
      getCurrentStreak(),
    ])
    return (
      <AppShell active="/calendar" title="Calendar">
        <div className="flex flex-col gap-4">
          <CalendarViewSwitcher view={view} />
          <CalendarWeekView days={weekDays} weekDate={params.week ?? today} today={today} streak={streak} />
        </div>
      </AppShell>
    )
  }

  if (view === "pillars") {
    const pillarStats = await getMonthPillarFullStats(year, month)
    return (
      <AppShell active="/calendar" title="Calendar">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <CalendarViewSwitcher view={view} />
          <CalendarPillarsView year={year} month={month} pillars={pillarStats} today={today} />
        </div>
      </AppShell>
    )
  }

  const days = await getMonthStats(year, month)
  return (
    <AppShell active="/calendar" title="Calendar">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <CalendarViewSwitcher view={view} />
        <HistoryCalendar year={year} month={month} days={days} today={today} />
        <WeeklyScoreCard year={year} month={month} days={days} />
      </div>
    </AppShell>
  )
}
