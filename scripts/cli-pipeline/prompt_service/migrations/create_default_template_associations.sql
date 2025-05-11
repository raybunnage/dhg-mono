-- Create default template associations for existing prompts
-- This script should be run after create_prompt_output_templates.sql

-- First, get the template IDs
DO $$
DECLARE
  core_template_id UUID;
  concepts_template_id UUID;
  powerpoint_template_id UUID;
  clinical_template_id UUID;
BEGIN
  -- Get template IDs
  SELECT id INTO core_template_id FROM prompt_output_templates WHERE name = 'core_document_classification';
  SELECT id INTO concepts_template_id FROM prompt_output_templates WHERE name = 'concepts_extraction';
  SELECT id INTO powerpoint_template_id FROM prompt_output_templates WHERE name = 'powerpoint_specific';
  SELECT id INTO clinical_template_id FROM prompt_output_templates WHERE name = 'clinical_implications';

  -- Associate the scientific-document-analysis-prompt with appropriate templates
  INSERT INTO prompt_template_associations (prompt_id, template_id, priority)
  SELECT id, core_template_id, 1
  FROM prompts
  WHERE name = 'scientific-document-analysis-prompt'
  AND NOT EXISTS (
    SELECT 1 FROM prompt_template_associations 
    WHERE prompt_id = prompts.id AND template_id = core_template_id
  );

  INSERT INTO prompt_template_associations (prompt_id, template_id, priority)
  SELECT id, concepts_template_id, 2
  FROM prompts
  WHERE name = 'scientific-document-analysis-prompt'
  AND NOT EXISTS (
    SELECT 1 FROM prompt_template_associations 
    WHERE prompt_id = prompts.id AND template_id = concepts_template_id
  );

  INSERT INTO prompt_template_associations (prompt_id, template_id, priority)
  SELECT id, clinical_template_id, 3
  FROM prompts
  WHERE name = 'scientific-document-analysis-prompt'
  AND NOT EXISTS (
    SELECT 1 FROM prompt_template_associations 
    WHERE prompt_id = prompts.id AND template_id = clinical_template_id
  );

  -- Associate the scientific-powerpoint prompt with appropriate templates
  INSERT INTO prompt_template_associations (prompt_id, template_id, priority)
  SELECT id, core_template_id, 1
  FROM prompts
  WHERE name = 'scientific-powerpoint'
  AND NOT EXISTS (
    SELECT 1 FROM prompt_template_associations 
    WHERE prompt_id = prompts.id AND template_id = core_template_id
  );

  INSERT INTO prompt_template_associations (prompt_id, template_id, priority)
  SELECT id, powerpoint_template_id, 2
  FROM prompts
  WHERE name = 'scientific-powerpoint'
  AND NOT EXISTS (
    SELECT 1 FROM prompt_template_associations 
    WHERE prompt_id = prompts.id AND template_id = powerpoint_template_id
  );

  INSERT INTO prompt_template_associations (prompt_id, template_id, priority)
  SELECT id, clinical_template_id, 3
  FROM prompts
  WHERE name = 'scientific-powerpoint'
  AND NOT EXISTS (
    SELECT 1 FROM prompt_template_associations 
    WHERE prompt_id = prompts.id AND template_id = clinical_template_id
  );

  -- Associate the document-classification-prompt-new with appropriate templates
  INSERT INTO prompt_template_associations (prompt_id, template_id, priority)
  SELECT id, core_template_id, 1
  FROM prompts
  WHERE name = 'document-classification-prompt-new'
  AND NOT EXISTS (
    SELECT 1 FROM prompt_template_associations 
    WHERE prompt_id = prompts.id AND template_id = core_template_id
  );

  INSERT INTO prompt_template_associations (prompt_id, template_id, priority)
  SELECT id, concepts_template_id, 2
  FROM prompts
  WHERE name = 'document-classification-prompt-new'
  AND NOT EXISTS (
    SELECT 1 FROM prompt_template_associations 
    WHERE prompt_id = prompts.id AND template_id = concepts_template_id
  );
END$$;

-- Create an additional association for any new prompts
-- (Used as an example of adding associations directly without the PL/pgSQL block)
-- INSERT INTO prompt_template_associations (prompt_id, template_id, priority)
-- SELECT p.id, t.id, 1
-- FROM prompts p, prompt_output_templates t
-- WHERE p.name = 'new-prompt-name-here' AND t.name = 'core_document_classification'
-- AND NOT EXISTS (
--   SELECT 1 FROM prompt_template_associations 
--   WHERE prompt_id = p.id AND template_id = t.id
-- );