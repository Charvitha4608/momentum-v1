"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Target } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import styles from "./auth-form.module.css"

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
    <div className={styles.solo}>
      <div className={styles.card}>
        <Link href="/" className={styles.soloLogo}>
          <span className={styles.logoMark}>
            <Target className="size-4" />
          </span>
          Momentum
        </Link>

        <h1 className={styles.title}>Forgot your password?</h1>
        <p className={styles.subtitle}>Enter your email and we&apos;ll send you a link to reset it.</p>

        {sent ? (
          <div className={styles.notice}>
            <p className={styles.noticeText}>
              If an account exists for <strong>{email}</strong>, a password reset link is on its way.
            </p>
            <p className={styles.noticeMuted}>
              Check your inbox (and spam folder), then follow the link to set a new password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
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
                placeholder="you@example.com"
                autoComplete="email"
                className={styles.input}
              />
            </div>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className={styles.submit}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className={styles.switch}>
          <Link href="/sign-in" className={styles.backLink}>
            <ArrowLeft className="size-4" />
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
