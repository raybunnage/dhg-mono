-- Rollback migration for command refactor tracking

-- Drop views
DROP VIEW IF EXISTS commands_needing_attention;
DROP VIEW IF EXISTS command_refactor_status_summary;

-- Drop policies
DROP POLICY IF EXISTS "Allow all operations on command_refactor_tracking" ON command_refactor_tracking;

-- Drop trigger and function
DROP TRIGGER IF EXISTS update_command_refactor_tracking_updated_at ON command_refactor_tracking;
DROP FUNCTION IF EXISTS update_command_refactor_tracking_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_command_refactor_tracking_status;
DROP INDEX IF EXISTS idx_command_refactor_tracking_type;

-- Drop table
DROP TABLE IF EXISTS command_refactor_tracking;