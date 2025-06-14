-- Down migration: Remove service classification fields from sys_shared_services

-- Drop views first
DROP VIEW IF EXISTS sys_service_initialization_order_view;
DROP VIEW IF EXISTS sys_business_services_view;
DROP VIEW IF EXISTS sys_infrastructure_services_view;

-- Drop function
DROP FUNCTION IF EXISTS validate_service_dependencies();

-- Remove columns
ALTER TABLE sys_shared_services 
DROP COLUMN IF EXISTS service_type,
DROP COLUMN IF EXISTS instantiation_pattern,
DROP COLUMN IF EXISTS environment_support,
DROP COLUMN IF EXISTS requires_initialization,
DROP COLUMN IF EXISTS initialization_dependencies,
DROP COLUMN IF EXISTS resource_management;

-- Remove from table definitions
DELETE FROM sys_table_definitions 
WHERE table_name IN (
  'sys_infrastructure_services_view',
  'sys_business_services_view', 
  'sys_service_initialization_order_view'
);