-- Custom SQL migration file, put your code below! --

-- Rename the auto-created default pillar from "General" to "Default" for all
-- existing users. New users already receive "Default" via the user-create hook
-- in lib/auth.ts. Scoped to the default pillar's icon so any pillar a user
-- manually named "General" is left untouched.
UPDATE "pillars" SET "name" = 'Default' WHERE "name" = 'General' AND "icon" = '🎯';
