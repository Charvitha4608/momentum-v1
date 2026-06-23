ALTER TABLE "targets" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "estimatedMinutes" integer;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "actualMinutes" integer;--> statement-breakpoint
ALTER TABLE "targets" ADD COLUMN "longTermGoalId" integer;--> statement-breakpoint
ALTER TABLE "targets" ADD CONSTRAINT "targets_longTermGoalId_long_term_goals_id_fk" FOREIGN KEY ("longTermGoalId") REFERENCES "public"."long_term_goals"("id") ON DELETE set null ON UPDATE no action;