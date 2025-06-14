# Service Type Tracking Implementation Spec

## Overview

This document specifies the implementation of service type tracking in the `sys_shared_services` table to support automated testing, monitoring, and deployment of services based on their classification.

## Database Schema Enhancement

### 1. Add Classification Fields to sys_shared_services

```sql
-- Migration: Add service classification fields
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

-- Add comments for documentation
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
```

### 2. Create Helper Views

```sql
-- View for infrastructure services
CREATE OR REPLACE VIEW sys_infrastructure_services_view AS
SELECT 
  service_name,
  file_path,
  instantiation_pattern,
  environment_support,
  requires_initialization,
  initialization_dependencies,
  resource_management,
  is_browser_compatible,
  usage_count
FROM sys_shared_services
WHERE service_type = 'infrastructure'
ORDER BY service_name;

-- View for business services  
CREATE OR REPLACE VIEW sys_business_services_view AS
SELECT 
  service_name,
  file_path,
  instantiation_pattern,
  environment_support,
  dependencies,
  is_browser_compatible,
  usage_count
FROM sys_shared_services
WHERE service_type = 'business'
ORDER BY service_name;

-- View for initialization order
CREATE OR REPLACE VIEW sys_service_initialization_order_view AS
WITH RECURSIVE init_order AS (
  -- Base: services with no dependencies
  SELECT 
    service_name,
    initialization_dependencies,
    0 as init_level
  FROM sys_shared_services
  WHERE requires_initialization = true
    AND (initialization_dependencies IS NULL OR array_length(initialization_dependencies, 1) = 0)
  
  UNION ALL
  
  -- Recursive: services that depend on previous level
  SELECT 
    s.service_name,
    s.initialization_dependencies,
    io.init_level + 1
  FROM sys_shared_services s
  JOIN init_order io ON s.initialization_dependencies @> ARRAY[io.service_name]
  WHERE s.requires_initialization = true
)
SELECT * FROM init_order ORDER BY init_level, service_name;
```

### 3. Update Existing Services

```sql
-- Infrastructure Services
UPDATE sys_shared_services SET
  service_type = 'infrastructure',
  instantiation_pattern = 'singleton',
  requires_initialization = true,
  resource_management = '{"type": "database_connection", "pool_size": 10}'::jsonb
WHERE service_name = 'SupabaseClientService';

UPDATE sys_shared_services SET
  service_type = 'infrastructure',
  instantiation_pattern = 'singleton',
  environment_support = ARRAY['node']::TEXT[],
  resource_management = '{"type": "api_connection", "rate_limit": "1000/day"}'::jsonb
WHERE service_name = 'claude-service';

UPDATE sys_shared_services SET
  service_type = 'infrastructure',
  instantiation_pattern = 'singleton',
  requires_initialization = true,
  initialization_dependencies = ARRAY['SupabaseClientService']::TEXT[]
WHERE service_name = 'BrowserAuthService';

-- Business Services
UPDATE sys_shared_services SET
  service_type = 'business',
  instantiation_pattern = 'dependency_injection',
  environment_support = ARRAY['both']::TEXT[]
WHERE service_name IN ('CLIRegistryService', 'DocumentClassificationService', 'PromptService');

-- Hybrid Services
UPDATE sys_shared_services SET
  service_type = 'hybrid',
  instantiation_pattern = 'factory',
  environment_support = ARRAY['both']::TEXT[],
  resource_management = '{"browser": "localStorage", "node": "filesystem"}'::jsonb
WHERE service_name = 'FileService';
```

## Implementation Guidelines

### 1. Service Registration

When adding new services, always classify them:

```typescript
// In service implementation file
/**
 * @service-type infrastructure
 * @pattern singleton
 * @environments node
 * @initialization-required true
 * @dependencies []
 * @resources {"type": "websocket", "max_connections": 100}
 */
export class WebSocketService {
  private static instance: WebSocketService;
  // ...
}
```

### 2. Automated Classification Script

```typescript
// scripts/cli-pipeline/services/classify-service.ts
import { SupabaseClientService } from '@shared/services/supabase-client';

async function classifyService(servicePath: string) {
  const content = await fs.readFile(servicePath, 'utf8');
  
  // Parse JSDoc comments
  const serviceType = extractServiceType(content);
  const pattern = extractPattern(content);
  const environments = extractEnvironments(content);
  
  // Auto-detect if not specified
  if (!serviceType) {
    if (content.includes('static instance') || content.includes('getInstance()')) {
      serviceType = 'infrastructure';
    } else if (content.includes('constructor(')) {
      serviceType = 'business';
    }
  }
  
  // Update database
  const supabase = SupabaseClientService.getInstance().getClient();
  await supabase
    .from('sys_shared_services')
    .update({
      service_type: serviceType,
      instantiation_pattern: pattern,
      environment_support: environments
    })
    .eq('file_path', servicePath);
}
```

### 3. Testing Integration

```typescript
// Use classification to determine test strategy
async function testService(serviceName: string) {
  const { data: service } = await supabase
    .from('sys_shared_services')
    .select('*')
    .eq('service_name', serviceName)
    .single();
    
  switch (service.service_type) {
    case 'infrastructure':
      return testInfrastructureService(service);
    case 'business':
      return testBusinessService(service);
    case 'hybrid':
      return testHybridService(service);
  }
}

function testInfrastructureService(service: ServiceRecord) {
  // Test singleton behavior
  // Test resource management
  // Test cleanup/shutdown
}

function testBusinessService(service: ServiceRecord) {
  // Test with mock dependencies
  // Test business logic
  // Test multiple instances
}
```

### 4. Monitoring Integration

```sql
-- Monitor infrastructure service health
CREATE OR REPLACE FUNCTION check_infrastructure_services()
RETURNS TABLE (
  service_name TEXT,
  status TEXT,
  resource_usage JSONB,
  last_health_check TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.service_name,
    CASE 
      WHEN sm.last_check > NOW() - INTERVAL '5 minutes' THEN 'healthy'
      WHEN sm.last_check IS NULL THEN 'unknown'
      ELSE 'stale'
    END as status,
    sm.resource_metrics,
    sm.last_check
  FROM sys_shared_services s
  LEFT JOIN sys_service_monitoring sm ON s.service_name = sm.service_name
  WHERE s.service_type = 'infrastructure';
END;
$$ LANGUAGE plpgsql;
```

### 5. Deployment Validation

```typescript
// Pre-deployment check
async function validateServiceDependencies() {
  // Get initialization order
  const { data: initOrder } = await supabase
    .from('sys_service_initialization_order_view')
    .select('*')
    .order('init_level', { ascending: true });
    
  // Verify all infrastructure services are available
  for (const service of initOrder) {
    if (!await isServiceAvailable(service.service_name)) {
      throw new Error(`Required service ${service.service_name} not available`);
    }
  }
}
```

## Benefits

1. **Automated Testing**: Test strategy based on service type
2. **Initialization Order**: Automatic dependency resolution
3. **Environment Validation**: Ensure services run in correct environment
4. **Resource Monitoring**: Track infrastructure service health
5. **Documentation**: Self-documenting service registry
6. **Deployment Safety**: Validate dependencies before deployment

## Migration Path

1. Run the ALTER TABLE migration
2. Execute UPDATE statements for known services
3. Run classification script on remaining services
4. Add validation to CI/CD pipeline
5. Update service templates with classification metadata

## Future Enhancements

1. **Service Graph Visualization**: Show dependency relationships
2. **Automatic Mock Generation**: Create mocks based on service type
3. **Performance Profiling**: Different metrics for different service types
4. **Security Auditing**: Validate resource access patterns
5. **Cost Tracking**: Monitor infrastructure service costs