-- Add AI-generated narrative column to weekly_reviews.
-- Nullable so existing rows don't need backfilling; the reflection action
-- populates it lazily on first load after the week ends.
ALTER TABLE "weekly_reviews" ADD COLUMN IF NOT EXISTS "aiNarrative" text;
