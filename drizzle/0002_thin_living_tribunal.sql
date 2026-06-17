CREATE TABLE "challenge_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"challengeId" integer NOT NULL,
	"userId" text NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_participants_challenge_user_unique" UNIQUE("challengeId","userId")
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"creatorId" text NOT NULL,
	"title" text NOT NULL,
	"pillarId" integer,
	"metric" text NOT NULL,
	"startDate" text NOT NULL,
	"endDate" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "long_term_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"pillarId" integer NOT NULL,
	"title" text NOT NULL,
	"targetValue" integer NOT NULL,
	"deadline" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"reminded7" boolean DEFAULT false NOT NULL,
	"reminded3" boolean DEFAULT false NOT NULL,
	"reminded1" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pillar_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"pillarId" integer NOT NULL,
	"metric" text NOT NULL,
	"targetValue" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pillars" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"pillarId" integer NOT NULL,
	"title" text NOT NULL,
	"points" integer DEFAULT 10 NOT NULL,
	"frequency" text NOT NULL,
	"daysOfWeek" text,
	"intervalDays" integer,
	"anchorDate" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_unlocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"unlockedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_unlocks_user_key_unique" UNIQUE("userId","key")
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"weekStart" text NOT NULL,
	"weekEnd" text NOT NULL,
	"pointsEarned" integer DEFAULT 0 NOT NULL,
	"tasksCompleted" integer DEFAULT 0 NOT NULL,
	"mostActivePillarId" integer,
	"leastActivePillarId" integer,
	"currentStreak" integer DEFAULT 0 NOT NULL,
	"bestDay" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_reviews_user_week_unique" UNIQUE("userId","weekStart")
);
--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "pillarId" integer;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "recurringTaskId" integer;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challengeId_challenges_id_fk" FOREIGN KEY ("challengeId") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_pillarId_pillars_id_fk" FOREIGN KEY ("pillarId") REFERENCES "public"."pillars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "long_term_goals" ADD CONSTRAINT "long_term_goals_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "long_term_goals" ADD CONSTRAINT "long_term_goals_pillarId_pillars_id_fk" FOREIGN KEY ("pillarId") REFERENCES "public"."pillars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pillar_goals" ADD CONSTRAINT "pillar_goals_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pillar_goals" ADD CONSTRAINT "pillar_goals_pillarId_pillars_id_fk" FOREIGN KEY ("pillarId") REFERENCES "public"."pillars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pillars" ADD CONSTRAINT "pillars_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_pillarId_pillars_id_fk" FOREIGN KEY ("pillarId") REFERENCES "public"."pillars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_unlocks" ADD CONSTRAINT "user_unlocks_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_mostActivePillarId_pillars_id_fk" FOREIGN KEY ("mostActivePillarId") REFERENCES "public"."pillars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_leastActivePillarId_pillars_id_fk" FOREIGN KEY ("leastActivePillarId") REFERENCES "public"."pillars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_pillarId_pillars_id_fk" FOREIGN KEY ("pillarId") REFERENCES "public"."pillars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_recurringTaskId_recurring_tasks_id_fk" FOREIGN KEY ("recurringTaskId") REFERENCES "public"."recurring_tasks"("id") ON DELETE set null ON UPDATE no action;