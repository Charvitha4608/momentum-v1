"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"
import { NavIcon } from "@/components/nav-icon"
import { navItems, type ActivePath } from "@/lib/nav-items"

/** Primary navigation on mobile, mirrors the sidebar's items/active state. */
export function BottomTabBar({ active }: { active: ActivePath }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
      {navItems.map((item) => {
        const isActive = active === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.65rem] transition-colors",
              isActive
                ? "bg-muted/50 font-semibold text-foreground"
                : "font-medium text-muted-foreground/70"
            )}
          >
            <span className="relative">
              <NavIcon icon={item.icon} className="size-5" />
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
