"use client"

import { useState, useTransition } from "react"
import { AlertTriangle, Bell, Check, CheckCheck, Flag, PartyPopper, TrendingDown, UserCheck, UserPlus, X } from "lucide-react"

import { markAllAsRead, markAsRead } from "@/app/actions/notifications"
import { respondToFriendRequestNotification } from "@/app/actions/friends"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Notification = {
  id: number
  type: string
  message: string
  read: boolean
  relatedId: number | null
  createdAt: Date
}

const ICONS: Record<string, typeof Bell> = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  all_completed: PartyPopper,
  overtaken: TrendingDown,
  goal_reminder: Flag,
  neglected_pillar: AlertTriangle,
}

function formatRelativeTime(date: Date) {
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const [items, setItems] = useState(notifications)
  const [, startTransition] = useTransition()

  const unreadCount = items.filter((n) => !n.read).length

  function handleMarkAsRead(id: number) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    startTransition(() => markAsRead(id))
  }

  function handleMarkAllAsRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    startTransition(() => markAllAsRead())
  }

  function handleRespond(id: number, accept: boolean) {
    setItems((prev) => prev.filter((n) => n.id !== id))
    startTransition(() => respondToFriendRequestNotification(id, accept))
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bell className="size-4.5 text-primary" />
            Notifications
          </h2>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck className="mr-1.5 size-4" />
              Mark all as read
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">You&apos;re all caught up. Notifications will appear here.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell
              const isFriendRequest = n.type === "friend_request" && n.relatedId != null
              return (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/60",
                    // COLOR: unread notifications get a subtle primary tint
                    !n.read && "bg-primary/10"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => !n.read && handleMarkAsRead(n.id)}
                    className="flex flex-1 items-start gap-3 text-left"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="flex-1">
                      <span className={cn("block text-sm", n.read ? "text-muted-foreground" : "font-medium text-foreground")}>
                        {n.message}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{formatRelativeTime(new Date(n.createdAt))}</span>
                    </span>
                    {/* COLOR: unread dot uses primary, matching the row tint above */}
                    {!n.read && !isFriendRequest && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                  </button>

                  {isFriendRequest && (
                    <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleRespond(n.id, true)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Check className="size-3.5" />
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRespond(n.id, false)}
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive" // COLOR: reject hover — destructive (Accent) tint signals a dismissive action
                      >
                        <X className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
