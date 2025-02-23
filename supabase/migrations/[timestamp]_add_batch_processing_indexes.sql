-- Up Migration
CREATE INDEX IF NOT EXISTS idx_processing_batches_item_ids 
ON processing_batches USING gin (item_ids);

CREATE INDEX IF NOT EXISTS idx_processing_batches_metadata 
ON processing_batches USING gin (metadata);

-- Down Migration
DROP INDEX IF EXISTS idx_processing_batches_item_ids;
DROP INDEX IF EXISTS idx_processing_batches_metadata; 