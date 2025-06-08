-- Add has_health_check column to registry_cli_pipelines table

ALTER TABLE registry_cli_pipelines 
ADD COLUMN IF NOT EXISTS has_health_check boolean DEFAULT false;

-- Update the column for pipelines that are in the master health check
UPDATE registry_cli_pipelines SET has_health_check = true WHERE pipeline_name IN (
  'google_sync',
  'drive_filter',
  'document',
  'experts',
  'document_types',
  'media_processing',
  'presentations',
  'classify',
  'ai',
  'prompt_service',
  'analysis',
  'git',
  'git_workflow',
  'merge',
  'worktree',
  'dev_tasks',
  'scripts',
  'auth',
  'mime_types',
  'refactor_tracking',
  'tracking',
  'monitoring',
  'deprecation',
  'documentation',
  'work_summaries',
  'database'
);

-- Show the results
SELECT pipeline_name, display_name, has_health_check, status 
FROM registry_cli_pipelines 
ORDER BY has_health_check DESC, pipeline_name;