# Service Consolidation and Evaluation Strategy

## Executive Summary

This document outlines a systematic approach to evaluate, consolidate, and optimize all services in the DHG monorepo. The goal is to create a single, clean set of well-documented, highly-tested services that work across all contexts (browser apps, CLI pipelines, and proxy servers).

## Current State Analysis

### What We Have
1. **Enhanced sys_shared_services table** with classification fields (but not yet populated)
2. **dhg-service-test app** for browser service testing
3. **dhg-admin-code testing page** for additional testing
4. **Continuous monitoring tools** (in development)
5. **Master list of services** (but lacking usage data)
6. **Multiple proxy servers** that may duplicate service functionality

### What We Need
1. **Complete service inventory** with all classification fields populated
2. **Usage metrics** showing which objects use each service
3. **Duplicate detection** to identify overlapping services
4. **Consolidation plan** for low-usage and duplicate services
5. **Proxy server refactoring** to use shared services
6. **Comprehensive testing** across all environments

## Phase 1: Service Discovery and Classification (Week 1-2)

### 1.1 Automated Service Scanner Enhancement

Create an enhanced scanner that captures:
- Service type (infrastructure/business/hybrid)
- Instantiation pattern (singleton/DI/factory)
- Environment support (browser/node/both)
- Actual usage locations
- Duplicate candidates

```typescript
// scripts/cli-pipeline/services/deep-service-scanner.ts
interface ServiceScanResult {
  service: ServiceRecord;
  usage: {
    apps: { name: string; imports: string[] }[];
    pipelines: { name: string; commands: string[] }[];
    proxyServers: { name: string; endpoints: string[] }[];
    services: { name: string; dependency: string }[];
  };
  classification: {
    type: 'infrastructure' | 'business' | 'hybrid';
    pattern: 'singleton' | 'dependency_injection' | 'factory';
    environments: ('browser' | 'node')[];
    resourceManagement?: any;
  };
  duplicates: {
    service: string;
    similarity: number;
    overlappingMethods: string[];
  }[];
}
```

### 1.2 Manual Review Process

For each service, determine:
1. **Primary purpose** - What problem does it solve?
2. **Resource management** - Does it manage expensive resources?
3. **State management** - Does it maintain global state?
4. **Environment needs** - Where does it need to run?
5. **Dependencies** - What does it depend on?
6. **Initialization** - Does it need explicit initialization?

### 1.3 Classification SQL Updates

```sql
-- Create tracking table for evaluation progress
CREATE TABLE sys_service_evaluation_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service_name TEXT REFERENCES sys_shared_services(service_name),
  evaluated_at TIMESTAMP DEFAULT NOW(),
  evaluated_by TEXT,
  classification_complete BOOLEAN DEFAULT FALSE,
  usage_scan_complete BOOLEAN DEFAULT FALSE,
  duplicate_check_complete BOOLEAN DEFAULT FALSE,
  consolidation_decision TEXT CHECK (consolidation_decision IN 
    ('keep', 'merge', 'deprecate', 'refactor')),
  notes TEXT
);
```

## Phase 2: Usage Analysis and Metrics (Week 2-3)

### 2.1 Usage Tracking Implementation

Enhance sys_shared_services with detailed usage tracking:

```sql
-- Add detailed usage tracking
ALTER TABLE sys_shared_services
ADD COLUMN usage_details JSONB DEFAULT '{
  "apps": [],
  "pipelines": [], 
  "proxyServers": [],
  "services": [],
  "totalReferences": 0,
  "lastUpdated": null
}'::jsonb;

-- Create materialized view for usage analytics
CREATE MATERIALIZED VIEW sys_service_usage_analytics AS
SELECT 
  s.service_name,
  s.service_type,
  jsonb_array_length(s.usage_details->'apps') as app_count,
  jsonb_array_length(s.usage_details->'pipelines') as pipeline_count,
  jsonb_array_length(s.usage_details->'proxyServers') as proxy_count,
  jsonb_array_length(s.usage_details->'services') as service_count,
  (s.usage_details->>'totalReferences')::int as total_references,
  CASE 
    WHEN (s.usage_details->>'totalReferences')::int = 0 THEN 'unused'
    WHEN (s.usage_details->>'totalReferences')::int = 1 THEN 'single-use'
    WHEN (s.usage_details->>'totalReferences')::int < 5 THEN 'low-usage'
    WHEN (s.usage_details->>'totalReferences')::int < 10 THEN 'moderate-usage'
    ELSE 'high-usage'
  END as usage_category
FROM sys_shared_services s;
```

### 2.2 Usage Scanner Implementation

```typescript
// scripts/cli-pipeline/services/scan-service-usage.ts
async function scanServiceUsage() {
  // Scan all apps
  const apps = await glob('apps/*/src/**/*.{ts,tsx,js,jsx}');
  
  // Scan all CLI pipelines
  const pipelines = await glob('scripts/cli-pipeline/**/*.{ts,js}');
  
  // Scan proxy servers
  const proxyServers = await glob('**/*-server.{js,ts,cjs,mjs}');
  
  // For each service, find all imports/requires
  for (const service of services) {
    const usage = await findAllUsages(service);
    await updateServiceUsage(service.service_name, usage);
  }
}
```

### 2.3 Duplicate Detection Algorithm

```typescript
interface DuplicateDetection {
  // Method signature analysis
  compareMethodSignatures(service1: Service, service2: Service): number;
  
  // Dependency overlap analysis  
  compareDependencies(service1: Service, service2: Service): number;
  
  // Purpose similarity (using AI)
  comparePurpose(service1: Service, service2: Service): number;
  
  // Overall similarity score
  calculateSimilarity(service1: Service, service2: Service): {
    score: number; // 0-100
    overlappingMethods: string[];
    recommendation: 'merge' | 'keep-both' | 'refactor';
  };
}
```

## Phase 3: Service Consolidation (Week 3-4)

### 3.1 Consolidation Decision Matrix

| Usage | Duplicates | Action |
|-------|------------|--------|
| High | Yes | Merge carefully, maintain all interfaces |
| High | No | Keep, ensure well-tested |
| Low | Yes | Merge into dominant service |
| Low | No | Evaluate for removal or generalization |
| Single | Any | Consider inlining or generalizing |

### 3.2 Consolidation Process

1. **Identify candidates**
   ```sql
   SELECT * FROM sys_service_usage_analytics 
   WHERE usage_category IN ('unused', 'single-use', 'low-usage')
   OR service_name IN (
     SELECT service_name FROM sys_shared_services 
     WHERE overlaps_with IS NOT NULL
   );
   ```

2. **Create consolidation plan**
   - Map duplicate methods to consolidated service
   - Plan migration path for consumers
   - Create compatibility layer if needed

3. **Execute consolidation**
   - Create new consolidated service
   - Add deprecation notices
   - Update all consumers
   - Remove old services

### 3.3 Proxy Server Refactoring Strategy

```typescript
// Before: Proxy server with inline logic
app.post('/api/classify-document', async (req, res) => {
  // Inline classification logic
  const result = await classifyDocument(req.body);
  res.json(result);
});

// After: Using shared service
import { DocumentClassificationService } from '@shared/services';

app.post('/api/classify-document', async (req, res) => {
  const service = new DocumentClassificationService(supabase);
  const result = await service.classify(req.body);
  res.json(result);
});
```

## Phase 4: Testing and Validation (Week 4-5)

### 4.1 Comprehensive Test Suite

For each service, ensure:
1. **Unit tests** - Test in isolation
2. **Integration tests** - Test with dependencies
3. **Environment tests** - Test in each supported environment
4. **Performance tests** - Ensure no regression

### 4.2 Test Coverage Requirements

```typescript
interface ServiceTestRequirements {
  unitTestCoverage: number; // minimum 80%
  integrationTests: string[]; // required scenarios
  environmentTests: {
    browser?: boolean;
    node?: boolean;
    proxyServer?: boolean;
  };
  performanceBenchmarks: {
    initTime: number;
    methodCallTime: Record<string, number>;
    memoryUsage: number;
  };
}
```

### 4.3 dhg-service-test Integration

Enhance dhg-service-test to:
1. Automatically test all browser-compatible services
2. Generate compatibility reports
3. Performance benchmark comparisons
4. Track test history

## Phase 5: Continuous Monitoring (Ongoing)

### 5.1 Service Health Dashboard

Create dashboard showing:
- Service classification status
- Usage metrics and trends
- Test coverage and results
- Performance metrics
- Consolidation progress

### 5.2 Automated Checks

```sql
-- Daily health check
CREATE OR REPLACE FUNCTION check_service_health()
RETURNS TABLE (
  service_name TEXT,
  health_status TEXT,
  issues TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.service_name,
    CASE
      WHEN s.service_type IS NULL THEN 'needs-classification'
      WHEN usage->>'totalReferences' = '0' THEN 'unused'
      WHEN s.test_coverage_percent < 80 THEN 'low-coverage'
      ELSE 'healthy'
    END,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN s.service_type IS NULL THEN 'Missing classification' END,
      CASE WHEN usage->>'totalReferences' = '0' THEN 'No usage found' END,
      CASE WHEN s.test_coverage_percent < 80 THEN 'Low test coverage' END
    ], NULL)
  FROM sys_shared_services s;
END;
$$ LANGUAGE plpgsql;
```

### 5.3 Service Registry API

Create API for services to register themselves:

```typescript
// In each service file
ServiceRegistry.register({
  name: 'MyService',
  type: 'business',
  pattern: 'dependency_injection',
  environments: ['browser', 'node'],
  dependencies: ['SupabaseClient', 'Logger'],
  exports: ['doSomething', 'doSomethingElse'],
  version: '1.0.0'
});
```

## Implementation Timeline

### Week 1-2: Discovery & Classification
- [ ] Enhance service scanner
- [ ] Run initial classification
- [ ] Manual review of ambiguous cases
- [ ] Update sys_shared_services

### Week 2-3: Usage Analysis
- [ ] Implement usage scanner
- [ ] Run duplicate detection
- [ ] Generate consolidation candidates
- [ ] Create consolidation plan

### Week 3-4: Consolidation
- [ ] Merge duplicate services
- [ ] Refactor proxy servers
- [ ] Update all consumers
- [ ] Remove deprecated services

### Week 4-5: Testing & Validation
- [ ] Implement comprehensive tests
- [ ] Run environment compatibility tests
- [ ] Performance benchmarking
- [ ] Fix any issues found

### Week 5+: Monitoring
- [ ] Deploy health dashboard
- [ ] Set up automated checks
- [ ] Monitor usage trends
- [ ] Continuous improvement

## Success Metrics

1. **Service Count**: Reduce total services by 20-30% through consolidation
2. **Test Coverage**: 100% of services have >80% test coverage
3. **Classification**: 100% of services fully classified
4. **Usage Tracking**: 100% accurate usage data
5. **Performance**: No performance regression after consolidation
6. **Proxy Servers**: All proxy servers using shared services

## Key Principles

1. **Don't break existing functionality** - Use deprecation and compatibility layers
2. **Test everything** - Comprehensive testing before and after changes
3. **Document decisions** - Why services were consolidated or kept
4. **Incremental changes** - Small, testable changes over big rewrites
5. **Usage-driven decisions** - Let actual usage guide consolidation

## Next Steps

1. Review and approve this strategy
2. Create tracking issues for each phase
3. Assign team members to phases
4. Begin Phase 1 implementation
5. Weekly progress reviews

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|---------|------------|
| Breaking changes | High | Comprehensive testing, gradual migration |
| Performance regression | Medium | Benchmark before/after, rollback plan |
| Missing dependencies | Medium | Thorough scanning, manual review |
| Over-consolidation | Low | Keep services with distinct purposes separate |

## Conclusion

This strategy provides a systematic approach to creating a clean, well-tested, and properly classified service layer. By following this plan, we'll achieve:
- Single source of truth for each capability
- Clear understanding of service usage
- Optimal service architecture
- Comprehensive testing coverage
- Continuous monitoring and improvement

The key is to proceed systematically, test thoroughly, and make data-driven decisions based on actual usage patterns.