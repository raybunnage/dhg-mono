-- GitOperationsService Database Update
-- Updates the sys_shared_services table with GitOperationsService information

-- First check if record exists, then upsert
INSERT INTO sys_shared_services (
  service_name,
  service_type,
  base_class,
  file_path,
  description,
  dependencies,
  dependency_injection,
  singleton_pattern,
  health_checks,
  metrics_tracking,
  caching,
  error_handling,
  logging,
  status,
  usage_locations,
  last_updated,
  notes,
  breaking_changes,
  migration_required,
  api_stable
) VALUES (
  'GitOperationsService',
  'Infrastructure',
  'SingletonService',
  'packages/shared/services/git-operations/GitOperationsService.ts',
  'Singleton service for git operations including worktrees, branches, commits, and merges with caching and health monitoring',
  ARRAY['Logger (optional)'],
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  'active',
  0,
  NOW(),
  'Migrated from standalone class to SingletonService. Provides comprehensive git operations with caching, metrics, and health monitoring. Handles worktrees, branches, commits, status checks, and merge operations.',
  true,
  true,
  true
)
ON CONFLICT (service_name) DO UPDATE SET
  service_type = EXCLUDED.service_type,
  base_class = EXCLUDED.base_class,
  file_path = EXCLUDED.file_path,
  description = EXCLUDED.description,
  dependencies = EXCLUDED.dependencies,
  dependency_injection = EXCLUDED.dependency_injection,
  singleton_pattern = EXCLUDED.singleton_pattern,
  health_checks = EXCLUDED.health_checks,
  metrics_tracking = EXCLUDED.metrics_tracking,
  caching = EXCLUDED.caching,
  error_handling = EXCLUDED.error_handling,
  logging = EXCLUDED.logging,
  status = EXCLUDED.status,
  last_updated = NOW(),
  notes = EXCLUDED.notes,
  breaking_changes = EXCLUDED.breaking_changes,
  migration_required = EXCLUDED.migration_required,
  api_stable = EXCLUDED.api_stable;

-- Verify the record was created/updated
SELECT 
  service_name,
  service_type,
  base_class,
  singleton_pattern,
  health_checks,
  metrics_tracking,
  caching,
  status,
  last_updated
FROM sys_shared_services 
WHERE service_name = 'GitOperationsService';