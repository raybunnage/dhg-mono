-- GitOperationsService Database Update
-- Updates the sys_shared_services table with GitOperationsService information

-- First check if record exists, then upsert
INSERT INTO sys_shared_services (
  service_name,
  service_path,
  description,
  service_type,
  base_class_type,
  is_singleton,
  dependencies,
  status,
  breaking_changes,
  migration_status,
  migration_notes
) VALUES (
  'GitOperationsService',
  'packages/shared/services/git-operations/GitOperationsService.ts',
  'Singleton service for git operations including worktrees, branches, commits, and merges with caching and health monitoring',
  'infrastructure',
  'SingletonService',
  true,
  '["Logger (optional)"]'::jsonb,
  'active',
  true,
  'completed',
  'Migrated from standalone class to SingletonService. Provides comprehensive git operations with caching, metrics, and health monitoring. Handles worktrees, branches, commits, status checks, and merge operations.'
)
ON CONFLICT (service_name) DO UPDATE SET
  service_path = EXCLUDED.service_path,
  description = EXCLUDED.description,
  service_type = EXCLUDED.service_type,
  base_class_type = EXCLUDED.base_class_type,
  is_singleton = EXCLUDED.is_singleton,
  dependencies = EXCLUDED.dependencies,
  status = EXCLUDED.status,
  breaking_changes = EXCLUDED.breaking_changes,
  migration_status = EXCLUDED.migration_status,
  migration_notes = EXCLUDED.migration_notes,
  updated_at = NOW();

-- Verify the record was created/updated
SELECT 
  service_name,
  service_type,
  base_class_type,
  is_singleton,
  status,
  migration_status,
  updated_at
FROM sys_shared_services 
WHERE service_name = 'GitOperationsService';