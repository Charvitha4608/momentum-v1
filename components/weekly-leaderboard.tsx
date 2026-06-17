import { CalendarRange } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { WeeklyLeaderboardRow } from "@/app/actions/friends"

export function WeeklyLeaderboard({ rows, title = "This Week" }: { rows: WeeklyLeaderboardRow[]; title?: string }) {
  return (
    <Card className="w-full">
      <CardContent>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <CalendarRange className="size-4.5 text-primary" />
          {title}
        </h2>

        {rows.length <= 1 ? (
          <p className="text-sm text-muted-foreground">
            Invite friends to see how your week stacks up against theirs.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <li
                key={row.userId}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5",
                  row.isMe ? "bg-primary/10 ring-1 ring-primary/40" : "bg-secondary/40"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-base" aria-hidden>
                  {row.emoji}
                </span>
                <span className="flex-1 truncate font-medium">
                  {row.name}
                  {row.isMe && <span className="ml-1.5 text-xs text-primary">(you)</span>}
                </span>
                <span className="text-sm text-muted-foreground">{row.weeklyTasks} tasks</span>
                <span className="w-16 text-right font-semibold text-primary">{row.weeklyPoints}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
