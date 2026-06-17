import { betterAuth } from "better-auth"
import { pool, db } from "@/lib/db"
import { pillars } from "@/lib/db/schema"

export const auth = betterAuth({
  database: pool,
  databaseHooks: {
    user: {
      create: {
        // Every user gets a default "General" pillar so they can add targets
        // immediately, mirroring the backfill applied to existing users.
        after: async (createdUser) => {
          await db.insert(pillars).values({ userId: createdUser.id, name: "General", icon: "🎯", color: "#959EC9", sortOrder: 0 })
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
    // "Forgot password" flow: Better Auth generates the reset token and
    // calls this with the reset URL. Wire up a real transactional email
    // provider (Resend, Postmark, SMTP, etc.) here for production - for now
    // the link is logged so the end-to-end flow is testable in development.
    sendResetPassword: async ({ user, url }) => {
      console.log(`[auth] Password reset link for ${user.email}: ${url}`)
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
