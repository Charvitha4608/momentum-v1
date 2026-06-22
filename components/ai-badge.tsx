import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Marks a schedule item as AI-proposed. Stays visible after accepting (with a
 * subtler look) so the calendar always shows what came from the planner.
 */
export function AiBadge({ variant = "proposed", className }: { variant?: "proposed" | "accepted"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        variant === "proposed"
          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
          : "bg-secondary/60 text-muted-foreground",
        className
      )}
    >
      <Sparkles className="size-2.5" aria-hidden />
      AI
    </span>
  )
}
