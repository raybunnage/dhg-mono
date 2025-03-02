-- Drop policies
DROP POLICY IF EXISTS "Users can view their own command history" ON command_history;
DROP POLICY IF EXISTS "Users can insert their own command history" ON command_history;
DROP POLICY IF EXISTS "Users can view command categories" ON command_categories;
DROP POLICY IF EXISTS "Users can view command patterns" ON command_patterns;
DROP POLICY IF EXISTS "Users can view their favorite commands" ON favorite_commands;
DROP POLICY IF EXISTS "Users can manage their favorite commands" ON favorite_commands;

-- Drop indexes
DROP INDEX IF EXISTS idx_command_history_category;
DROP INDEX IF EXISTS idx_command_history_executed_at;
DROP INDEX IF EXISTS idx_command_history_success;

-- Drop tables (in reverse order of creation to handle dependencies)
DROP TABLE IF EXISTS command_patterns;
DROP TABLE IF EXISTS favorite_commands;
DROP TABLE IF EXISTS command_history;
DROP TABLE IF EXISTS command_categories; 