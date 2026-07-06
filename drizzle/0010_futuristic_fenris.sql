CREATE TABLE "pillar_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"pillarId" integer NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"isDone" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp,
	"isRecurring" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pillar_goals" ADD COLUMN "anchorDate" text NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_tasks" ADD COLUMN "pausedUntil" text;--> statement-breakpoint
ALTER TABLE "pillar_tasks" ADD CONSTRAINT "pillar_tasks_pillarId_pillars_id_fk" FOREIGN KEY ("pillarId") REFERENCES "public"."pillars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pillar_tasks" ADD CONSTRAINT "pillar_tasks_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pillar_goals" ADD CONSTRAINT "pillar_goals_pillarId_unique" UNIQUE("pillarId");