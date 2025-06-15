# Continuous Improvement Scenario: Add New Proxy Server

## Scenario ID: `add-new-proxy-server`
**Category**: Infrastructure
**Complexity**: Medium
**Estimated Time**: 30-45 minutes
**Last Updated**: 2025-06-15

## Critical Evaluation Gates

### Pre-Execution Evaluation Checklist

#### 1. Necessity Evaluation ⚠️ CRITICAL
- [ ] **Existing Solution Search**: Have you searched for existing proxy servers that could handle this functionality?
  ```bash
  # Required searches:
  grep -r "similar_functionality" scripts/cli-pipeline/proxy/
  ls scripts/cli-pipeline/proxy/start-*.ts | grep -i related_terms
  ```
- [ ] **Usage Justification**: Is there demonstrated need for a new proxy vs. extending existing ones?
- [ ] **Complexity Assessment**: Will this add unnecessary complexity to the proxy ecosystem?

#### 2. Architecture Fit Analysis
- [ ] **Port Availability**: Is the requested port actually needed or could we consolidate?
- [ ] **Service Integration**: Are the backing services already tested and proven?
- [ ] **CLI Pipeline Fit**: Does this belong in the proxy pipeline or would another be better?

#### 3. Deprecation Opportunity
- [ ] **Consolidation Check**: Could we combine this with an existing proxy instead?
- [ ] **Legacy Cleanup**: Are there old proxies we should remove to make room for this?

### Manual Code Review Requirements
Before proceeding, complete these searches and document findings:

```bash
# Search for similar functionality
rg -i "similar_endpoints|related_features" scripts/cli-pipeline/proxy/

# Check existing proxy health
./scripts/cli-pipeline/proxy/start-all-proxy-servers.ts --health-check

# Review proxy usage statistics
psql -c "SELECT service_name, last_health_check, status FROM sys_server_ports_registry WHERE service_name LIKE '%proxy%'"

# Check for deprecated proxies
find scripts/cli-pipeline/proxy/ -name "*.deprecated" -o -name "*archived*"
```

### Sign-Off Gate
- [ ] **Technical Review**: All automated checks pass and manual review completed
- [ ] **Architecture Review**: Fits multi-agent development model and maintains simplicity
- [ ] **Resource Review**: Development and maintenance effort justified
- [ ] **Strategic Review**: Aligns with monorepo goals and proxy strategy

## Overview
This scenario documents the complete process for adding a new proxy server to the DHG monorepo infrastructure. Proxy servers provide HTTP endpoints for UI apps to interact with backend processes, file systems, and external services.

**⚠️ WARNING**: Only proceed if critical evaluation gates above have been satisfied.

## Prerequisites
- Available port number (check CLAUDE.md Port Registry)
- Clear understanding of the proxy server's purpose
- TypeScript and Express.js knowledge

## Step-by-Step Process

### 1. Reserve Port Number
**File**: `CLAUDE.md`
**Section**: Port Registry (around line 570)

```markdown
- [your-proxy-name]: [port] ([description])
```

**Action**: 
1. Find the "Proxy Servers" section
2. Check reserved port ranges (9876-9899)
3. Add your proxy with next available port
4. Update reserved range if needed

**Example**:
```markdown
- test-runner-proxy: 9891 (Test runner for refactored services with real-time UI updates)
- [Reserved: 9892-9899 for future proxy servers]
```

### 2. Create Proxy Server Script
**Location**: `scripts/cli-pipeline/proxy/start-[your-proxy-name].ts`

**Template Structure**:
```typescript
#!/usr/bin/env ts-node

import express from 'express';
import cors from 'cors';
import { [RequiredServices] } from '@shared/services/[service-name]';

const app = express();
const PORT = [YOUR_PORT]; // From CLAUDE.md

// Enable CORS for UI apps
app.use(cors());
app.use(express.json());

// Health check endpoint (REQUIRED)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: '[your-proxy-name]',
    port: PORT
  });
});

// Your endpoints here
app.post('/your-endpoint', async (req, res) => {
  // Implementation
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 [Your Proxy Name] running on http://localhost:${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   GET    /health                 - Health check`);
  console.log(`   [YOUR ENDPOINTS]`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down [Your Proxy Name]...');
  process.exit(0);
});
```

**Key Requirements**:
- Must have `/health` endpoint returning `{ status: 'ok', service: '[name]', port: [number] }`
- Use existing shared services when possible
- Include CORS for browser access
- Proper error handling
- Graceful shutdown handling

### 3. Add to Package.json
**File**: `package.json` (root)
**Section**: Proxy server scripts (around line 15-30)

```json
"proxy:[your-name]": "ts-node scripts/cli-pipeline/proxy/start-[your-proxy-name].ts",
```

**Example**:
```json
"proxy:test-runner": "ts-node scripts/cli-pipeline/proxy/start-test-runner-proxy.ts",
```

### 4. Add to All Proxy Servers Script
**File**: `scripts/cli-pipeline/proxy/start-all-proxy-servers.ts`
**Section**: PROXY_SERVERS array

```typescript
{
  name: '[Your Proxy Display Name]',
  port: [YOUR_PORT],
  scriptPath: 'start-[your-proxy-name].ts',
  status: 'stopped',
  healthEndpoint: '/health'
}
```

**Example**:
```typescript
{
  name: 'Test Runner',
  port: 9891,
  scriptPath: 'start-test-runner-proxy.ts',
  status: 'stopped',
  healthEndpoint: '/health'
}
```

### 5. Create Database Migration
**File**: `supabase/migrations/[date]_add_[your_proxy_name].sql`

```sql
-- Add [your-proxy-name] to sys_server_ports_registry
INSERT INTO sys_server_ports_registry (
  service_name,
  display_name,
  port,
  description,
  status,
  environment,
  metadata
) VALUES (
  '[your-proxy-name]',
  '[Your Proxy Display Name]',
  [YOUR_PORT],
  '[Description of what your proxy does]',
  'active',
  'development',
  jsonb_build_object(
    'server_type', 'proxy',
    'proxy_category', '[infrastructure|viewer|utility|management]',
    'script_path', 'scripts/cli-pipeline/proxy/start-[your-proxy-name].ts',
    'base_class', 'ProxyServerBase',
    'features', jsonb_build_array(
      '[feature-1]',
      '[feature-2]'
    ),
    'endpoints', jsonb_build_object(
      '[endpoint_name]', '[METHOD] /path',
      'health', 'GET /health'
    )
  )
) ON CONFLICT (service_name) DO UPDATE SET
  port = EXCLUDED.port,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;
```

### 6. Add to Proxy Server Tests
**File**: `packages/proxy-servers/tests/proxy-server-health.test.ts`
**Section**: PROXY_SERVERS array

```typescript
{ name: '[your-proxy-name]', port: [YOUR_PORT], script: 'start-[your-proxy-name].ts' }
```

## Post-Execution Retrospective (30-Day Review)

### Benefit Realization Assessment
- [ ] **Usage Validation**: Is the proxy actually being used as intended?
  ```bash
  # Check actual usage
  grep -r "localhost:[YOUR_PORT]" apps/
  psql -c "SELECT * FROM sys_server_health_logs WHERE service_name = 'your-proxy-name' ORDER BY checked_at DESC LIMIT 10"
  ```

- [ ] **Performance Impact**: How has this affected system performance?
- [ ] **Maintenance Burden**: What maintenance overhead has this created?

### Critical Questions
1. **Value Delivered**: Did this proxy solve the intended problem effectively?
2. **Alternative Assessment**: In retrospect, was there a simpler solution?
3. **Complexity Cost**: Did the benefits justify the added complexity?
4. **Usage Patterns**: How does actual usage compare to projections?

### Lessons Learned Documentation
Document key insights:
- What worked well in this implementation?
- What would you do differently next time?
- Were there unexpected complications or benefits?
- Should similar requests be handled differently?

### Recommendation
Based on 30-day usage and impact assessment:
- [ ] **Continue**: Proxy is valuable and should be maintained
- [ ] **Optimize**: Good concept but needs refinements
- [ ] **Consolidate**: Merge with another proxy
- [ ] **Deprecate**: Remove due to low value/high cost

### Action Items
Based on retrospective findings:
- [ ] Documentation updates needed
- [ ] Code optimizations identified
- [ ] Process improvements for future scenarios
- [ ] Standards updates recommended

**Example**:
```typescript
{ name: 'test-runner-proxy', port: 9891, script: 'start-test-runner-proxy.ts' }
```

### 7. Create Specific Tests (Optional)
**File**: `packages/proxy-servers/tests/[your-proxy-name].test.ts`

Create integration tests for your specific endpoints if needed.

### 8. Update UI Components (If Applicable)
If your proxy is used by a specific UI app, update the component to:
- Check proxy health status
- Display connection status
- Handle offline scenarios

## Validation Checklist

- [ ] Port number reserved in CLAUDE.md
- [ ] Proxy server script created with proper structure
- [ ] Health endpoint returns correct format
- [ ] Added to package.json scripts
- [ ] Added to start-all-proxy-servers.ts
- [ ] Database migration created and run
- [ ] Added to proxy-server-health.test.ts
- [ ] Tests pass: `pnpm test packages/proxy-servers`
- [ ] Proxy starts: `pnpm proxy:[your-name]`
- [ ] Included in `pnpm servers` command
- [ ] Health check works: `curl http://localhost:[PORT]/health`

## Common Issues and Solutions

### Issue: Port Already in Use
**Solution**: Check CLAUDE.md for available ports, use `lsof -i :[PORT]` to find process

### Issue: Health Check Test Fails
**Solution**: Ensure health endpoint returns `{ status: 'ok', service: '[name]', port: [number] }`

### Issue: Database Migration Fails
**Solution**: Check column names match schema (e.g., `status` not `active`)

### Issue: Proxy Not Starting with `pnpm servers`
**Solution**: Verify added to PROXY_SERVERS array in start-all-proxy-servers.ts

## Related Scenarios
- `add-new-shared-service` - When proxy needs a new shared service
- `add-new-ui-integration` - Connecting proxy to UI components
- `add-database-table` - If proxy needs data persistence

## Automation Opportunities
1. **Port Assignment**: Auto-find next available port
2. **File Generation**: Template-based proxy creation
3. **Test Generation**: Auto-generate basic health tests
4. **Migration Creation**: Generate SQL from template
5. **Documentation Updates**: Auto-update CLAUDE.md

## Version History
- v1.0 (2025-06-15): Initial documentation based on test-runner-proxy implementation