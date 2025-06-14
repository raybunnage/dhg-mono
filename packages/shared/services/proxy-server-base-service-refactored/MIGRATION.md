# ProxyServerBaseService Migration Guide

## Overview

The ProxyServerBase class has been refactored from a standalone base class to a SingletonService with proper lifecycle management. This migration improves testability, observability, and follows the established service architecture patterns.

## Migration Summary

- **From**: Standalone base class with manual lifecycle management
- **To**: SingletonService with structured lifecycle, health checks, and metrics
- **Impact**: Minor breaking change requiring configuration updates
- **Benefits**: Proper initialization, health monitoring, comprehensive metrics tracking

## Breaking Changes

### 1. Class Name and Import

**Before**:
```typescript
import { ProxyServerBase } from '../base/ProxyServerBase';

class MyProxy extends ProxyServerBase {
  constructor(config: ProxyServerConfig) {
    super(config);
  }
}
```

**After**:
```typescript
import { ProxyServerBaseService } from '@shared/services/proxy-server-base-service-refactored';
import { ProxyServerBaseServiceConfig } from '@shared/services/proxy-server-base-service-refactored/types';

class MyProxy extends ProxyServerBaseService {
  constructor(config: ProxyServerBaseServiceConfig) {
    super(config);
  }
}
```

### 2. Configuration Structure

**Before**:
```typescript
const config: ProxyServerConfig = {
  name: 'my-proxy',
  port: 9876,
  description: 'My proxy server'
};

const proxy = new MyProxy(config);
```

**After**:
```typescript
const config: ProxyServerBaseServiceConfig = {
  proxyConfig: {
    name: 'my-proxy',
    port: 9876,
    description: 'My proxy server'
  }
};

const proxy = new MyProxy(config);
```

### 3. Initialization Requirements

**Before**:
```typescript
// Immediate startup
await proxy.start();
```

**After**:
```typescript
// Service auto-initializes on first use
await proxy.start(); // Initialization happens automatically
```

## New Features

### 1. Comprehensive Metrics

```typescript
const metrics = proxy.getMetrics();
console.log(`Requests received: ${metrics.requestsReceived}`);
console.log(`Average response time: ${metrics.averageResponseTime}ms`);
console.log(`Error rate: ${(metrics.requestsFailed / metrics.requestsReceived * 100).toFixed(1)}%`);
console.log(`Uptime: ${metrics.uptimeSeconds} seconds`);
```

### 2. Health Checks

```typescript
const health = await proxy.healthCheck();
if (!health.healthy) {
  console.error('Proxy is unhealthy:', health.details);
  // Take corrective action
}

// Health endpoint automatically available at /health
// curl http://localhost:9876/health
```

### 3. Structured Logging

```typescript
import { Logger } from '@shared/utils/logger';

const logger = new Logger('MyProxy');
const config = { proxyConfig: { name: 'my-proxy', port: 9876 } };
const proxy = new MyProxy(config, logger);

// All operations are now logged with context
await proxy.start();
```

### 4. Enhanced Server Information

```typescript
const info = proxy.getServerInfo();
// Now includes more detailed information:
// - Endpoint listings
// - Metrics summary
// - Health status
// - Uptime tracking
```

### 5. Built-in Metrics Endpoint

```typescript
// Metrics automatically available at /metrics
// curl http://localhost:9876/metrics
{
  "requestsReceived": 1542,
  "requestsCompleted": 1538,
  "requestsFailed": 4,
  "averageResponseTime": 45.2,
  "uptimeSeconds": 3600,
  "activeConnections": 3,
  "peakConnections": 12,
  // ... more metrics
}
```

## Migration Steps

### Step 1: Update Imports

```diff
- import { ProxyServerBase } from '../base/ProxyServerBase';
+ import { ProxyServerBaseService } from '@shared/services/proxy-server-base-service-refactored';
+ import { ProxyServerBaseServiceConfig } from '@shared/services/proxy-server-base-service-refactored/types';
```

### Step 2: Update Class Declaration

```diff
- class MyProxy extends ProxyServerBase {
+ class MyProxy extends ProxyServerBaseService {
```

### Step 3: Update Configuration

```diff
- const config: ProxyServerConfig = {
+ const config: ProxyServerBaseServiceConfig = {
+   proxyConfig: {
      name: 'my-proxy',
      port: 9876,
      description: 'My proxy server'
+   }
  };
```

### Step 4: Update Constructor (if needed)

```diff
  constructor(config: ProxyServerBaseServiceConfig) {
-   super(config);
+   super(config, logger); // Optional logger parameter
  }
```

### Step 5: Test Health Checks and Metrics

```typescript
// Test health endpoint
const response = await fetch('http://localhost:9876/health');
const health = await response.json();

// Test metrics endpoint
const metricsResponse = await fetch('http://localhost:9876/metrics');
const metrics = await metricsResponse.json();

// Direct API access
const healthStatus = await proxy.healthCheck();
const serviceMetrics = proxy.getMetrics();
```

## Example Migrations

### Simple Proxy Server Migration

**Before**:
```typescript
// ViteFixProxy.ts
import { ProxyServerBase } from '../base/ProxyServerBase';

export class ViteFixProxy extends ProxyServerBase {
  constructor() {
    super({
      name: 'vite-fix-proxy',
      port: 9876,
      description: 'Vite environment fix commands'
    });
  }

  protected setupRoutes(): void {
    this.app.post('/fix-env/:appName', (req, res) => {
      // Implementation
    });
  }

  protected getServiceDescription(): string {
    return 'Vite environment fix commands';
  }
}

// Usage
const proxy = new ViteFixProxy();
await proxy.start();
```

**After**:
```typescript
// ViteFixProxy.ts
import { ProxyServerBaseService } from '@shared/services/proxy-server-base-service-refactored';
import { ProxyServerBaseServiceConfig } from '@shared/services/proxy-server-base-service-refactored/types';
import { Logger } from '@shared/utils/logger';

export class ViteFixProxy extends ProxyServerBaseService {
  constructor(logger?: Logger) {
    const config: ProxyServerBaseServiceConfig = {
      proxyConfig: {
        name: 'vite-fix-proxy',
        port: 9876,
        description: 'Vite environment fix commands'
      }
    };
    super(config, logger);
  }

  protected setupRoutes(): void {
    this.app.post('/fix-env/:appName', (req, res) => {
      // Implementation - now with automatic metrics tracking
    });
  }

  protected getServiceDescription(): string {
    return 'Vite environment fix commands';
  }
}

// Usage
const logger = new Logger('ViteFixProxy');
const proxy = new ViteFixProxy(logger);

// Health check before starting
const health = await proxy.healthCheck();
if (health.healthy) {
  await proxy.start();
  
  // Monitor metrics
  setInterval(() => {
    const metrics = proxy.getMetrics();
    logger.info('Proxy metrics', metrics);
  }, 60000);
}
```

### Proxy with Custom Health Check

**Before**:
```typescript
export class DatabaseProxy extends ProxyServerBase {
  private dbConnected = false;

  protected async onStart(): Promise<void> {
    // Custom startup logic
    this.dbConnected = await this.connectToDatabase();
  }
}
```

**After**:
```typescript
export class DatabaseProxy extends ProxyServerBaseService {
  private dbConnected = false;

  protected async onStart(): Promise<void> {
    // Custom startup logic
    this.dbConnected = await this.connectToDatabase();
  }

  protected async performHealthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: this.dbConnected && this.isRunning(),
      details: {
        databaseConnected: this.dbConnected,
        serverRunning: this.isRunning()
      }
    };
  }
}

// Usage with enhanced health monitoring
const proxy = new DatabaseProxy(config, logger);
await proxy.start();

// Regular health monitoring
setInterval(async () => {
  const health = await proxy.healthCheck();
  if (!health.healthy) {
    logger.error('Proxy unhealthy, attempting restart', health.details);
    await proxy.restart();
  }
}, 30000);
```

## Testing Migration

### Before (Basic Testing)

```typescript
// Limited testing capabilities
describe('MyProxy', () => {
  it('should start and stop', async () => {
    const proxy = new MyProxy(config);
    await proxy.start();
    expect(proxy.isRunning()).toBe(true);
    await proxy.stop();
    expect(proxy.isRunning()).toBe(false);
  });
});
```

### After (Comprehensive Testing)

```typescript
// Full service testing with metrics and health checks
describe('MyProxy', () => {
  let proxy: MyProxy;

  beforeEach(() => {
    const config = { proxyConfig: { name: 'test', port: 9999 } };
    proxy = new MyProxy(config);
  });

  afterEach(async () => {
    if (proxy.isRunning()) {
      await proxy.stop();
    }
  });

  it('should track metrics properly', async () => {
    await proxy.start();
    
    // Make some requests
    await fetch(`http://localhost:9999/test`);
    
    const metrics = proxy.getMetrics();
    expect(metrics.requestsReceived).toBeGreaterThan(0);
    expect(metrics.startCount).toBe(1);
  });

  it('should provide health status', async () => {
    const health = await proxy.healthCheck();
    expect(health.healthy).toBeDefined();
    expect(health.timestamp).toBeInstanceOf(Date);
    expect(health.latencyMs).toBeGreaterThan(0);
  });

  it('should handle restart correctly', async () => {
    await proxy.start();
    await proxy.restart();
    
    const metrics = proxy.getMetrics();
    expect(metrics.restartCount).toBe(1);
    expect(proxy.isRunning()).toBe(true);
  });
});
```

## Performance Improvements

The refactored service includes:

1. **Request Tracking**: Every request is automatically tracked with timing
2. **Connection Monitoring**: Active and peak connection tracking
3. **Error Rate Monitoring**: Automatic error classification and tracking
4. **Response Time Analytics**: Rolling average response time calculation
5. **Lifecycle Metrics**: Start/stop/restart counting and timing

### Benchmark Results

Run the benchmark to see performance characteristics:

```bash
cd packages/shared/services/proxy-server-base-service-refactored
ts-node benchmark.ts
```

Expected improvements:
- Better observability through comprehensive metrics
- Proactive health monitoring capabilities
- Enhanced error handling and recovery
- Structured logging for better debugging

## Common Migration Issues

### 1. Port Configuration

**Issue**: Port conflicts during testing
**Solution**: Use different ports for different proxy instances

```typescript
// Test configuration
const testConfig = {
  proxyConfig: {
    name: 'test-proxy',
    port: 9999, // Use test port
    description: 'Test proxy'
  }
};
```

### 2. Health Check Failures

**Issue**: Custom health checks failing
**Solution**: Override `performHealthCheck` properly

```typescript
protected async performHealthCheck(): Promise<HealthCheckResult> {
  try {
    // Your custom health check logic
    const isHealthy = await this.checkDependencies();
    
    return {
      healthy: isHealthy,
      details: { customCheck: isHealthy }
    };
  } catch (error) {
    return {
      healthy: false,
      details: { error: error.message }
    };
  }
}
```

### 3. Metrics Not Updating

**Issue**: Metrics show zero values
**Solution**: Ensure requests are going through the Express app

```typescript
// Metrics are automatically tracked for all Express routes
this.app.get('/my-endpoint', (req, res) => {
  // This request will be automatically tracked
  res.json({ success: true });
});
```

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**: Revert to original ProxyServerBase import
2. **Gradual Migration**: Migrate proxies one at a time
3. **Testing in Isolation**: Use different ports for testing

```typescript
// Rollback to original
import { ProxyServerBase } from '../base/ProxyServerBase';

class MyProxy extends ProxyServerBase {
  constructor() {
    super({
      name: 'my-proxy',
      port: 9876
    });
  }
  // ... rest of original implementation
}
```

## Validation Checklist

After migration, verify:

- [ ] Proxy starts and stops correctly
- [ ] Health endpoint responds correctly (`/health`)
- [ ] Metrics endpoint provides data (`/metrics`)
- [ ] Custom routes still work as expected
- [ ] Health checks reflect actual service state
- [ ] Metrics track requests, responses, and errors
- [ ] Logging provides useful debugging information
- [ ] Error handling works as expected
- [ ] Performance meets or exceeds original

## Support

For migration assistance:

1. Check existing proxy implementations for patterns
2. Review test files for proper usage examples
3. Use benchmark to validate performance
4. Consult SERVICE_REFACTORING_COMPLETE_GUIDE.md for architecture patterns

## Conclusion

This migration transforms proxy servers from basic Express applications to full-featured services with proper lifecycle management, comprehensive monitoring, and enhanced reliability. The investment in migration provides:

- **Better Observability**: Detailed metrics and health monitoring
- **Enhanced Reliability**: Structured error handling and recovery
- **Improved Debugging**: Comprehensive logging and diagnostics
- **Better Testing**: Full test coverage with dependency injection
- **Future-Proof Architecture**: Consistent with other refactored services

The enhanced capabilities will significantly improve the reliability and maintainability of the proxy server infrastructure.