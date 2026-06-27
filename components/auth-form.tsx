"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CalendarDays, Eye, EyeOff, Flame, Target, Trophy, Users } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { LoginCharacters } from "@/components/login-characters"
import styles from "./auth-form.module.css"

const FEATURES = [
  { Icon: Flame, text: "Build daily streaks", coral: true },
  { Icon: Trophy, text: "Earn points through consistency" },
  { Icon: CalendarDays, text: "Track monthly progress" },
  { Icon: Users, text: "Compete with friends" },
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
    <div className={styles.root}>
      {/* Left — brand panel (logo / illustration+tagline / features) */}
      <div className={styles.brand}>
        <div className={styles.grain} aria-hidden />

        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark}>
            <Target className="size-4" />
          </span>
          Momentum
        </Link>

        <div className={styles.center}>
          {/* Grounding (halo + shadow) wraps the existing illustration — the
              LoginCharacters SVG/markup itself is left untouched. */}
          <div className={styles.illo}>
            <div className={styles.halo} aria-hidden />
            <div className={styles.illoShadow} aria-hidden />
            <div className={styles.illoInner}>
              <LoginCharacters focused={focused} shy={shy} passwordFocused={passwordFocused} />
            </div>
          </div>
          <p className={styles.tagline}>Build consistency. Track progress. Stay accountable.</p>
        </div>

        <ul className={styles.features}>
          {FEATURES.map(({ Icon, text, coral }) => (
            <li key={text} className={styles.feature}>
              <span className={`${styles.chip}${coral ? ` ${styles.chipCoral}` : ""}`}>
                <Icon className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Right — form panel */}
      <div className={styles.formPane}>
        <div className={styles.card}>
          <Link href="/" className={styles.cardLogo}>
            <span className={styles.logoMark}>
              <Target className="size-4" />
            </span>
            Momentum
          </Link>

          <h1 className={styles.title}>{isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className={styles.subtitle}>
            {isSignUp ? "Start building your streak today." : "Sign in to keep your streak alive."}
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            {isSignUp && (
              <div className={styles.field}>
                <label htmlFor="name" className={styles.label}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Your name"
                  autoComplete="name"
                  className={styles.input}
                />
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="you@example.com"
                autoComplete="email"
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <div className={styles.passwordWrap}>
                <input
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
                  className={styles.input}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className={styles.eye}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {!isSignUp && (
              <div className={styles.row}>
                <label htmlFor="remember-me" className={styles.remember}>
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={styles.checkbox}
                  />
                  Remember me for 30 days
                </label>
                <Link href="/forgot-password" className={styles.link}>
                  Forgot password?
                </Link>
              </div>
            )}

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className={styles.submit}>
              {loading ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
            </button>
          </form>

          <p className={styles.switch}>
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <Link href={isSignUp ? "/sign-in" : "/sign-up"} className={styles.link}>
              {isSignUp ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
