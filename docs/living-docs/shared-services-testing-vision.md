# Shared Services Testing Vision and Implementation Plan
*Updated: June 10, 2025*

## Executive Summary

This document outlines a comprehensive testing strategy for the 37 active shared services in our monorepo. The testing approach prioritizes edge cases, quick execution, and automated validation while leveraging our existing registry database for intelligent test orchestration.

## Testing Philosophy

### Core Principles
1. **Edge-Case Priority**: Focus testing on boundary conditions, error states, and integration points
2. **Quick Execution**: All service tests should complete in <30 seconds total
3. **Registry-Driven**: Use sys_shared_services table to dynamically generate test suites
4. **Real-World Validation**: Test against actual usage patterns from apps and pipelines
5. **Continuous Integration**: Automated testing on every shared service change

### Testing Pyramid for Services
```
┌─────────────────────────────────────┐
│  Integration Tests (30%)            │ ← Service-to-service communication
├─────────────────────────────────────┤
│  Unit Tests (60%)                   │ ← Individual service methods
├─────────────────────────────────────┤
│  Contract Tests (10%)               │ ← API/interface validation
└─────────────────────────────────────┘
```

## Current Service Landscape Analysis

Based on `sys_shared_services` registry data:

### Service Categories by Usage Intensity
- **High Usage (5+ apps)**: 8 services (e.g., SupabaseClientService, FileService)
- **Medium Usage (2-4 apps)**: 12 services (e.g., FilterService, GoogleDriveService)
- **Low Usage (1 app)**: 17 services (specialized utilities)

### Critical Services Requiring Priority Testing
1. **SupabaseClientService** - Used by 8+ apps, singleton pattern critical
2. **FileService** - File operations across multiple environments
3. **FilterService** - Recently enhanced with filterType parameter
4. **GoogleDriveService** - Dual access patterns (server/local)
5. **ClaudeService** - AI processing with rate limiting

## Implementation Architecture

### 1. Test Infrastructure Setup

**Test Runner Framework**:
```typescript
// packages/shared/testing/service-test-runner.ts
interface ServiceTestConfig {
  serviceName: string;
  testTypes: ('unit' | 'integration' | 'contract')[];
  dependencies: string[];
  mockRequirements: string[];
  timeoutMs: number;
}

class ServiceTestRunner {
  async runTestSuite(config: ServiceTestConfig): Promise<TestResults>;
  async validateServiceHealth(): Promise<HealthReport>;
  async testCrossServiceIntegration(): Promise<IntegrationReport>;
}
```

**Registry Integration**:
```sql
-- Enhanced service registry for test planning
CREATE VIEW sys_service_testing_view AS
SELECT 
  ss.service_name,
  ss.category,
  ss.used_by_apps,
  ss.used_by_pipelines,
  ss.last_validated,
  CASE 
    WHEN array_length(ss.used_by_apps, 1) >= 5 THEN 'critical'
    WHEN array_length(ss.used_by_apps, 1) >= 2 THEN 'important'
    ELSE 'standard'
  END as test_priority,
  sd.dependencies,
  sd.dependency_count
FROM sys_shared_services ss
LEFT JOIN sys_service_dependencies_view sd ON sd.service_name = ss.service_name
WHERE ss.status = 'active'
ORDER BY test_priority DESC, ss.service_name;
```

### 2. Test Types and Strategies

#### A. Unit Tests (60% of effort)
**Focus Areas**:
- Singleton pattern enforcement
- Environment variable handling
- Error boundary conditions
- Type safety validation

**Example Test Structure**:
```typescript
// packages/shared/services/__tests__/supabase-client.test.ts
describe('SupabaseClientService', () => {
  describe('Singleton Pattern', () => {
    test('should return same instance across calls');
    test('should throw error when accessed before initialization');
    test('should handle concurrent initialization attempts');
  });
  
  describe('Environment Handling', () => {
    test('should fail gracefully with missing SUPABASE_URL');
    test('should validate SUPABASE_ANON_KEY format');
    test('should handle malformed environment variables');
  });
});
```

#### B. Integration Tests (30% of effort)
**Cross-Service Testing**:
- Service dependency chains
- Database connection pooling
- Authentication flow validation
- Rate limiting interactions

**Example Integration Scenarios**:
```typescript
describe('Service Integration', () => {
  test('FileService + SupabaseClientService: file upload with metadata');
  test('FilterService + SupabaseClientService: query optimization');
  test('ClaudeService + rate limiting under load');
});
```

#### C. Contract Tests (10% of effort)
**Interface Validation**:
- Public API stability
- Return type consistency
- Error message formats

### 3. Edge Case Priority Matrix

| Service Category | High Priority Edge Cases |
|-----------------|-------------------------|
| **Database Services** | Connection timeouts, RLS policy failures, concurrent access |
| **External APIs** | Rate limits, network failures, authentication expiry |
| **File Operations** | Large files, permission errors, disk space limits |
| **Authentication** | Token expiry, invalid credentials, network interruption |
| **Utility Services** | Null/undefined inputs, malformed data, memory limits |

### 4. Automated Test Orchestration

#### Test Execution Pipeline
```typescript
// scripts/cli-pipeline/testing/run-service-tests.ts
class ServiceTestOrchestrator {
  async runAllTests(): Promise<TestReport> {
    const services = await this.getServicesFromRegistry();
    const results = await Promise.allSettled(
      services.map(service => this.runServiceTests(service))
    );
    return this.generateReport(results);
  }
  
  async runCriticalServicesOnly(): Promise<TestReport> {
    const criticalServices = await this.getCriticalServices();
    return this.runTestBatch(criticalServices);
  }
}
```

#### Performance Benchmarks
- **Individual Service Tests**: <2 seconds each
- **Integration Test Suite**: <10 seconds total
- **Full Test Suite**: <30 seconds total
- **Critical Services Only**: <15 seconds

### 5. UI Integration in dhg-admin-code

#### Test Management Dashboard
**Features**:
- Real-time test execution status
- Service health visualization
- Test history and trends
- Failure analysis and debugging

**Implementation Plan**:
```typescript
// apps/dhg-admin-code/src/components/TestingDashboard.tsx
interface TestingDashboardProps {
  services: ServiceTestStatus[];
  onRunTests: (serviceNames: string[]) => Promise<void>;
  onViewResults: (serviceName: string) => void;
}

// Integration with existing dhg-admin-code patterns
const TestingDashboard: React.FC<TestingDashboardProps> = ({ ... }) => {
  // Use existing useSupabase() pattern
  // Leverage existing UI components (tables, charts, modals)
  // Follow existing routing and navigation patterns
};
```

#### Database Integration
**New Tables**:
```sql
-- Test execution tracking
CREATE TABLE sys_service_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL REFERENCES sys_shared_services(service_name),
  test_type TEXT NOT NULL CHECK (test_type IN ('unit', 'integration', 'contract')),
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'skipped')),
  execution_time_ms INTEGER,
  error_message TEXT,
  test_details JSONB,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by TEXT
);

-- Test result aggregation view
CREATE VIEW sys_service_test_health_view AS
SELECT 
  s.service_name,
  s.category,
  COUNT(tr.id) as total_runs,
  COUNT(CASE WHEN tr.status = 'passed' THEN 1 END) as passed_runs,
  COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed_runs,
  AVG(tr.execution_time_ms) as avg_execution_time,
  MAX(tr.executed_at) as last_test_run,
  CASE 
    WHEN COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) = 0 THEN 'healthy'
    WHEN COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) <= 2 THEN 'warning'
    ELSE 'critical'
  END as health_status
FROM sys_shared_services s
LEFT JOIN sys_service_test_runs tr ON tr.service_name = s.service_name
WHERE s.status = 'active'
  AND (tr.executed_at > NOW() - INTERVAL '7 days' OR tr.executed_at IS NULL)
GROUP BY s.service_name, s.category;
```

### 6. Implementation Phases

#### Phase 1: Foundation (Week 1)
- [ ] Set up test runner infrastructure
- [ ] Create test database tables and views
- [ ] Implement basic unit test templates
- [ ] Test 5 critical services (SupabaseClient, File, Filter, GoogleDrive, Claude)

#### Phase 2: Coverage Expansion (Week 2)
- [ ] Add integration test framework
- [ ] Test remaining 32 services
- [ ] Implement automated test execution
- [ ] Create performance benchmarks

#### Phase 3: UI Integration (Week 3)
- [ ] Build testing dashboard in dhg-admin-code
- [ ] Add real-time test monitoring
- [ ] Implement test history and analytics
- [ ] Create failure notification system

#### Phase 4: Automation & Optimization (Week 4)
- [ ] Set up CI/CD integration
- [ ] Implement smart test selection (only test changed services)
- [ ] Add load testing for critical services
- [ ] Create test maintenance automation

### 7. Test Data Management

#### Mock Data Strategy
```typescript
// packages/shared/testing/mock-data-factory.ts
class MockDataFactory {
  static createSupabaseRecord(table: string, overrides?: Partial<any>): any;
  static createGoogleDriveFile(type: 'audio' | 'document' | 'video'): any;
  static createAuthProfile(role: 'admin' | 'user'): any;
  static createErrorScenario(type: 'network' | 'auth' | 'validation'): any;
}
```

#### Test Environment Isolation
- **Database**: Separate test schema with reset capabilities
- **External APIs**: Mock servers for Google Drive, Claude API
- **File System**: Temporary directories with automatic cleanup
- **Authentication**: Test user accounts with controlled permissions

### 8. Quality Gates and Success Metrics

#### Minimum Quality Standards
- **Test Coverage**: >80% line coverage for critical services
- **Performance**: All tests complete in <30 seconds
- **Reliability**: <1% flaky test rate
- **Documentation**: Every service has test documentation

#### Success Metrics
- **Service Reliability**: 99.9% uptime for critical services
- **Bug Detection**: 90% of bugs caught by tests before deployment
- **Development Speed**: 50% reduction in service-related debugging time
- **Confidence Level**: Developers comfortable making service changes

### 9. Maintenance and Evolution

#### Continuous Improvement
- **Monthly Test Review**: Identify slow or flaky tests
- **Quarterly Coverage Audit**: Ensure new functionality is tested
- **Annual Strategy Review**: Evolve testing approach based on learnings
- **Performance Monitoring**: Track test execution time trends

#### Test Maintenance Automation
```typescript
// Automated test health monitoring
class TestMaintenanceService {
  async detectFlakyTests(): Promise<FlakyTestReport>;
  async optimizeSlowTests(): Promise<OptimizationReport>;
  async updateTestsForServiceChanges(): Promise<UpdateReport>;
  async generateCoverageReport(): Promise<CoverageReport>;
}
```

## Conclusion

This comprehensive testing strategy transforms our shared services from a collection of utilities into a robust, well-tested foundation for the entire monorepo. By leveraging our registry database, focusing on edge cases, and providing excellent developer tooling through dhg-admin-code, we ensure that our 37 active services remain reliable, performant, and maintainable.

The phased implementation approach allows us to start seeing benefits immediately while building toward a comprehensive testing ecosystem that scales with our growing service landscape.

---
*This document is part of the continuously-updated documentation system and will evolve as the testing implementation progresses.*