# Service Evaluation Action Plan - Immediate Steps

## Quick Start: What to Do Right Now

### Step 1: Run the Service Classification Scanner (Today)

Create and run this scanner to populate the new fields:

```bash
# Create the scanner
./scripts/cli-pipeline/services/services-cli.sh create-classification-scanner

# Run it
./scripts/cli-pipeline/services/services-cli.sh classify-all-services

# Check results
./scripts/cli-pipeline/services/services-cli.sh classification-report
```

### Step 2: Identify Your High-Value Services (Today)

Run this SQL to find your most-used services:

```sql
-- Find high-usage services that need attention
SELECT 
  service_name,
  usage_count,
  COALESCE(array_length(used_by_apps, 1), 0) as app_count,
  COALESCE(array_length(used_by_pipelines, 1), 0) as pipeline_count,
  service_type,
  instantiation_pattern
FROM sys_shared_services
WHERE usage_count > 5
  AND service_type IS NULL -- Not yet classified
ORDER BY usage_count DESC
LIMIT 20;
```

### Step 3: Quick Service Classification (This Week)

For each high-value service, answer these questions:

1. **Does it manage expensive resources?**
   - YES → `service_type = 'infrastructure'`
   - NO → Continue to #2

2. **Is it pure business logic?**
   - YES → `service_type = 'business'`
   - NO → `service_type = 'hybrid'`

3. **How is it instantiated?**
   - `getInstance()` → `instantiation_pattern = 'singleton'`
   - `new Service()` → `instantiation_pattern = 'dependency_injection'`
   - `createService()` → `instantiation_pattern = 'factory'`

4. **Where can it run?**
   - Uses `fs`, `path`, `process` → `environment_support = ['node']`
   - Uses `window`, `document` → `environment_support = ['browser']`
   - Neither/both → `environment_support = ['both']`

### Step 4: Find Duplicate Services (This Week)

```sql
-- Find services with similar names
SELECT 
  s1.service_name as service1,
  s2.service_name as service2,
  similarity(s1.service_name, s2.service_name) as name_similarity
FROM sys_shared_services s1
CROSS JOIN sys_shared_services s2
WHERE s1.service_name < s2.service_name
  AND similarity(s1.service_name, s2.service_name) > 0.6
ORDER BY name_similarity DESC;

-- Find services with overlapping functionality (manual review needed)
SELECT 
  service_name,
  description,
  category
FROM sys_shared_services
WHERE category IN (
  SELECT category 
  FROM sys_shared_services 
  GROUP BY category 
  HAVING COUNT(*) > 1
)
ORDER BY category, service_name;
```

## Proxy Server Refactoring Strategy

### Current State: Inline Logic in Proxy Servers

```javascript
// ❌ BAD: Logic embedded in server
app.post('/api/classify', async (req, res) => {
  const { content } = req.body;
  // 50 lines of classification logic here
  const result = await classify(content);
  res.json(result);
});
```

### Target State: Using Shared Services

```javascript
// ✅ GOOD: Using shared service
import { DocumentClassificationService } from '@shared/services';
const classificationService = new DocumentClassificationService(supabase);

app.post('/api/classify', async (req, res) => {
  const result = await classificationService.classify(req.body.content);
  res.json(result);
});
```

### Refactoring Process:

1. **Identify embedded logic in proxy servers**
   ```bash
   # Find proxy servers with inline logic
   grep -r "app\.(post|get|put|delete)" --include="*server*.js" --include="*server*.ts" -A 20
   ```

2. **Extract to shared service**
   - Create service in `packages/shared/services/`
   - Move logic from proxy server
   - Add proper error handling
   - Add TypeScript types

3. **Test both implementations**
   - Run existing proxy server tests
   - Create service unit tests
   - Ensure identical behavior

## Usage Tracking Implementation

### Add Usage Scanner Command

```typescript
// scripts/cli-pipeline/services/commands/scan-usage.ts
export async function scanServiceUsage(): Promise<void> {
  console.log('🔍 Scanning service usage across the monorepo...');
  
  const services = await getServicesFromDB();
  
  for (const service of services) {
    const usage = {
      apps: await findUsageInApps(service.service_name),
      pipelines: await findUsageInPipelines(service.service_name),
      proxyServers: await findUsageInProxyServers(service.service_name),
      services: await findUsageInOtherServices(service.service_name),
    };
    
    await updateServiceUsage(service.id, usage);
  }
  
  console.log('✅ Usage scan complete');
}
```

### Weekly Usage Report

```sql
-- Create a view for weekly usage reports
CREATE OR REPLACE VIEW sys_service_weekly_report AS
SELECT 
  service_name,
  service_type,
  COALESCE(service_type, '❓ Needs Classification') as classification_status,
  usage_count,
  CASE 
    WHEN usage_count = 0 THEN '🔴 Unused'
    WHEN usage_count < 3 THEN '🟡 Low Usage'
    WHEN usage_count < 10 THEN '🟢 Moderate Usage'
    ELSE '🌟 High Usage'
  END as usage_status,
  CASE
    WHEN overlaps_with IS NOT NULL THEN '⚠️ Has Duplicates'
    ELSE '✅ Unique'
  END as duplicate_status,
  array_length(used_by_apps, 1) as app_references,
  array_length(used_by_pipelines, 1) as pipeline_references,
  array_length(used_by_proxy_servers, 1) as proxy_references
FROM sys_shared_services
ORDER BY usage_count DESC;
```

## Testing Every Service

### 1. Add to dhg-service-test

For each service, create a test component:

```typescript
// apps/dhg-service-test/src/components/services/Test[ServiceName].tsx
export function TestMyService() {
  const [result, setResult] = useState<TestResult>();
  
  const runTest = async () => {
    try {
      // Test instantiation based on pattern
      const service = getServiceInstance(); // Based on service pattern
      
      // Test basic functionality
      const testResult = await service.someMethod();
      
      setResult({ status: 'success', data: testResult });
    } catch (error) {
      setResult({ status: 'error', error: error.message });
    }
  };
  
  return <TestUI onTest={runTest} result={result} />;
}
```

### 2. Automated Test Runner

```typescript
// Create test runner that checks all services
export async function testAllServices() {
  const services = await getServicesFromDB();
  const results = [];
  
  for (const service of services) {
    const result = await testService(service);
    results.push(result);
    
    // Update test results in DB
    await updateServiceTestResults(service.id, result);
  }
  
  return generateTestReport(results);
}
```

## Decision Framework

### When to Keep a Low-Usage Service:
- It's required by infrastructure
- It provides unique, critical functionality
- It's used by high-value features
- It's part of the public API

### When to Consolidate:
- Multiple services do similar things
- Low usage across the board
- High maintenance burden
- Better alternative exists

### When to Remove:
- Zero usage for 30+ days
- Functionality moved elsewhere
- No longer fits architecture
- Security or performance issues

## Daily Checklist

- [ ] Classify 5 services
- [ ] Review usage report
- [ ] Test 3 services in dhg-service-test
- [ ] Check for new duplicate candidates
- [ ] Update consolidation progress

## Weekly Goals

- [ ] Week 1: Classify all high-usage services
- [ ] Week 2: Complete usage scanning
- [ ] Week 3: Consolidate obvious duplicates
- [ ] Week 4: Refactor one proxy server
- [ ] Week 5: Achieve 80% classification coverage

## Red Flags to Watch For

1. **Services with 0 usage** - Investigate immediately
2. **Services without tests** - Add to testing queue
3. **Singleton business services** - Refactor to DI
4. **DI infrastructure services** - Refactor to singleton
5. **Node-only services used in browser** - Need adapter

## Quick Wins

1. **Merge these obvious duplicates**:
   - FileService + FileManagerService → FileService
   - Logger + LoggingService → Logger
   - AuthService + AuthenticationService → AuthService

2. **Remove these unused services** (after verification):
   - Any service with 0 usage for 30+ days
   - Deprecated services still in codebase
   - Test/example services in production

3. **Quick refactors**:
   - Convert singleton business services to DI
   - Add browser adapters for Node-only services
   - Extract inline proxy server logic

## Tracking Progress

```sql
-- Daily progress check
SELECT 
  COUNT(*) FILTER (WHERE service_type IS NOT NULL) as classified,
  COUNT(*) FILTER (WHERE service_type IS NULL) as unclassified,
  COUNT(*) FILTER (WHERE usage_count > 0) as used,
  COUNT(*) FILTER (WHERE usage_count = 0) as unused,
  COUNT(*) FILTER (WHERE test_coverage_percent >= 80) as well_tested,
  COUNT(*) FILTER (WHERE test_coverage_percent < 80 OR test_coverage_percent IS NULL) as needs_testing
FROM sys_shared_services;
```

## Remember

- **Don't break anything** - Test before removing/consolidating
- **Document decisions** - Why did you consolidate/remove?
- **Incremental progress** - Small daily improvements
- **Usage drives decisions** - Let data guide you
- **Proxy servers are services too** - Refactor to use shared services