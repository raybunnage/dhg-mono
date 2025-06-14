-- Add validation task tracking to work summaries and dev tasks
-- This enables creating validation tasks from work summaries and tracking the relationship

-- Add validation task metadata fields to ai_work_summaries
-- The metadata JSON field will store: validation_task_id, validation_created_at
-- This is already handled through the existing metadata field

-- Add validation tracking to dev_tasks metadata
-- The metadata JSON field will store: parent_work_summary_id, validation_checklist, is_validation_task
-- This is already handled through the existing metadata field

-- Create a view to easily find validation tasks
CREATE OR REPLACE VIEW dev_validation_tasks_view AS
SELECT 
    dt.id,
    dt.title,
    dt.description,
    dt.status,
    dt.priority,
    dt.created_at,
    dt.updated_at,
    dt.metadata->>'parent_work_summary_id' as parent_work_summary_id,
    dt.metadata->>'validation_checklist' as validation_checklist,
    ws.title as work_summary_title,
    ws.summary_content as work_summary_content,
    ws.category as work_summary_category,
    ws.work_date as work_summary_date
FROM dev_tasks dt
LEFT JOIN ai_work_summaries ws 
    ON ws.id = (dt.metadata->>'parent_work_summary_id')::uuid
WHERE dt.metadata->>'is_validation_task' = 'true'
ORDER BY dt.created_at DESC;

-- Create a function to get validation status for a work summary
CREATE OR REPLACE FUNCTION get_work_summary_validation_status(summary_id UUID)
RETURNS TABLE (
    has_validation_task BOOLEAN,
    validation_task_id UUID,
    validation_task_status TEXT,
    validation_created_at TIMESTAMPTZ,
    validation_completed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN dt.id IS NOT NULL THEN true ELSE false END as has_validation_task,
        dt.id as validation_task_id,
        dt.status as validation_task_status,
        dt.created_at as validation_created_at,
        CASE WHEN dt.status = 'completed' THEN dt.updated_at ELSE NULL END as validation_completed_at
    FROM ai_work_summaries ws
    LEFT JOIN dev_tasks dt ON dt.id = (ws.metadata->>'validation_task_id')::uuid
    WHERE ws.id = summary_id;
END;
$$ LANGUAGE plpgsql;

-- Create index for faster validation task lookups
CREATE INDEX IF NOT EXISTS idx_dev_tasks_is_validation_task 
ON dev_tasks ((metadata->>'is_validation_task'))
WHERE metadata->>'is_validation_task' = 'true';

-- Create index for parent work summary lookups
CREATE INDEX IF NOT EXISTS idx_dev_tasks_parent_work_summary 
ON dev_tasks ((metadata->>'parent_work_summary_id'))
WHERE metadata->>'parent_work_summary_id' IS NOT NULL;

-- Grant permissions
GRANT SELECT ON dev_validation_tasks_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_work_summary_validation_status(UUID) TO anon, authenticated;