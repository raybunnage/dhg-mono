-- This migration has already been applied - the experts table has been renamed to expert_profiles
-- This file documents the change for reference

-- The following would have been executed:
-- ALTER TABLE experts RENAME TO expert_profiles;

-- Update any views that reference the old table name
-- Note: These may need to be recreated if they exist

-- Update RLS policies (if they exist)
-- The policies would need to be dropped and recreated with the new table name

-- Update any functions that reference the experts table
-- These would need to be updated to use expert_profiles instead

-- Note: Foreign key constraints in other tables (like expert_documents.expert_id)
-- automatically follow the table rename in PostgreSQL