-- Update health check status based on our testing
-- Mark pipelines as having health checks and whether they're currently working

-- First, mark all pipelines as having health checks (we added them)
UPDATE sys_cli_pipelines 
SET has_health_check = true
WHERE script_path LIKE '%/scripts/cli-pipeline/%';

-- Now add a new column to track if the health check is currently working
ALTER TABLE sys_cli_pipelines 
ADD COLUMN IF NOT EXISTS health_check_working boolean DEFAULT false;

-- Update the working status based on our test results
-- Healthy pipelines:
UPDATE sys_cli_pipelines SET health_check_working = true
WHERE name IN (
  'ai-cli.sh',
  'auth-cli.sh',
  'command-tracking-cli.sh',
  'database-cli.sh',
  'dev-tasks-cli.sh',
  'doc-cli.sh',
  'drive-filter-cli.sh',
  'git-workflow-cli.sh',
  'google-sync-cli.sh',
  'media-processing-cli.sh',
  'mime-types-cli.sh',
  'monitoring-cli.sh',
  'refactor-tracking-cli.sh',
  'script-analysis-cli.sh',
  'scripts-cli.sh',
  'work-summaries-cli.sh'
);

-- Unhealthy pipelines:
UPDATE sys_cli_pipelines SET health_check_working = false
WHERE name IN (
  'classification-cli.sh',
  'deprecation-cli.sh',
  'document-types-cli.sh',
  'documentation-cli.sh',
  'experts-cli.sh',
  'git-cli.sh',
  'merge-cli.sh',
  'presentations-cli.sh',
  'prompt-service-cli.sh',
  'worktree-cli.sh'
);

-- Show summary
SELECT 
  COUNT(*) as total_pipelines,
  SUM(CASE WHEN has_health_check THEN 1 ELSE 0 END) as with_health_check,
  SUM(CASE WHEN health_check_working THEN 1 ELSE 0 END) as working_health_checks,
  ROUND(100.0 * SUM(CASE WHEN health_check_working THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM sys_cli_pipelines
WHERE script_path LIKE '%/scripts/cli-pipeline/%';
EOF < /dev/null