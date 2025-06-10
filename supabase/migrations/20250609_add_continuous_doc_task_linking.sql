-- Add fields to link dev_tasks with continuous documentation
ALTER TABLE dev_tasks 
ADD COLUMN IF NOT EXISTS source_doc_id UUID REFERENCES doc_continuous_monitoring(id),
ADD COLUMN IF NOT EXISTS source_doc_path TEXT,
ADD COLUMN IF NOT EXISTS source_doc_phase TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dev_tasks_source_doc_id ON dev_tasks(source_doc_id);

-- Add comment explaining the fields
COMMENT ON COLUMN dev_tasks.source_doc_id IS 'Reference to the continuous document that spawned this task';
COMMENT ON COLUMN dev_tasks.source_doc_path IS 'Path to the continuous document for quick access';
COMMENT ON COLUMN dev_tasks.source_doc_phase IS 'The specific phase from the document that this task implements';

-- Create a view to easily see tasks linked to continuous docs
CREATE OR REPLACE VIEW dev_tasks_with_continuous_docs_view AS
SELECT 
  dt.*,
  dcm.title as source_doc_title,
  dcm.area as source_doc_area,
  dcm.next_review_date as source_doc_next_review
FROM dev_tasks dt
LEFT JOIN doc_continuous_monitoring dcm ON dt.source_doc_id = dcm.id;

-- Grant appropriate permissions
GRANT SELECT ON dev_tasks_with_continuous_docs_view TO authenticated;