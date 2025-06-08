-- Update health check flags based on master health check script

-- First, set all to false
UPDATE registry_cli_pipelines SET has_health_check = false;

-- Then update the ones that are in the master health check
UPDATE registry_cli_pipelines SET has_health_check = true WHERE name IN (
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
SELECT name, display_name, has_health_check, status 
FROM registry_cli_pipelines 
ORDER BY has_health_check DESC, name;