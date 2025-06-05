-- Rollback migration for AI work summaries

-- Drop views
DROP VIEW IF EXISTS recent_ai_work_summaries;

-- Drop functions
DROP FUNCTION IF EXISTS search_ai_work_summaries(TEXT);
DROP FUNCTION IF EXISTS update_ai_work_summaries_updated_at();

-- Drop policies
DROP POLICY IF EXISTS "Allow all operations on ai_work_summaries" ON ai_work_summaries;

-- Drop trigger
DROP TRIGGER IF EXISTS update_ai_work_summaries_updated_at ON ai_work_summaries;

-- Drop indexes
DROP INDEX IF EXISTS idx_ai_work_summaries_work_date;
DROP INDEX IF EXISTS idx_ai_work_summaries_title;
DROP INDEX IF EXISTS idx_ai_work_summaries_content;
DROP INDEX IF EXISTS idx_ai_work_summaries_commands;
DROP INDEX IF EXISTS idx_ai_work_summaries_tags;
DROP INDEX IF EXISTS idx_ai_work_summaries_category;

-- Drop table
DROP TABLE IF EXISTS ai_work_summaries;