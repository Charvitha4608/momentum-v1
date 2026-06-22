CREATE TABLE "ai_planning_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"scope" text NOT NULL,
	"anchorDate" text NOT NULL,
	"status" text DEFAULT 'awaiting_user' NOT NULL,
	"messages" text DEFAULT '[]' NOT NULL,
	"pendingQuestion" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"sessionId" integer,
	"targetId" integer,
	"pillarId" integer,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"startTime" text,
	"endTime" text,
	"durationMinutes" integer DEFAULT 30 NOT NULL,
	"timeOfDay" text,
	"reasoning" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"aiGenerated" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_schedule_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"scheduleId" integer,
	"targetId" integer,
	"pillarId" integer,
	"action" text NOT NULL,
	"fromDate" text,
	"toDate" text,
	"fromTimeOfDay" text,
	"toTimeOfDay" text,
	"fromStart" text,
	"toStart" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"weekdayHours" real DEFAULT 3 NOT NULL,
	"weekendHours" real DEFAULT 5 NOT NULL,
	"dayStartHour" integer DEFAULT 9 NOT NULL,
	"dayEndHour" integer DEFAULT 22 NOT NULL,
	"weeklyBlocks" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "availability_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "availability_override" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"date" text NOT NULL,
	"hours" real NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "availability_override_user_date_unique" UNIQUE("userId","date")
);
--> statement-breakpoint
ALTER TABLE "recurring_tasks" ADD COLUMN "durationMinutes" integer;--> statement-breakpoint
ALTER TABLE "recurring_tasks" ADD COLUMN "preferredTimeOfDay" text;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "durationMinutes" integer;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "preferredTimeOfDay" text;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "deadline" text;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "scheduledStart" text;--> statement-breakpoint
ALTER TABLE "ai_planning_session" ADD CONSTRAINT "ai_planning_session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_schedule" ADD CONSTRAINT "ai_schedule_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_schedule" ADD CONSTRAINT "ai_schedule_sessionId_ai_planning_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."ai_planning_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_schedule" ADD CONSTRAINT "ai_schedule_targetId_targets_id_fk" FOREIGN KEY ("targetId") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_schedule" ADD CONSTRAINT "ai_schedule_pillarId_pillars_id_fk" FOREIGN KEY ("pillarId") REFERENCES "public"."pillars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_schedule_feedback" ADD CONSTRAINT "ai_schedule_feedback_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_schedule_feedback" ADD CONSTRAINT "ai_schedule_feedback_scheduleId_ai_schedule_id_fk" FOREIGN KEY ("scheduleId") REFERENCES "public"."ai_schedule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_schedule_feedback" ADD CONSTRAINT "ai_schedule_feedback_targetId_targets_id_fk" FOREIGN KEY ("targetId") REFERENCES "public"."targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_schedule_feedback" ADD CONSTRAINT "ai_schedule_feedback_pillarId_pillars_id_fk" FOREIGN KEY ("pillarId") REFERENCES "public"."pillars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_override" ADD CONSTRAINT "availability_override_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;