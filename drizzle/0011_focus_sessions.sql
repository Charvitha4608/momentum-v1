CREATE TABLE "focus_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"targetId" integer,
	"pillarId" integer NOT NULL,
	"minutes" integer NOT NULL,
	"date" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_targetId_targets_id_fk" FOREIGN KEY ("targetId") REFERENCES "public"."targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_pillarId_pillars_id_fk" FOREIGN KEY ("pillarId") REFERENCES "public"."pillars"("id") ON DELETE cascade ON UPDATE no action;