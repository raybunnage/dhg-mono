-- Update DocumentService migration status in sys_shared_services
UPDATE sys_shared_services
SET 
  migration_status = 'completed',
  migration_completed_at = NOW(),
  service_path = 'document-service-refactored/',
  migration_notes = 'Refactored from singleton to BusinessService with dependency injection. Manages documentation_files table. Added health checks, metrics, and proper error handling.',
  base_class_type = 'BusinessService',
  service_type = 'business',
  instantiation_pattern = 'dependency_injection',
  requires_initialization = true,
  updated_at = NOW()
WHERE service_name = 'DocumentService';

-- Verify the update
SELECT 
  service_name,
  service_path,
  migration_status,
  migration_completed_at,
  base_class_type,
  service_type,
  instantiation_pattern
FROM sys_shared_services 
WHERE service_name = 'DocumentService';