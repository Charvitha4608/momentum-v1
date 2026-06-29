// lib/email.ts
//
// Thin wrapper around Resend's transactional email API, following the same
// convention as lib/ai/gemini.ts: raw fetch (no SDK), key read from env, and a
// graceful no-op when the key is absent so the app stays runnable in dev.
//
// One intentional difference from gemini.ts: once a key *is* configured, a real
// send failure throws rather than returning silently — a queued email that
// never leaves is worse than a loud error the caller can decide to swallow.

const RESEND_ENDPOINT = "https://api.resend.com/emails"

/**
 * Send a single transactional email via Resend.
 *
 * When RESEND_API_KEY is unset this logs a warning and returns without sending,
 * mirroring gemini.ts's graceful degradation so the password-reset flow is
 * still testable in dev (the reset link is logged separately by the caller).
 *
 * Throws when the Resend API responds with a non-2xx status, so genuine
 * delivery failures are surfaced rather than swallowed.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set, skipping send")
    return
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[email] Resend send failed (${res.status}): ${body}`)
  }
}
