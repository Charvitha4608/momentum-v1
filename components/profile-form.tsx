"use client"

import { useState, useTransition } from "react"
import { Award, CheckCircle2, Flame, Trophy } from "lucide-react"

import { updateProfile } from "@/app/actions/profile"
import type { BadgeCatalogEntry } from "@/app/actions/achievements"
import { ALLOWED_EMOJIS } from "@/lib/emojis"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CountUp } from "@/components/count-up"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Profile = {
  name: string
  email: string
  emoji: string
  points: number
  streak: number
  bestStreak: number
  totalCompleted: number
  badges: BadgeCatalogEntry[]
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.name)
  const [emoji, setEmoji] = useState(profile.emoji)
  const [editingName, setEditingName] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const dirty = name.trim() !== profile.name || emoji !== profile.emoji

  function handleSave() {
    startTransition(async () => {
      const res = await updateProfile({ name, emoji })
      setFeedback(res)
      if (res.ok) setEditingName(false)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full">
        <CardContent>
          <div className="mb-5 flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-3xl">{emoji}</span>
            <div>
              <div className="text-lg font-semibold">{name}</div>
              <div className="text-sm text-muted-foreground">{profile.email}</div>
            </div>
          </div>

          {/* COLOR: stat icons use primary by default; only the "current streak" flame uses destructive
              to read as an active/urgent streak (matches StatCard, Leaderboard friend dialog) */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-surface-2 px-3 py-3 text-center">
              <Trophy className="mx-auto mb-1 size-4 text-primary" />
              <div className="text-lg font-semibold tabular-nums">
                <CountUp value={profile.points} />
              </div>
              <div className="text-xs text-muted-foreground">Total points</div>
            </div>
            <div className="rounded-lg bg-surface-2 px-3 py-3 text-center">
              <Flame className="mx-auto mb-1 size-4 text-destructive" />
              <div className="text-lg font-semibold tabular-nums">
                <CountUp value={profile.streak} />
              </div>
              <div className="text-xs text-muted-foreground">Current streak</div>
            </div>
            <div className="rounded-lg bg-surface-2 px-3 py-3 text-center">
              <Award className="mx-auto mb-1 size-4 text-primary" />
              <div className="text-lg font-semibold tabular-nums">
                <CountUp value={profile.bestStreak} />
              </div>
              <div className="text-xs text-muted-foreground">Best streak</div>
            </div>
            <div className="rounded-lg bg-surface-2 px-3 py-3 text-center">
              <CheckCircle2 className="mx-auto mb-1 size-4 text-primary" />
              <div className="text-lg font-semibold tabular-nums">
                <CountUp value={profile.totalCompleted} />
              </div>
              <div className="text-xs text-muted-foreground">Tasks completed</div>
            </div>
          </div>

          {profile.badges.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Badges</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {profile.badges.map((badge) => (
                  <div
                    key={badge.key}
                    title={badge.description}
                    className={cn(
                      "rounded-lg bg-surface-2 px-3 py-3 text-center transition-opacity",
                      !badge.unlocked && "opacity-40 grayscale"
                    )}
                  >
                    <div className="mb-1 text-2xl">{badge.icon}</div>
                    <div className="text-xs font-medium">{badge.label}</div>
                    {badge.unlocked ? (
                      <div className="text-xs text-muted-foreground">{badge.unlockedAt}</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Locked</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

<Card className="max-w-md">       <CardContent>
          <div className="flex flex-col gap-4">
            {/* Display Name */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Display name</p>
              {editingName ? (
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFeedback(null) }}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingName(false) }}
                  maxLength={50}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-surface-3"
                >
                  {name}
                </button>
              )}
            </div>

            {/* Email — read-only */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              <div className="px-3 py-2 text-sm text-muted-foreground">{profile.email}</div>
            </div>

            {/* Emoji */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Emoji</p>
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface-3">
                  <span className="text-xl">{emoji}</span>
                  <span className="text-xs text-muted-foreground">Click to change</span>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="grid grid-cols-8 gap-1.5">
                    {ALLOWED_EMOJIS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={emoji === option}
                        onClick={() => { setEmoji(option); setEmojiOpen(false); setFeedback(null) }}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-lg text-base transition-colors hover:bg-surface-3",
                          emoji === option ? "bg-primary/15 ring-1 ring-primary" : "bg-surface-2"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={handleSave} disabled={!dirty || isPending || name.trim() === ""}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
              {/* COLOR: success feedback uses primary, error feedback uses destructive */}
              {feedback && (
                <p className={cn("text-sm", feedback.ok ? "text-primary" : "text-destructive")} role="status">
                  {feedback.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
