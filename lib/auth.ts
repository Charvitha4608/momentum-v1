import { betterAuth } from "better-auth"
import { pool, db } from "@/lib/db"
import { pillars } from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"

export const auth = betterAuth({
  database: pool,
  databaseHooks: {
    user: {
      create: {
        // Every user gets a default "Default" pillar so they can add targets
        // immediately, mirroring the backfill applied to existing users.
        after: async (createdUser) => {
          await db.insert(pillars).values({ userId: createdUser.id, name: "Default", icon: "🎯", color: "#959EC9", sortOrder: 0 })
        },
      },
    },
  },
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // "Forgot password" flow: Better Auth generates the reset token and calls
    // this with the reset URL. The link is logged for dev visibility, then sent
    // via Resend (lib/email.ts). sendEmail is a no-op without RESEND_API_KEY, so
    // the flow stays testable locally off the logged link alone.
    sendResetPassword: async ({ user, url }) => {
      console.log(`[auth] Password reset link for ${user.email}: ${url}`)
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your Momentum password",
          html: `<p>We received a request to reset your Momentum password.</p>
<p><a href="${url}">Click here to set a new password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
        })
      } catch (err) {
        // A delivery failure must not crash the reset request — the user still
        // gets a generic "if an account exists, a link is on its way" response.
        console.error("[auth] Failed to send password reset email:", err)
      }
    },
  },
  trustedOrigins: [
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
  ],
  session: {
    // "Remember me" ceiling: checked sign-ins get a persistent cookie/session
    // that lasts this long. Unchecked sign-ins pass `rememberMe: false` (see
    // AuthForm), which makes Better Auth issue a session-only cookie that's
    // cleared when the browser closes, while still using this same expiry
    // for the underlying session record.
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
  },
})
