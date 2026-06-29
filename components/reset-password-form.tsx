"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Target } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import styles from "./auth-form.module.css"

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
    <div className={styles.solo}>
      <div className={styles.card}>
        <Link href="/" className={styles.soloLogo}>
          <span className={styles.logoMark}>
            <Target className="size-4" />
          </span>
          Momentum
        </Link>

        <h1 className={styles.title}>Set a new password</h1>
        <p className={styles.subtitle}>Choose a new password for your account.</p>

        {!token ? (
          <div className={styles.notice}>
            <p className={styles.noticeText}>This reset link is invalid or has expired.</p>
            <Link href="/forgot-password" className={styles.link}>
              Request a new link
            </Link>
          </div>
        ) : success ? (
          <div className={styles.notice}>
            <p className={styles.noticeText}>Your password has been reset.</p>
            <p className={styles.noticeMuted}>Redirecting you to sign in…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>
                New password
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
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

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className={styles.submit}>
              {loading ? "Saving…" : "Reset password"}
            </button>
          </form>
        )}

        <p className={styles.switch}>
          <Link href="/sign-in" className={styles.link}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
