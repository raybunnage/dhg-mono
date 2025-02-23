-- Up Migration
ALTER TABLE processing_batches
ADD COLUMN IF NOT EXISTS item_ids JSONB DEFAULT '[]'::jsonb;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_processing_batches_item_ids 
ON processing_batches USING gin (item_ids);

-- Down Migration
DROP INDEX IF EXISTS idx_processing_batches_item_ids;
ALTER TABLE processing_batches DROP COLUMN IF EXISTS item_ids; 