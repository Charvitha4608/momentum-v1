"use client"

import Link from "next/link"
import { Bell } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Notifications entry point. Lives outside the main nav list: rendered as a
 * compact icon button in the mobile top bar (`variant="bar"`) and as a footer
 * row near the account area in the desktop sidebar (`variant="sidebar"`).
 * Shows a dot when there are unread notifications.
 */
export function NotificationBell({
  unreadCount,
  active = false,
  variant = "bar",
  collapsed = false,
  className,
}: {
  unreadCount: number
  active?: boolean
  variant?: "bar" | "sidebar"
  collapsed?: boolean
  className?: string
}) {
  const hasUnread = unreadCount > 0
  const label = hasUnread ? `Notifications (${unreadCount} unread)` : "Notifications"

  const dot = hasUnread && (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background"
    />
  )

  if (variant === "sidebar") {
    return (
      <Link
        href="/notifications"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
          collapsed ? "justify-center px-2" : "px-3",
          active
            ? "bg-brand-soft text-white"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
          className,
        )}
      >
        <span className="relative flex shrink-0 items-center justify-center">
          <Bell className="size-[18px]" />
          {dot}
        </span>
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap transition-all duration-200",
            collapsed ? "w-0 opacity-0" : "ml-3 w-auto opacity-100",
          )}
        >
          Notifications
        </span>
      </Link>
    )
  }

  return (
    <Link
      href="/notifications"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground",
        active && "text-foreground",
        className,
      )}
    >
      <Bell className="size-[18px]" />
      {dot}
    </Link>
  )
}
