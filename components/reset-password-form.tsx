"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Target } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm({ token }: { token?: string }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      setError("This reset link is invalid or has expired. Please request a new one.")
      return
    }
    setError(null)
    setLoading(true)

    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token })
      if (error) {
        setError(error.message ?? "Could not reset your password. The link may have expired.")
        setLoading(false)
        return
      }
      setSuccess(true)
      setTimeout(() => router.push("/sign-in"), 2000)
    } catch {
      setError("Something went wrong. Please try again.")
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
            <h1 className="text-2xl font-semibold">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
          </div>
        </div>

        {!token ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm text-foreground">This reset link is invalid or has expired.</p>
            <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Request a new link
            </Link>
          </div>
        ) : success ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm text-foreground">Your password has been reset.</p>
            <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* COLOR: destructive marks form-validation/auth errors */}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} size="lg" className="mt-1 w-full">
              {loading ? "Saving…" : "Reset password"}
            </Button>
          </form>
        )}

        {/* COLOR: primary marks links/interactive text throughout the auth forms */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
