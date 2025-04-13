-- Migration to remove user foreign key constraints from sources_google
ALTER TABLE "public"."sources_google" 
  DROP CONSTRAINT IF EXISTS "sources_google_created_by_fkey",
  DROP CONSTRAINT IF EXISTS "sources_google_updated_by_fkey";

-- Make these columns nullable for maximum flexibility
ALTER TABLE "public"."sources_google" 
  ALTER COLUMN "created_by" DROP NOT NULL,
  ALTER COLUMN "updated_by" DROP NOT NULL; 