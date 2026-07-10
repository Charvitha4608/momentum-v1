ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "startedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "endedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "durationSec" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN IF NOT EXISTS "sessionsCompleted" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "focus_sessions_user_started_idx" ON "focus_sessions" USING btree ("userId","startedAt");
