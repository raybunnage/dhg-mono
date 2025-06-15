-- Update EnvConfigService migration status in sys_shared_services
UPDATE sys_shared_services
SET 
  migration_status = 'completed',
  migration_completed_at = NOW(),
  service_path = 'env-config-service-refactored/',
  migration_notes = 'Refactored to extend SingletonService. Added health checks, metrics tracking, reload capability, and comprehensive diagnostics. Node.js only - prevents browser usage.',
  base_class_type = 'SingletonService',
  service_type = 'infrastructure',
  instantiation_pattern = 'singleton',
  requires_initialization = true,
  updated_at = NOW()
WHERE service_name = 'EnvConfigService';

-- Verify the update
SELECT 
  service_name,
  service_path,
  migration_status,
  migration_completed_at,
  base_class_type,
  service_type,
  instantiation_pattern,
  usage_count
FROM sys_shared_services 
WHERE service_name = 'EnvConfigService';