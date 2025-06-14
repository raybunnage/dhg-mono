# Proxy Server Architecture

## Overview

This package provides a standardized infrastructure for creating proxy servers in the monorepo. All proxy servers extend a common base class and follow consistent patterns for configuration, error handling, and service integration.

## Architecture Components

### 1. BaseProxyServer

The foundation for all proxy servers, providing:
- Express server setup with standardized middleware
- CORS configuration for cross-origin requests
- JSON body parsing
- Error handling middleware
- Health check endpoints
- Graceful shutdown handling

### 2. Service Pattern

Each proxy server uses a corresponding shared service for business logic:
- Proxy servers handle HTTP concerns (routes, request/response)
- Services handle business logic (file operations, API calls, data processing)
- Services can be reused in CLI tools, other proxies, or apps

### 3. Port Allocation

Proxy servers use dedicated ports in the 9876-9899 range:
- 9876: ViteFixProxy - Vite environment fixes
- 9877: ContinuousMonitoringProxy - System health monitoring
- 9878: ProxyManagerProxy - Manage other proxies
- 9879: [Reserved]
- 9880: FileBrowserProxy - File system operations
- 9881: GitOperationsProxy - Git operations
- 9882: ContinuousDocsProxy - Documentation tracking
- 9883: AudioStreamingProxy - Audio file streaming
- 8080: HtmlFileBrowserProxy - Web-based file browser

## Creating a New Proxy Server

### 1. Create the Service (if needed)

```typescript
// packages/shared/services/my-feature/MyFeatureService.ts
export class MyFeatureService {
  private static instance: MyFeatureService;
  
  private constructor() {
    // Initialize service
  }
  
  static getInstance(): MyFeatureService {
    if (!MyFeatureService.instance) {
      MyFeatureService.instance = new MyFeatureService();
    }
    return MyFeatureService.instance;
  }
  
  // Service methods...
}
```

### 2. Create the Proxy Server

```typescript
// packages/proxy-servers/servers/my-feature/MyFeatureProxy.ts
import { BaseProxyServer } from '../../BaseProxyServer';
import { MyFeatureService } from '../../../shared/services/my-feature/MyFeatureService';

export class MyFeatureProxy extends BaseProxyServer {
  private myService: MyFeatureService;

  constructor() {
    super('MyFeatureProxy', 9884); // Choose next available port
    this.myService = MyFeatureService.getInstance();
  }

  protected setupRoutes(): void {
    // Define your routes
    this.app.get('/api/my-feature', (req, res) => {
      // Handle request using service
    });
    
    // Health check is automatically provided by BaseProxyServer
  }
}
```

### 3. Export from Package

```typescript
// packages/proxy-servers/index.ts
export { MyFeatureProxy } from './servers/my-feature/MyFeatureProxy';
```

### 4. Create CLI Starter Script

```typescript
// scripts/cli-pipeline/proxy/start-my-feature-proxy.ts
#!/usr/bin/env ts-node

import { MyFeatureProxy } from '../../../packages/proxy-servers';

async function main() {
  console.log('Starting My Feature Proxy Server...');
  
  try {
    const proxy = new MyFeatureProxy();
    await proxy.start();
    
    console.log(`My Feature Proxy is running on http://localhost:9884`);
  } catch (error) {
    console.error('Failed to start My Feature Proxy:', error);
    process.exit(1);
  }
}

main();
```

### 5. Create Test Component (Optional)

Create a test component in `dhg-service-test` app to verify functionality.

## Best Practices

### 1. Error Handling

Always wrap async route handlers:
```typescript
private handleError(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage
this.app.get('/api/data', this.handleError(async (req, res) => {
  const data = await this.service.getData();
  res.json(data);
}));
```

### 2. Service Initialization

Configure services in the proxy constructor or setupMiddleware:
```typescript
protected setupMiddleware(): void {
  super.setupMiddleware();
  
  // Configure service with proxy-specific settings
  this.myService.configure({
    basePath: process.cwd(),
    timeout: 30000
  });
}
```

### 3. Response Patterns

Use consistent response formats:
```typescript
// Success
res.json({
  success: true,
  data: result,
  message: 'Operation completed'
});

// Error
res.status(400).json({
  success: false,
  error: 'Invalid request',
  details: error.message
});
```

### 4. Health Checks

Include service status in health checks:
```typescript
this.app.get('/health', (req, res) => {
  const serviceStatus = this.myService.getStatus();
  res.json({
    status: 'healthy',
    proxy: this.name,
    port: this.port,
    service: serviceStatus,
    uptime: process.uptime()
  });
});
```

## Migration Guide

When migrating an existing Express server:

1. **Extract Business Logic**: Move core functionality to a shared service
2. **Create Proxy Class**: Extend BaseProxyServer
3. **Map Routes**: Convert existing routes to use the service
4. **Update Ports**: Use allocated proxy server port range
5. **Archive Original**: Move old server to `.archived_servers`
6. **Update References**: Fix any scripts referencing old server

## Testing

Proxy servers can be tested using:
1. **Unit Tests**: Test services independently
2. **Integration Tests**: Test proxy endpoints
3. **Manual Testing**: Use dhg-service-test app components
4. **Health Checks**: Verify server status endpoints

## Security Considerations

1. **Path Validation**: Always validate file paths to prevent directory traversal
2. **Authentication**: Add auth middleware when needed
3. **Rate Limiting**: Consider adding rate limits for public endpoints
4. **CORS**: Configure CORS appropriately for production
5. **Input Validation**: Validate all user inputs

## Monitoring

All proxy servers include:
- Health check endpoints (`/health`)
- Uptime tracking
- Error logging
- Graceful shutdown handling

For production use, consider adding:
- Prometheus metrics
- Structured logging
- Request tracing
- Performance monitoring