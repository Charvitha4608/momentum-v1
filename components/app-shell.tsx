import Link from "next/link"
import { Target } from "lucide-react"

import { getUnreadCount } from "@/app/actions/notifications"
import { getPillars } from "@/app/actions/pillars"
import { BottomTabBar } from "@/components/bottom-tab-bar"
import { CommandBar } from "@/components/command-bar"
import { PageTransition } from "@/components/page-transition"
import { SignOutButton } from "@/components/sign-out-button"
import { Sidebar } from "@/components/sidebar"
import type { ActivePath } from "@/lib/nav-items"
import { TimezoneSync } from "@/components/timezone-sync"

export async function AppShell({
  active,
  title,
  subtitle,
  children,
}: {
  active: ActivePath
  title?: string
  subtitle?: string
  children: React.ReactNode
}) {
  const [unreadCount, pillars] = await Promise.all([getUnreadCount(), getPillars()])

  return (
    <div className="flex min-h-dvh bg-background">
      <TimezoneSync />
      <CommandBar pillars={pillars} />
      <Sidebar active={active} unreadCount={unreadCount} />

      <div className="flex min-h-dvh flex-1 flex-col">
        {/* Mobile-only top bar: section nav lives in the sidebar (desktop) and bottom tab bar (mobile) */}
        <header className="border-b border-border md:hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Target className="size-4" />
              </span>
              <span>Momentum</span>
            </Link>
            <SignOutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-24 sm:px-6 sm:py-10 md:px-8 md:pb-10">
          {(title || subtitle) && (
            <div className="mb-6">
              {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          <PageTransition>{children}</PageTransition>
        </main>

        <BottomTabBar active={active} unreadCount={unreadCount} />
      </div>
    </div>
  )
}
