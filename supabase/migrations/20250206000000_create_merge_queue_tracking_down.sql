-- Rollback: Remove merge queue tracking tables
-- Author: Claude
-- Date: 2025-02-06

-- Drop views first
DROP VIEW IF EXISTS dev_merge_queue_dashboard;

-- Drop policies
DROP POLICY IF EXISTS "Merge queue items are viewable by authenticated users" ON dev_merge_queue;
DROP POLICY IF EXISTS "Users can manage their own merge queue items" ON dev_merge_queue;
DROP POLICY IF EXISTS "Merge conflicts are viewable by authenticated users" ON dev_merge_conflicts;
DROP POLICY IF EXISTS "Users can manage conflicts for their merge items" ON dev_merge_conflicts;
DROP POLICY IF EXISTS "Merge checklist items are viewable by authenticated users" ON dev_merge_checklist;
DROP POLICY IF EXISTS "Users can manage checklist for their merge items" ON dev_merge_checklist;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS merge_queue_status_update ON dev_merge_queue;
DROP FUNCTION IF EXISTS update_merge_queue_status();

-- Drop indexes
DROP INDEX IF EXISTS idx_merge_queue_status;
DROP INDEX IF EXISTS idx_merge_queue_branch;
DROP INDEX IF EXISTS idx_merge_queue_task;
DROP INDEX IF EXISTS idx_merge_conflicts_queue;
DROP INDEX IF EXISTS idx_merge_checklist_queue;

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS dev_merge_checklist;
DROP TABLE IF EXISTS dev_merge_conflicts;
DROP TABLE IF EXISTS dev_merge_queue;

-- Remove from sys_table_definitions
DELETE FROM sys_table_definitions 
WHERE table_name IN ('dev_merge_queue', 'dev_merge_conflicts', 'dev_merge_checklist');