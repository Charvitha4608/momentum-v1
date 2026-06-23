"use client"

import { useMemo, useState, useTransition } from "react"
import { motion } from "framer-motion"
import { Trophy, Flame, Star } from "lucide-react"

import { getFriendProfile, type FriendProfile } from "@/app/actions/friends"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type Row = {
  userId: string
  name: string
  emoji: string
  points: number
  streak: number
  isMe: boolean
}

type SortMode = "points" | "streak"

export function Leaderboard({ rows, title = "Leaderboard" }: { rows: Row[]; title?: string }) {
  const [sortMode, setSortMode] = useState<SortMode>("points")
  const [profile, setProfile] = useState<FriendProfile | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) =>
      sortMode === "points" ? b.points - a.points || b.streak - a.streak : b.streak - a.streak || b.points - a.points
    )
    return copy
  }, [rows, sortMode])

  function openProfile(userId: string) {
    setLoadingId(userId)
    startTransition(async () => {
      try {
        const data = await getFriendProfile(userId)
        setProfile(data)
      } finally {
        setLoadingId(null)
      }
    })
  }

  return (
    <Card className="w-full">
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="size-4.5 text-primary" />
            {title}
          </h2>
          {rows.length > 1 && (
            <ToggleGroup value={[sortMode]} onValueChange={(v) => v[0] && setSortMode(v[0] as SortMode)}>
              <ToggleGroupItem value="points" aria-label="Sort by points">
                <Star className="mr-1 inline size-3.5" />
                Points
              </ToggleGroupItem>
              <ToggleGroupItem value="streak" aria-label="Sort by streak">
                <Flame className="mr-1 inline size-3.5" />
                Streak
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        {rows.length <= 1 ? (
          <p className="text-sm text-muted-foreground">
            Invite a friend to start competing — rankings go by points, then streak.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {sorted.map((row, i) => (
              <motion.li layout key={row.userId} transition={{ type: "spring", stiffness: 400, damping: 35 }}>
                <button
                  type="button"
                  onClick={() => openProfile(row.userId)}
                  disabled={loadingId === row.userId}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary/60",
                    // COLOR: the current user's row gets a primary tint + ring; other rows use a plain secondary background
                    row.isMe ? "bg-primary/10 ring-1 ring-primary/40" : "bg-secondary/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      // COLOR: #1 rank badge is primary; all other ranks use muted
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
                    {/* COLOR: "(you)" label uses primary to match the row highlight above */}
                    {row.isMe && <span className="ml-1.5 text-xs text-primary">(you)</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">{row.streak}d</span>
                  {/* COLOR: points value uses primary, matching the points stat elsewhere (StatCard, ProfileForm) */}
                  <span className="w-16 text-right font-semibold text-primary">{row.points}</span>
                </button>
              </motion.li>
            ))}
          </ol>
        )}
      </CardContent>

      <Dialog open={profile !== null} onOpenChange={(open) => !open && setProfile(null)}>
        <DialogContent>
          {profile && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-2xl">
                  {profile.emoji}
                </span>
                <div>
                  <DialogTitle>{profile.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground">Today&apos;s activity</p>
                </div>
              </div>

              {/* COLOR: points uses primary, streak uses destructive (flame) — matches StatCard/ProfileForm */}
              <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-secondary/40 px-2 py-3">
                  <div className="text-lg font-semibold tabular-nums text-primary">{profile.points}</div>
                  <div className="text-xs text-muted-foreground">Points</div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-3">
                  <div className="text-lg font-semibold tabular-nums text-destructive">{profile.streak}</div>
                  <div className="text-xs text-muted-foreground">Streak</div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-3">
                  <div className="text-lg font-semibold tabular-nums">{profile.dailyScore.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Daily score</div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-secondary/40 px-2 py-3">
                  <div className="text-lg font-semibold tabular-nums text-primary">{profile.weeklyPoints}</div>
                  <div className="text-xs text-muted-foreground">Points this week</div>
                </div>
                <div className="rounded-lg bg-secondary/40 px-2 py-3">
                  <div className="text-lg font-semibold tabular-nums text-destructive">{profile.longestStreak}</div>
                  <div className="text-xs text-muted-foreground">Longest streak</div>
                </div>
              </div>

              {profile.topPillars.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-1.5 text-sm font-medium">Top pillars</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.topPillars.map((p) => (
                      <span
                        key={p.pillarId}
                        className="flex items-center gap-1.5 rounded-full bg-secondary/40 px-2.5 py-1 text-xs"
                      >
                        <span aria-hidden>{p.pillarIcon}</span>
                        <span className="font-medium">{p.pillarName}</span>
                        <span className="text-muted-foreground">{p.points} pts</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.badges.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-1.5 text-sm font-medium">Badges</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.badges.map((b) => (
                      <span
                        key={b.key}
                        title={b.description}
                        className="flex items-center gap-1.5 rounded-full bg-secondary/40 px-2.5 py-1 text-xs"
                      >
                        <span aria-hidden>{b.icon}</span>
                        <span className="font-medium">{b.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Today&apos;s targets</span>
                <span className="text-muted-foreground">{Math.round(profile.completionPercent * 100)}%</span>
              </div>
              <Progress value={Math.round(profile.completionPercent * 100)} className="mb-3" />

              {profile.todayTargets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No targets created today.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {profile.todayTargets.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                      <Checkbox checked={t.completed} disabled aria-label={t.title} />
                      <span className={cn("text-sm", t.completed ? "text-muted-foreground line-through" : "text-foreground")}>
                        {t.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
