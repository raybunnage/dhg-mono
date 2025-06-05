BEGIN;

-- Rename inconsistent index names
ALTER INDEX uni_document_types_pkey RENAME TO document_types_pkey;
ALTER INDEX idx_uni_document_types_document_type RENAME TO idx_document_types_document_type;

COMMIT; 