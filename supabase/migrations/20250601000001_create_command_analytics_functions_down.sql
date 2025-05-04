-- Drop view
DROP VIEW IF EXISTS command_suggestions;

-- Drop functions
DROP FUNCTION IF EXISTS increment_favorite_command_usage(UUID);
DROP FUNCTION IF EXISTS get_command_history(TEXT, BOOLEAN, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_command_usage_by_category(INTERVAL);
DROP FUNCTION IF EXISTS get_most_used_commands(INTERVAL, INTEGER);
DROP FUNCTION IF EXISTS sanitize_command(TEXT); 