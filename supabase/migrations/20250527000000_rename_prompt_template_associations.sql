-- Up Migration: Rename prompt_template_associations tables to ai_prompt_template_associations

-- Rename the main table
ALTER TABLE IF EXISTS prompt_template_associations 
RENAME TO ai_prompt_template_associations;

-- Rename the view
ALTER VIEW IF EXISTS prompt_template_associations_view 
RENAME TO ai_prompt_template_associations_view;

-- Update any indexes to match new table name
ALTER INDEX IF EXISTS prompt_template_associations_pkey 
RENAME TO ai_prompt_template_associations_pkey;

ALTER INDEX IF EXISTS idx_prompt_template_associations_prompt_id 
RENAME TO idx_ai_prompt_template_associations_prompt_id;

ALTER INDEX IF EXISTS idx_prompt_template_associations_template_id 
RENAME TO idx_ai_prompt_template_associations_template_id;

-- Update any foreign key constraints to match new table name
ALTER TABLE IF EXISTS ai_prompt_template_associations
RENAME CONSTRAINT prompt_template_associations_prompt_id_fkey 
TO ai_prompt_template_associations_prompt_id_fkey;

ALTER TABLE IF EXISTS ai_prompt_template_associations
RENAME CONSTRAINT prompt_template_associations_template_id_fkey 
TO ai_prompt_template_associations_template_id_fkey;