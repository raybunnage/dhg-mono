-- Down Migration: Revert ai_prompt_template_associations tables back to prompt_template_associations

-- Rename the view back
ALTER VIEW IF EXISTS ai_prompt_template_associations_view 
RENAME TO prompt_template_associations_view;

-- Rename the main table back
ALTER TABLE IF EXISTS ai_prompt_template_associations 
RENAME TO prompt_template_associations;

-- Revert indexes to original names
ALTER INDEX IF EXISTS ai_prompt_template_associations_pkey 
RENAME TO prompt_template_associations_pkey;

ALTER INDEX IF EXISTS idx_ai_prompt_template_associations_prompt_id 
RENAME TO idx_prompt_template_associations_prompt_id;

ALTER INDEX IF EXISTS idx_ai_prompt_template_associations_template_id 
RENAME TO idx_prompt_template_associations_template_id;

-- Revert foreign key constraints to original names
ALTER TABLE IF EXISTS prompt_template_associations
RENAME CONSTRAINT ai_prompt_template_associations_prompt_id_fkey 
TO prompt_template_associations_prompt_id_fkey;

ALTER TABLE IF EXISTS prompt_template_associations
RENAME CONSTRAINT ai_prompt_template_associations_template_id_fkey 
TO prompt_template_associations_template_id_fkey;