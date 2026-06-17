"use client"

import { useState, useTransition } from "react"
import { Swords, Trophy } from "lucide-react"

import { getChallengeDetail, getChallenges, joinChallenge, type ChallengeDetail, type ChallengeSummary } from "@/app/actions/challenges"
import { ChallengeFormDialog } from "@/components/challenge-form-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { PillarOption } from "@/components/pillar-picker"
import { cn } from "@/lib/utils"

const METRIC_LABEL: Record<"points" | "tasks", string> = { points: "points", tasks: "tasks" }

export function ChallengesCard({ initialChallenges, pillars }: { initialChallenges: ChallengeSummary[]; pillars: PillarOption[] }) {
  const [challenges, setChallenges] = useState(initialChallenges)
  const [allPillars, setAllPillars] = useState(pillars)
  const [detail, setDetail] = useState<ChallengeDetail | null>(null)
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      const fresh = await getChallenges()
      setChallenges(fresh)
    })
  }

  function handleJoin(id: number) {
    startTransition(async () => {
      await joinChallenge(id)
      refresh()
    })
  }

  function openDetail(id: number) {
    setLoadingDetailId(id)
    startTransition(async () => {
      const d = await getChallengeDetail(id)
      setDetail(d)
      setLoadingDetailId(null)
    })
  }

  return (
    <Card className="w-full">
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Swords className="size-4.5 text-primary" />
            Challenges
          </h2>
          <ChallengeFormDialog
            pillars={allPillars}
            onPillarCreated={(p) => setAllPillars((prev) => [...prev, p])}
            onCreated={refresh}
          />
        </div>

        {challenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No challenges yet. Start one to race friends on points or tasks completed.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {challenges.map((c) => (
              <li key={c.id} className="rounded-lg bg-secondary/40 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {c.pillarIcon && <span aria-hidden>{c.pillarIcon}</span>}
                    <span>{c.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {c.status === "ended" ? "Ended" : `${c.daysRemaining}d left`} · {c.participantCount} joined
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {c.pillarName ? c.pillarName : "All pillars"} · {METRIC_LABEL[c.metric]}
                    {" · "}
                    <span className="text-foreground">
                      You: {c.myValue} {METRIC_LABEL[c.metric]}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {!c.joined && c.status !== "ended" && (
                      <button
                        type="button"
                        onClick={() => handleJoin(c.id)}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary/60"
                      >
                        Join
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openDetail(c.id)}
                      disabled={loadingDetailId === c.id}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary/60 disabled:opacity-50"
                    >
                      View
                    </button>
                  </div>
                </div>

                {c.status === "ended" && c.winner && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-primary">
                    <Trophy className="size-3.5" />
                    <span>
                      {c.winner.emoji} {c.winner.name} won with {c.winner.value} {METRIC_LABEL[c.metric]}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          {detail && (
            <div>
              <DialogTitle>{detail.title}</DialogTitle>
              <p className="mb-4 text-sm text-muted-foreground">
                {detail.pillarName ? `${detail.pillarIcon} ${detail.pillarName}` : "All pillars"} · {METRIC_LABEL[detail.metric]} ·{" "}
                {detail.status === "ended" ? "Ended" : "Active"}
              </p>
              <ol className="flex flex-col gap-2">
                {detail.participants.map((p, i) => (
                  <li
                    key={p.userId}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2",
                      p.isMe ? "bg-primary/10 ring-1 ring-primary/40" : "bg-secondary/40"
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
                      {p.emoji}
                    </span>
                    <span className="flex-1 truncate font-medium">
                      {p.name}
                      {p.isMe && <span className="ml-1.5 text-xs text-primary">(you)</span>}
                    </span>
                    <span className="font-semibold text-primary">
                      {p.value} {METRIC_LABEL[detail.metric]}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
