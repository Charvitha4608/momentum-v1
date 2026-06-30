import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { auth } from "@/lib/auth"
import { getMonthStats, getMonthPillarFullStats, getWeekTargets, getCurrentStreak } from "@/app/actions/history"
import { getPillars } from "@/app/actions/pillars"
import { HistoryCalendar } from "@/components/history-calendar"
import { CalendarPillarsView } from "@/components/calendar-pillars-view"
import { CalendarWeekView } from "@/components/calendar-week-view"
import { CalendarViewSwitcher, type CalendarView } from "@/components/calendar-view-switcher"
import { WeeklyScoreCard } from "@/components/weekly-score-card"
import { AppShell } from "@/components/app-shell"
import { AiPlanner } from "@/components/ai-planner"
import { getWeekSchedule } from "@/app/actions/planner"
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
  const view: CalendarView =
    params.view === "pillars" || params.view === "week" || params.view === "planner" ? params.view : "month"

  if (view === "planner") {
    const { days: weekDays, items } = await getWeekSchedule(params.week ?? today)
    return (
      <AppShell active="/calendar" title="AI Planner" subtitle="Let AI shape your week around your time">
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <CalendarViewSwitcher view={view} />
          </div>
          <AiPlanner initialDays={weekDays} initialItems={items} today={today} />
        </div>
      </AppShell>
    )
  }

  if (view === "week") {
    const [weekDays, streak] = await Promise.all([
      getWeekTargets(params.week ?? today),
      getCurrentStreak(),
    ])
    return (
      <AppShell active="/calendar" title="Calendar">
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <CalendarViewSwitcher view={view} />
          </div>
          <CalendarWeekView days={weekDays} weekDate={params.week ?? today} today={today} streak={streak} />
        </div>
      </AppShell>
    )
  }

  if (view === "pillars") {
    const pillarStats = await getMonthPillarFullStats(year, month)

    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear -= 1
    }
    let nextYear = year
    let nextMonth = month + 1
    if (nextMonth === 13) {
      nextMonth = 1
      nextYear += 1
    }
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })

    return (
      <AppShell active="/calendar" title="Calendar">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-center">
            <CalendarViewSwitcher view={view} />
            <div className="static flex items-center justify-center gap-1 md:absolute md:right-0">
              <Link
                href={`/calendar?year=${prevYear}&month=${prevMonth}&view=pillars`}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </Link>
              <span className="min-w-[8rem] text-center text-sm font-semibold">{monthLabel}</span>
              <Link
                href={`/calendar?year=${nextYear}&month=${nextMonth}&view=pillars`}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
          <CalendarPillarsView pillars={pillarStats} />
        </div>
      </AppShell>
    )
  }

  const [days, pillarOptions] = await Promise.all([getMonthStats(year, month), getPillars()])
  return (
    <AppShell active="/calendar" title="Calendar">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 md:max-w-4xl">
        <div className="flex justify-center">
          <CalendarViewSwitcher view={view} />
        </div>
        <div className="grid items-start gap-6 md:grid-cols-2">
          <HistoryCalendar year={year} month={month} days={days} today={today} pillars={pillarOptions} />
          <WeeklyScoreCard year={year} month={month} days={days} today={today} />
        </div>
      </div>
    </AppShell>
  )
}
