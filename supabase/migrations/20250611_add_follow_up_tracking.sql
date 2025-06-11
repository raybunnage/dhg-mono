-- Add follow-up tracking system for dev_tasks and work_summaries
-- This enables tracking when follow-up implementation tasks are created

-- Add follow-up tracking table to track relationships
CREATE TABLE IF NOT EXISTS dev_follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_task_id UUID NULL, -- References dev_tasks.id when original is a task
  original_work_summary_id UUID NULL, -- References ai_work_summaries.id when original is a work summary
  follow_up_task_id UUID NOT NULL, -- References dev_tasks.id for the follow-up task
  follow_up_type VARCHAR(50) NOT NULL DEFAULT 'implementation', -- 'implementation', 'validation', 'enhancement', etc.
  follow_up_summary TEXT NULL, -- Brief summary of what the follow-up addresses
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NULL,
  
  -- Constraints
  CONSTRAINT check_original_source CHECK (
    (original_task_id IS NOT NULL AND original_work_summary_id IS NULL) OR
    (original_task_id IS NULL AND original_work_summary_id IS NOT NULL)
  ),
  
  -- Foreign keys
  CONSTRAINT fk_follow_up_original_task 
    FOREIGN KEY (original_task_id) REFERENCES dev_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_follow_up_original_work_summary 
    FOREIGN KEY (original_work_summary_id) REFERENCES ai_work_summaries(id) ON DELETE CASCADE,
  CONSTRAINT fk_follow_up_task 
    FOREIGN KEY (follow_up_task_id) REFERENCES dev_tasks(id) ON DELETE CASCADE
);

-- Add RLS policies
ALTER TABLE dev_follow_up_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON dev_follow_up_tasks
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON dev_follow_up_tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON dev_follow_up_tasks
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX idx_follow_up_original_task ON dev_follow_up_tasks(original_task_id);
CREATE INDEX idx_follow_up_original_work_summary ON dev_follow_up_tasks(original_work_summary_id);
CREATE INDEX idx_follow_up_task ON dev_follow_up_tasks(follow_up_task_id);
CREATE INDEX idx_follow_up_created_at ON dev_follow_up_tasks(created_at);

-- Create view to get follow-up information for dev_tasks
CREATE OR REPLACE VIEW dev_tasks_with_follow_ups_view AS
SELECT 
  dt.*,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', fut.id,
          'follow_up_task_id', fut.follow_up_task_id,
          'follow_up_type', fut.follow_up_type,
          'follow_up_summary', fut.follow_up_summary,
          'follow_up_title', ft.title,
          'follow_up_status', ft.status,
          'created_at', fut.created_at
        )
        ORDER BY fut.created_at DESC
      )
      FROM dev_follow_up_tasks fut
      LEFT JOIN dev_tasks ft ON ft.id = fut.follow_up_task_id
      WHERE fut.original_task_id = dt.id
    ),
    '[]'::json
  ) as follow_up_tasks
FROM dev_tasks dt;

-- Create view to get follow-up information for work summaries
CREATE OR REPLACE VIEW ai_work_summaries_with_follow_ups_view AS
SELECT 
  ws.*,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', fut.id,
          'follow_up_task_id', fut.follow_up_task_id,
          'follow_up_type', fut.follow_up_type,
          'follow_up_summary', fut.follow_up_summary,
          'follow_up_title', ft.title,
          'follow_up_status', ft.status,
          'created_at', fut.created_at
        )
        ORDER BY fut.created_at DESC
      )
      FROM dev_follow_up_tasks fut
      LEFT JOIN dev_tasks ft ON ft.id = fut.follow_up_task_id
      WHERE fut.original_work_summary_id = ws.id
    ),
    '[]'::json
  ) as follow_up_tasks
FROM ai_work_summaries ws;

-- Function to create a follow-up task relationship
CREATE OR REPLACE FUNCTION create_follow_up_task_relationship(
  p_original_task_id UUID DEFAULT NULL,
  p_original_work_summary_id UUID DEFAULT NULL,
  p_follow_up_task_id UUID,
  p_follow_up_type VARCHAR DEFAULT 'implementation',
  p_follow_up_summary TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_follow_up_id UUID;
BEGIN
  -- Validate inputs
  IF (p_original_task_id IS NULL AND p_original_work_summary_id IS NULL) THEN
    RAISE EXCEPTION 'Either original_task_id or original_work_summary_id must be provided';
  END IF;
  
  IF (p_original_task_id IS NOT NULL AND p_original_work_summary_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Only one of original_task_id or original_work_summary_id can be provided';
  END IF;

  -- Insert the follow-up relationship
  INSERT INTO dev_follow_up_tasks (
    original_task_id,
    original_work_summary_id,
    follow_up_task_id,
    follow_up_type,
    follow_up_summary,
    created_by
  ) VALUES (
    p_original_task_id,
    p_original_work_summary_id,
    p_follow_up_task_id,
    p_follow_up_type,
    p_follow_up_summary,
    auth.uid()
  ) RETURNING id INTO v_follow_up_id;

  RETURN v_follow_up_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get follow-ups for a specific item
CREATE OR REPLACE FUNCTION get_follow_ups(
  p_task_id UUID DEFAULT NULL,
  p_work_summary_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  follow_up_task_id UUID,
  follow_up_type VARCHAR,
  follow_up_summary TEXT,
  follow_up_title TEXT,
  follow_up_status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF p_task_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      fut.id,
      fut.follow_up_task_id,
      fut.follow_up_type,
      fut.follow_up_summary,
      ft.title,
      ft.status,
      fut.created_at
    FROM dev_follow_up_tasks fut
    LEFT JOIN dev_tasks ft ON ft.id = fut.follow_up_task_id
    WHERE fut.original_task_id = p_task_id
    ORDER BY fut.created_at DESC;
  ELSIF p_work_summary_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      fut.id,
      fut.follow_up_task_id,
      fut.follow_up_type,
      fut.follow_up_summary,
      ft.title,
      ft.status,
      fut.created_at
    FROM dev_follow_up_tasks fut
    LEFT JOIN dev_tasks ft ON ft.id = fut.follow_up_task_id
    WHERE fut.original_work_summary_id = p_work_summary_id
    ORDER BY fut.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON dev_follow_up_tasks TO authenticated;
GRANT INSERT ON dev_follow_up_tasks TO authenticated;
GRANT UPDATE ON dev_follow_up_tasks TO authenticated;
GRANT SELECT ON dev_tasks_with_follow_ups_view TO authenticated;
GRANT SELECT ON ai_work_summaries_with_follow_ups_view TO authenticated;
GRANT EXECUTE ON FUNCTION create_follow_up_task_relationship TO authenticated;
GRANT EXECUTE ON FUNCTION get_follow_ups TO authenticated;