-- Custom SQL migration file, put your code below! --

-- Backfill: every existing user gets a default "General" pillar, and every
-- existing target (created before the Pillars system existed) is assigned to
-- it. This preserves all existing targets/points/streaks - they simply
-- become part of the "General" pillar going forward.
INSERT INTO "pillars" ("userId", "name", "icon", "color", "archived", "sortOrder")
SELECT "id", 'General', '🎯', '#959EC9', false, 0
FROM "user";
--> statement-breakpoint

UPDATE "targets"
SET "pillarId" = "pillars"."id"
FROM "pillars"
WHERE "pillars"."userId" = "targets"."userId"
  AND "pillars"."name" = 'General'
  AND "targets"."pillarId" IS NULL;
--> statement-breakpoint

ALTER TABLE "targets" ALTER COLUMN "pillarId" SET NOT NULL;
