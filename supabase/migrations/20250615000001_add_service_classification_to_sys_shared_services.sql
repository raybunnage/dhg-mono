-- Migration: Add service classification fields to sys_shared_services
-- Purpose: Track service types, patterns, and environment support for automated testing and deployment

-- Add new classification columns
ALTER TABLE sys_shared_services 
ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) 
  CHECK (service_type IN ('infrastructure', 'business', 'hybrid'))
  DEFAULT 'business',
ADD COLUMN IF NOT EXISTS instantiation_pattern VARCHAR(50) 
  CHECK (instantiation_pattern IN ('singleton', 'dependency_injection', 'factory', 'static'))
  DEFAULT 'dependency_injection',
ADD COLUMN IF NOT EXISTS environment_support TEXT[] 
  DEFAULT ARRAY['both']::TEXT[]
  CHECK (environment_support <@ ARRAY['browser', 'node', 'both']::TEXT[]),
ADD COLUMN IF NOT EXISTS requires_initialization BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS initialization_dependencies TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS resource_management JSONB DEFAULT NULL;

-- Add helpful comments
COMMENT ON COLUMN sys_shared_services.service_type IS 
  'Type of service: infrastructure (manages resources), business (logic only), or hybrid';
COMMENT ON COLUMN sys_shared_services.instantiation_pattern IS 
  'How the service should be instantiated: singleton, dependency_injection, factory, or static';
COMMENT ON COLUMN sys_shared_services.environment_support IS 
  'Environments where service can run: browser, node, or both';
COMMENT ON COLUMN sys_shared_services.requires_initialization IS 
  'Whether service needs explicit initialization before use';
COMMENT ON COLUMN sys_shared_services.initialization_dependencies IS 
  'Other services that must be initialized first';
COMMENT ON COLUMN sys_shared_services.resource_management IS 
  'JSON object describing resources managed by infrastructure services';

-- Create view for infrastructure services
CREATE OR REPLACE VIEW sys_infrastructure_services_view AS
SELECT 
  service_name,
  service_path,
  instantiation_pattern,
  environment_support,
  requires_initialization,
  initialization_dependencies,
  resource_management,
  has_browser_variant,
  usage_count,
  created_at,
  updated_at
FROM sys_shared_services
WHERE service_type = 'infrastructure'
ORDER BY service_name;

-- Create view for business services  
CREATE OR REPLACE VIEW sys_business_services_view AS
SELECT 
  service_name,
  service_path,
  instantiation_pattern,
  environment_support,
  dependencies,
  has_browser_variant,
  usage_count,
  created_at,
  updated_at
FROM sys_shared_services
WHERE service_type = 'business'
ORDER BY service_name;

-- Create view for service initialization order
CREATE OR REPLACE VIEW sys_service_initialization_order_view AS
WITH RECURSIVE init_order AS (
  -- Base case: services with no dependencies
  SELECT 
    service_name,
    service_type,
    initialization_dependencies,
    0 as init_level,
    ARRAY[service_name] as init_path
  FROM sys_shared_services
  WHERE requires_initialization = true
    AND (initialization_dependencies IS NULL OR array_length(initialization_dependencies, 1) = 0)
  
  UNION ALL
  
  -- Recursive case: services that depend on previous level
  SELECT 
    s.service_name,
    s.service_type,
    s.initialization_dependencies,
    io.init_level + 1,
    io.init_path || s.service_name
  FROM sys_shared_services s
  JOIN init_order io ON io.service_name = ANY(s.initialization_dependencies)
  WHERE s.requires_initialization = true
    AND s.service_name != ALL(io.init_path) -- Prevent cycles
)
SELECT DISTINCT ON (service_name) 
  service_name,
  service_type,
  initialization_dependencies,
  init_level,
  init_path
FROM init_order
ORDER BY service_name, init_level DESC;

-- Update known infrastructure services
UPDATE sys_shared_services SET
  service_type = 'infrastructure',
  instantiation_pattern = 'singleton',
  requires_initialization = true,
  resource_management = jsonb_build_object(
    'type', 'database_connection',
    'pool_size', 10,
    'idle_timeout', '30s'
  )
WHERE service_name = 'SupabaseClientService';

UPDATE sys_shared_services SET
  service_type = 'infrastructure',
  instantiation_pattern = 'singleton',
  environment_support = ARRAY['node']::TEXT[],
  resource_management = jsonb_build_object(
    'type', 'api_connection',
    'rate_limit', '1000/day',
    'requires_api_key', true
  )
WHERE service_name = 'claude-service';

UPDATE sys_shared_services SET
  service_type = 'infrastructure',
  instantiation_pattern = 'singleton',
  environment_support = ARRAY['browser']::TEXT[],
  requires_initialization = true,
  initialization_dependencies = ARRAY['SupabaseClientService']::TEXT[]
WHERE service_name = 'BrowserAuthService';

UPDATE sys_shared_services SET
  service_type = 'infrastructure',
  instantiation_pattern = 'singleton',
  environment_support = ARRAY['both']::TEXT[],
  resource_management = jsonb_build_object(
    'type', 'logging',
    'browser', 'console',
    'node', 'file_system'
  )
WHERE service_name = 'logger';

-- Update known business services
UPDATE sys_shared_services SET
  service_type = 'business',
  instantiation_pattern = 'dependency_injection',
  environment_support = ARRAY['both']::TEXT[]
WHERE service_name IN (
  'CLIRegistryService',
  'DocumentClassificationService', 
  'PromptService',
  'ExpertService',
  'MediaPresentationService'
);

-- Update hybrid services
UPDATE sys_shared_services SET
  service_type = 'hybrid',
  instantiation_pattern = 'factory',
  environment_support = ARRAY['both']::TEXT[],
  resource_management = jsonb_build_object(
    'browser', 'localStorage',
    'node', 'filesystem',
    'adapter_pattern', true
  )
WHERE service_name = 'FileService';

-- Function to validate service dependencies
CREATE OR REPLACE FUNCTION validate_service_dependencies()
RETURNS TABLE (
  service_name TEXT,
  missing_dependencies TEXT[],
  circular_dependencies BOOLEAN
) AS $$
DECLARE
  service_record RECORD;
  dep TEXT;
  missing_deps TEXT[];
BEGIN
  FOR service_record IN 
    SELECT * FROM sys_shared_services 
    WHERE initialization_dependencies IS NOT NULL 
      AND array_length(initialization_dependencies, 1) > 0
  LOOP
    missing_deps := ARRAY[]::TEXT[];
    
    -- Check each dependency exists
    FOREACH dep IN ARRAY service_record.initialization_dependencies
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM sys_shared_services WHERE service_name = dep
      ) THEN
        missing_deps := array_append(missing_deps, dep);
      END IF;
    END LOOP;
    
    -- Return if there are issues
    IF array_length(missing_deps, 1) > 0 THEN
      RETURN QUERY SELECT 
        service_record.service_name,
        missing_deps,
        false; -- TODO: Implement circular dependency check
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add to table definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_infrastructure_services_view', 
        'View of all infrastructure services that manage resources',
        'Filter and monitor infrastructure services for health checks and resource management',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;

INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_business_services_view', 
        'View of all business logic services',
        'Track business services for testing and dependency injection patterns',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;

INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'sys_service_initialization_order_view', 
        'Computed initialization order for services with dependencies',
        'Ensure services are initialized in correct order during application startup',
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;