# Proxy Server Testing Guide

## Overview

This guide covers the testing infrastructure for proxy servers in the DHG monorepo. We have two testing approaches:

1. **Test Harness** - Quick functional testing of all proxy servers
2. **Jest Unit Tests** - Comprehensive testing of individual proxy servers

## Service Import Verification ✅

All proxy servers have been verified to use the correct service patterns:

### Using Singleton Pattern (getInstance())
- AudioStreamingProxy → `GoogleDriveAudioService.getInstance()`
- ContinuousDocsProxy → `ContinuousDocsMonitoringService.getInstance()`
- ContinuousMonitoringProxy → `ContinuousMonitoringService.getInstance()`
- DocsArchiveProxy → `DocsArchiveService.getInstance()`
- FileBrowserProxy → `FileBrowserService.getInstance()`
- GitOperationsProxy → `GitOperationsService.getInstance()`
- HtmlFileBrowserProxy → `HtmlFileBrowserService.getInstance()`
- MarkdownViewerProxy → `MarkdownViewerService.getInstance()`
- ScriptViewerProxy → `ScriptViewerService.getInstance()`
- WorktreeSwitcherProxy → `WorktreeSwitcherService.getInstance()`

### Using Local Services (Direct Instantiation)
- ViteFixProxy → `new ViteFixService()` (local service)
- ProxyManagerProxy → `new ProxyManager()` (local class)

**Result**: 100% of shared services use singleton patterns correctly! ✅

## Test Harness

The test harness provides quick functional testing of all proxy servers.

### Running the Test Harness

```bash
# Test all proxy servers
./scripts/cli-pipeline/proxy/test-proxy-servers.sh

# Test specific servers
./scripts/cli-pipeline/proxy/test-proxy-servers.sh "Vite Fix Proxy" "Git Operations"

# Or use npm script
cd packages/proxy-servers
pnpm test:harness
```

### What It Tests

For each proxy server:
1. **Startup** - Can the server start successfully?
2. **Health Check** - Does the `/health` endpoint respond?
3. **Basic Endpoints** - Do the main endpoints return expected status codes?

### Test Results

The harness displays results in a table format:
```
Server                   Port      Status    Startup   Health    Endpoints
--------------------------------------------------------------------------------
Vite Fix Proxy          9876      ✅        ✅        ✅        1/1
Git Operations          9879      ✅        ✅        ✅        2/2
File Browser            9880      ❌        ✅        ❌        0/1
```

## Vitest Unit Tests

For comprehensive testing, we use Vitest with TypeScript.

### Running Tests

```bash
# Run all tests
cd packages/proxy-servers
pnpm test

# Run tests once
pnpm test:run

# UI mode
pnpm test:ui

# Coverage report
pnpm test:coverage
```

### Test Structure

Each proxy server test file follows this pattern:

```typescript
describe('ProxyName', () => {
  // Start server before tests
  beforeAll(async () => { /* start server */ });
  
  // Stop server after tests
  afterAll(async () => { /* stop server */ });
  
  describe('Health Check', () => {
    it('should return 200 from health endpoint', async () => {
      // Test health endpoint
    });
  });
  
  describe('Feature Endpoints', () => {
    it('should handle specific functionality', async () => {
      // Test specific endpoints
    });
  });
});
```

### Example Tests

We've created example tests for:
- `vite-fix-proxy.test.ts` - Tests app listing and fix commands
- `git-operations-proxy.test.ts` - Tests git status and worktree operations

## Coverage Goals

### Basic Coverage (Test Harness)
- ✅ Server starts without errors
- ✅ Health endpoint responds
- ✅ Main endpoints return expected status codes

### Comprehensive Coverage (Vitest)
- Health check endpoint
- All API endpoints
- Error handling
- CORS configuration
- Request validation
- Response format

## Adding Tests for New Proxy Servers

1. **Add to Test Harness**:
   ```typescript
   // In proxy-server-test-harness.ts
   {
     name: 'Your Proxy Name',
     port: 9xxx,
     startupScript: 'start-your-proxy.ts',
     healthEndpoint: '/health',
     additionalEndpoints: [
       { path: '/api/endpoint', method: 'GET', expectedStatus: 200 }
     ]
   }
   ```

2. **Create Vitest Test**:
   ```bash
   # Create test file
   touch packages/proxy-servers/tests/your-proxy.test.ts
   ```

3. **Write Tests**:
   - Copy structure from existing test files
   - Test all endpoints
   - Test error cases
   - Test edge cases

## CI/CD Integration

Future improvements:
- Run test harness in CI pipeline
- Fail builds if proxy servers don't start
- Generate coverage reports
- Performance benchmarking

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Stop any running proxy servers
   - Check with `lsof -i :PORT`

2. **Server Doesn't Start**
   - Check service dependencies
   - Verify environment variables
   - Check logs for startup errors

3. **Tests Timeout**
   - Increase Vitest timeout in config
   - Check if server needs more startup time
   - Verify network connectivity

### Debug Mode

Run with verbose logging:
```bash
DEBUG=* pnpm test:harness
```

## Best Practices

1. **Test Isolation** - Each test should be independent
2. **Cleanup** - Always stop servers after tests
3. **Timeouts** - Use appropriate timeouts for server startup
4. **Error Messages** - Provide clear error descriptions
5. **Mock External Services** - Don't depend on external APIs in tests

## Next Steps

1. Add tests for remaining proxy servers
2. Implement mock services for external dependencies
3. Add performance benchmarks
4. Create integration tests for proxy interactions
5. Add load testing for high-traffic proxies