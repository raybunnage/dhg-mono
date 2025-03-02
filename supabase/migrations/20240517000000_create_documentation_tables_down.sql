-- Migration: Drop Documentation Management System Tables (Down Migration)
-- Description: Reverts the creation of documentation management system tables

-- Drop triggers
DROP TRIGGER IF EXISTS update_documentation_files_updated_at ON documentation_files;
DROP TRIGGER IF EXISTS update_documentation_sections_updated_at ON documentation_sections;
DROP TRIGGER IF EXISTS update_documentation_processing_queue_updated_at ON documentation_processing_queue;

-- Drop functions
DROP FUNCTION IF EXISTS queue_documentation_file_for_processing(UUID, INTEGER);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in reverse order of creation to handle dependencies)
DROP TABLE IF EXISTS documentation_processing_queue;
DROP TABLE IF EXISTS documentation_sections;
DROP TABLE IF EXISTS documentation_relations;
DROP TABLE IF EXISTS documentation_files; 