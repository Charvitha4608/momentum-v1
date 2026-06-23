ALTER TABLE "recurring_tasks" ADD COLUMN "endDate" text;--> statement-breakpoint
ALTER TABLE "recurring_tasks" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_tasks" ADD COLUMN "longTermGoalId" integer;--> statement-breakpoint
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_longTermGoalId_long_term_goals_id_fk" FOREIGN KEY ("longTermGoalId") REFERENCES "public"."long_term_goals"("id") ON DELETE set null ON UPDATE no action;