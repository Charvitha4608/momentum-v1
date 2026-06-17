"use client"

import type React from "react"

import { useState, useTransition } from "react"
import { inviteFriend, respondToInvite, cancelSentInvite, removeFriend } from "@/app/actions/friends"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, X, Mail, UserMinus } from "lucide-react"

type Invite = { id: number; name: string; email: string }
type Friend = { friendshipId: number; userId: string; name: string; emoji: string }

export function FriendManager({
  pendingInvites,
  pendingSent,
  connectedFriends,
}: {
  pendingInvites: Invite[]
  pendingSent: Invite[]
  connectedFriends: Friend[]
}) {
  const [email, setEmail] = useState("")
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    startTransition(async () => {
      const res = await inviteFriend(value)
      setFeedback(res)
      if (res.ok) setEmail("")
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Invite by email */}
      <Card className="w-full">
        <CardContent>
          <h2 className="mb-1 text-lg font-semibold">Invite a friend</h2>
          <p className="mb-4 text-sm text-muted-foreground">Send an invite using their account email.</p>
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={isPending} size="lg">
              {isPending ? "Sending…" : "Send invite"}
            </Button>
          </form>
          {/* COLOR: success feedback uses primary, error feedback uses destructive */}
          {feedback && (
            <p className={`mt-3 text-sm ${feedback.ok ? "text-primary" : "text-destructive"}`} role="status">
              {feedback.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Connected friends */}
      <Card className="w-full">
        <CardContent>
          <h2 className="mb-4 text-lg font-semibold">Connected friends</h2>
          {connectedFriends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No friends yet — invite someone above.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {connectedFriends.map((friend) => (
                <li key={friend.friendshipId} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-base">
                    {friend.emoji}
                  </span>
                  <div className="flex-1 font-medium">{friend.name}</div>
                  {/* COLOR: destructive hover signals a removal action */}
                  <button
                    type="button"
                    aria-label={`Remove ${friend.name}`}
                    onClick={() => startTransition(async () => void (await removeFriend(friend.friendshipId)))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pending invites received */}
      <Card className="w-full">
        <CardContent>
          <h2 className="mb-4 text-lg font-semibold">Pending received</h2>
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingInvites.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
                  <div className="flex-1">
                    <div className="font-medium">{invite.name}</div>
                    <div className="text-xs text-muted-foreground">{invite.email}</div>
                  </div>
                  {/* COLOR: accept uses a solid primary button; decline is neutral with a destructive hover */}
                  <button
                    type="button"
                    aria-label="Accept invite"
                    onClick={() => startTransition(async () => void (await respondToInvite(invite.id, true)))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/80"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Decline invite"
                    onClick={() => startTransition(async () => void (await respondToInvite(invite.id, false)))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pending invites sent */}
      <Card className="w-full">
        <CardContent>
          <h2 className="mb-4 text-lg font-semibold">Pending sent</h2>
          {pendingSent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outgoing invites.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingSent.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
                  <div className="flex-1">
                    <div className="font-medium">{invite.name}</div>
                    <div className="text-xs text-muted-foreground">{invite.email}</div>
                  </div>
                  {/* COLOR: destructive hover signals a cancel action */}
                  <button
                    type="button"
                    aria-label={`Cancel invite to ${invite.name}`}
                    onClick={() => startTransition(async () => void (await cancelSentInvite(invite.id)))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
