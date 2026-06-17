"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronsLeft, ChevronsRight, LogOut, Target } from "lucide-react"

import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { NavIcon } from "@/components/nav-icon"
import { navItems, type ActivePath } from "@/lib/nav-items"

const COLLAPSE_KEY = "momentum:sidebar-collapsed"

// COLOR: shared label-fade transition for collapsed icon-only state
const labelClass = (collapsed: boolean) =>
  cn(
    "overflow-hidden whitespace-nowrap transition-all duration-200",
    collapsed ? "w-0 opacity-0" : "ml-3 w-auto opacity-100"
  )

export function Sidebar({ active, unreadCount }: { active: ActivePath; unreadCount: number }) {
  const router = useRouter()
  const [collapsed, setCollapsed] = React.useState(false)

  React.useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0")
      return next
    })
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out md:flex",
        collapsed ? "w-[68px]" : "w-56"
      )}
    >
      <div className="flex h-14 shrink-0 items-center overflow-hidden px-3">
        <Link href="/" className="flex items-center font-semibold" aria-label="Momentum">
          {/* COLOR: brand mark — primary background, matches mobile header logo */}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Target className="size-4" />
          </span>
          <span className={labelClass(collapsed)}>Momentum</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 overflow-hidden px-2 py-2">
        {navItems.map((item) => {
          const isActive = active === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2" : "px-3",
                isActive
                  ? "bg-muted/50 text-foreground"
                  : "text-muted-foreground/90 hover:bg-muted/20 hover:text-muted-foreground"
              )}
            >
              <span className="relative flex shrink-0 items-center justify-center">
                <NavIcon icon={item.icon} className="size-[18px]" />
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-semibold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className={labelClass(collapsed)}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-1.5 border-t border-border px-2 py-2">
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className={cn(
            "flex items-center rounded-lg py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground",
            collapsed ? "justify-center px-2" : "px-3"
          )}
        >
          <span className="flex shrink-0 items-center justify-center">
            <LogOut className="size-[18px]" />
          </span>
          <span className={labelClass(collapsed)}>Sign out</span>
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center rounded-lg py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground",
            collapsed ? "justify-center px-2" : "px-3"
          )}
        >
          <span className="flex shrink-0 items-center justify-center">
            {collapsed ? <ChevronsRight className="size-[18px]" /> : <ChevronsLeft className="size-[18px]" />}
          </span>
          <span className={labelClass(collapsed)}>Collapse</span>
        </button>
      </div>
    </aside>
  )
}
