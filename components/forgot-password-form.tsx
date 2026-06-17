"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Target } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      })
      if (error) {
        setError(error.message ?? "Something went wrong. Please try again.")
        setLoading(false)
        return
      }
      setSent(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Target className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">Forgot your password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm text-foreground">
              If an account exists for <span className="font-medium">{email}</span>, a password reset link is on its
              way.
            </p>
            <p className="text-sm text-muted-foreground">
              Check your inbox (and spam folder), then follow the link to set a new password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11"
              />
            </div>

            {/* COLOR: destructive marks form-validation/auth errors */}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} size="lg" className="mt-1 w-full">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        {/* COLOR: primary marks links/interactive text throughout the auth forms */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
