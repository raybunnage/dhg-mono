# Proxy Server Testing Guide

## Overview

This guide documents the testing approach for the proxy servers in the dhg-mono-improve-suite. All proxy servers provide HTTP APIs for various system functions and must be tested for reliability and correctness.

## Test Structure

### 1. Health Check Tests (`proxy-server-health.test.ts`)
- **Purpose**: Verify all proxy servers can start and respond to health checks
- **Coverage**: All 12 active proxy servers
- **Timeout**: 60 seconds per server (to allow for startup time)
- **What it tests**:
  - Server starts on correct port
  - Health endpoint returns 200 status
  - Response includes service name and port

### 2. Endpoint Tests (`proxy-server-endpoints.test.ts`)
- **Purpose**: Test specific functionality of key proxy servers
- **Coverage**: Git Operations, Vite Fix, CLI Test Runner
- **What it tests**:
  - Git Operations: status, branches, worktrees
  - Vite Fix: app listing, fix functionality
  - CLI Test Runner: test groups, test status

## Running Tests

### Quick Test
```bash
# From repository root
./scripts/cli-pipeline/proxy/test-proxy-servers.sh
```

### Manual Testing
```bash
# Navigate to proxy-servers package
cd packages/proxy-servers

# Run specific test file
pnpm vitest run tests/proxy-server-health.test.ts

# Run with watch mode for development
pnpm vitest watch

# Run with coverage
pnpm vitest run --coverage
```

## Test Implementation Details

### Server Startup Pattern
```typescript
const proc = spawn('ts-node', ['--esm', scriptPath], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'test' }
});

// Wait for server to be ready
const isReady = await waitForServer(port);
```

### Health Check Pattern
```typescript
const response = await axios.get(`http://localhost:${port}/health`);
expect(response.status).toBe(200);
expect(response.data).toMatchObject({
  status: 'ok',
  service: name,
  port: port
});
```

### Cleanup Pattern
```typescript
afterAll(async () => {
  // Clean up all spawned processes
  for (const [name, proc] of processes) {
    proc.kill('SIGTERM');
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
});
```

## Adding New Proxy Server Tests

When adding a new proxy server:

1. Add server configuration to `PROXY_SERVERS` array in health test
2. Ensure server implements `/health` endpoint returning:
   ```json
   {
     "status": "ok",
     "service": "server-name",
     "port": 9999
   }
   ```
3. Add specific endpoint tests if server has unique functionality
4. Update this guide with any special considerations

## Common Issues and Solutions

### Port Already in Use
- **Problem**: Test fails because port is already occupied
- **Solution**: Kill existing process or use different port in test environment

### Server Startup Timeout
- **Problem**: Server takes too long to start
- **Solution**: Increase `waitForServer` maxAttempts or optimize server startup

### TypeScript/ES Module Issues
- **Problem**: Import errors or module resolution failures
- **Solution**: Ensure `--esm` flag is used with ts-node and imports use .js extensions

## CI/CD Considerations

- Tests spawn real server processes (not mocked)
- Requires available ports 9876-9890
- Total test time ~2-3 minutes for all servers
- Consider running in parallel jobs if test time becomes an issue

## Future Improvements

1. **Mock Mode**: Add ability to test without spawning real processes
2. **Load Testing**: Add performance benchmarks for critical endpoints
3. **Error Scenarios**: Test server behavior under error conditions
4. **Integration Tests**: Test proxy servers working together
5. **WebSocket Testing**: Add tests for any WebSocket endpoints