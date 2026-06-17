"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Target } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoginCharacters } from "@/components/login-characters"

const FEATURES = [
  { emoji: "🔥", text: "Build daily streaks" },
  { emoji: "🏆", text: "Earn points through consistency" },
  { emoji: "📅", text: "Track monthly progress" },
  { emoji: "👥", text: "Compete with friends" },
]

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [focused, setFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === "sign-up"
  const shy = showPassword && password.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({ email, password, name })
        if (error) {
          setError(error.message ?? "Could not create account")
          setLoading(false)
          return
        }
      } else {
        const { error } = await authClient.signIn.email({ email, password, rememberMe })
        if (error) {
          setError(error.message ?? "Invalid email or password")
          setLoading(false)
          return
        }
      }
      router.push("/")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Left — branding & character illustration */}
      {/* COLOR: panel gradient — background fading to card color, sets the backdrop for the characters */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(135deg,var(--background)_0%,var(--card)_100%)] p-10 lg:flex">
        <Link href="/" className="relative z-10 flex items-center gap-2 text-lg font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Target className="size-4" />
          </span>
          Momentum
        </Link>

        <div className="relative z-10 flex flex-1 items-center justify-center">
          <LoginCharacters
  focused={focused}
  shy={shy}
  passwordFocused={passwordFocused}
/>
        </div>

        <div className="relative z-10 flex flex-col gap-5">
          <p className="text-xl font-medium">Build consistency. Track progress. Stay accountable.</p>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-2">
                <span aria-hidden>{f.emoji}</span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        {/* COLOR: ambient glow blobs — primary/secondary tints add depth behind the characters */}
        <div className="absolute top-1/3 right-0 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 size-72 rounded-full bg-secondary/30 blur-3xl" />
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Target className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold">{isSignUp ? "Create your account" : "Welcome back"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isSignUp ? "Start building your streak today." : "Sign in to keep your streak alive."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignUp && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="h-11"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => {
                    setFocused(true)
                    setPasswordFocused(true)
                  }}
                  onBlur={() => {
                    setFocused(false)
                    setPasswordFocused(false)
                  }}
                  placeholder="At least 8 characters"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
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

            {!isSignUp && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal text-muted-foreground">
                    Remember me for 30 days
                  </Label>
                </div>
                {/* COLOR: primary marks links/interactive text throughout the auth forms */}
                <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            {/* COLOR: destructive marks form-validation/auth errors */}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} size="lg" className="mt-1 w-full">
              {loading ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <Link
              href={isSignUp ? "/sign-in" : "/sign-up"}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
