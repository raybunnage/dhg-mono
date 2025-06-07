-- Populate worktree_app_mappings with some default mappings
-- Development branch has access to all apps
INSERT INTO worktree_app_mappings (worktree_id, app_name)
SELECT 
  wd.id,
  app.name
FROM worktree_definitions wd
CROSS JOIN (
  SELECT UNNEST(ARRAY[
    'dhg-a', 'dhg-b', 'dhg-hub', 'dhg-hub-lovable', 
    'dhg-admin-google', 'dhg-admin-suite', 'dhg-audio', 
    'dhg-improve-experts', 'dhg-admin-code'
  ]) AS name
) app
WHERE wd.path = 'development'
ON CONFLICT DO NOTHING;

-- Feature branches get specific apps
-- Prompt service feature gets admin apps
INSERT INTO worktree_app_mappings (worktree_id, app_name)
SELECT 
  wd.id,
  app.name
FROM worktree_definitions wd
CROSS JOIN (
  SELECT UNNEST(ARRAY['dhg-admin-code', 'dhg-improve-experts']) AS name
) app
WHERE wd.path = 'feature/improve-prompt-service-add-page'
ON CONFLICT DO NOTHING;

-- Database layout feature gets all admin apps
INSERT INTO worktree_app_mappings (worktree_id, app_name)
SELECT 
  wd.id,
  app.name
FROM worktree_definitions wd
CROSS JOIN (
  SELECT UNNEST(ARRAY['dhg-admin-code', 'dhg-admin-suite', 'dhg-admin-google']) AS name
) app
WHERE wd.path = 'feature/create-single-database-layout'
ON CONFLICT DO NOTHING;

-- Populate worktree_pipeline_mappings
-- Development branch has access to all pipelines
INSERT INTO worktree_pipeline_mappings (worktree_id, pipeline_name)
SELECT 
  wd.id,
  pipeline.name
FROM worktree_definitions wd
CROSS JOIN (
  SELECT UNNEST(ARRAY[
    'google_sync', 'document', 'document_types', 
    'media-processing', 'presentations', 'prompt_service',
    'all_pipelines', 'database', 'archive', 'auth'
  ]) AS name
) pipeline
WHERE wd.path = 'development'
ON CONFLICT DO NOTHING;

-- Prompt service feature gets relevant pipelines
INSERT INTO worktree_pipeline_mappings (worktree_id, pipeline_name)
SELECT 
  wd.id,
  pipeline.name
FROM worktree_definitions wd
CROSS JOIN (
  SELECT UNNEST(ARRAY['prompt_service', 'database']) AS name
) pipeline
WHERE wd.path = 'feature/improve-prompt-service-add-page'
ON CONFLICT DO NOTHING;

-- Database layout feature gets database-related pipelines
INSERT INTO worktree_pipeline_mappings (worktree_id, pipeline_name)
SELECT 
  wd.id,
  pipeline.name
FROM worktree_definitions wd
CROSS JOIN (
  SELECT UNNEST(ARRAY['database', 'all_pipelines']) AS name
) pipeline
WHERE wd.path = 'feature/create-single-database-layout'
ON CONFLICT DO NOTHING;