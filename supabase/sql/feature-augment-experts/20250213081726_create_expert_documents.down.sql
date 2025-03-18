BEGIN;

-- Drop triggers first
DROP TRIGGER IF EXISTS set_updated_at ON expert_documents;
DROP TRIGGER IF EXISTS set_created_by_trigger ON expert_documents;
DROP TRIGGER IF EXISTS set_updated_by_trigger ON expert_documents;

-- Drop policies
DROP POLICY IF EXISTS "Allow authenticated users to delete expert documents" ON expert_documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert expert documents" ON expert_documents;
DROP POLICY IF EXISTS "Allow authenticated users to update expert documents" ON expert_documents;
DROP POLICY IF EXISTS "Allow users to view all expert documents" ON expert_documents;

-- Drop indexes
DROP INDEX IF EXISTS idx_expert_documents_expert_id;
DROP INDEX IF EXISTS idx_expert_documents_source_id;
DROP INDEX IF EXISTS idx_expert_documents_document_type_id;
DROP INDEX IF EXISTS idx_expert_documents_topics;
DROP INDEX IF EXISTS idx_expert_documents_processing_status;

-- Drop table
DROP TABLE IF EXISTS expert_documents;

COMMIT; 