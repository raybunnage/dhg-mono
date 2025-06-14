# Service Standards Checklist for DHG Monorepo

## Overview
This checklist ensures all shared services in `packages/shared/services/` meet the requirements for operating across three distinct environments: Browser Apps, CLI Pipelines, and Proxy Servers.

## ✅ Environment Awareness Checklist

### 1. Environment Detection
- [ ] Service detects execution environment (`typeof window !== 'undefined'` for browser)
- [ ] Service handles Node.js environment (CLI/Server)
- [ ] Service provides clear error messages for unsupported environments

### 2. Singleton Pattern Implementation
- [ ] Static instance variable: `private static instance: ServiceName | null = null`
- [ ] Private constructor: `private constructor(...)`
- [ ] Public getInstance method with appropriate parameters
- [ ] Browser mode: Accepts optional Supabase client parameter
- [ ] CLI/Server mode: Uses internal singleton without parameters

### 3. Environment-Specific Initialization
```typescript
// Standard pattern:
static getInstance(client?: SupabaseClient): ServiceName {
  if (typeof window !== 'undefined') {
    // Browser environment
    if (!client) {
      throw new Error('ServiceName requires Supabase client in browser environment');
    }
    return new ServiceName(client);
  }
  
  // Node/CLI environment
  if (!this.instance) {
    this.instance = new ServiceName();
  }
  return this.instance;
}
```

### 4. Dependency Management
- [ ] No direct imports of Node.js modules in browser-compatible services
- [ ] No `import.meta.env` usage - use `process.env` for Node environments
- [ ] Browser services receive config via dependency injection
- [ ] Proper handling of optional dependencies

### 5. Error Handling
- [ ] Clear error messages indicating environment issues
- [ ] Graceful fallbacks where appropriate
- [ ] No silent failures - always log or throw errors
- [ ] Environment-specific error context

### 6. Service Classification
- [ ] **Browser-Only**: Services that only work in browser (e.g., DOM manipulation)
- [ ] **Node-Only**: Services requiring file system, process execution
- [ ] **Universal**: Services that work in all environments
- [ ] **Proxy-Required**: Browser services that need proxy server for certain operations

### 7. API Consistency
- [ ] Consistent method signatures across environments
- [ ] Same return types regardless of environment
- [ ] Promise-based APIs for async operations
- [ ] TypeScript types properly exported

### 8. Configuration
- [ ] Environment variables handled correctly:
  - Node: `process.env.VARIABLE_NAME`
  - Browser: Passed via constructor/config object
- [ ] No hardcoded secrets or URLs
- [ ] Configurable endpoints for different environments

### 9. Testing Requirements
- [ ] Unit tests for both browser and Node environments
- [ ] Mock implementations for environment-specific features
- [ ] Integration tests with real services where applicable
- [ ] Error case testing for wrong environment usage

### 10. Documentation
- [ ] JSDoc comments explaining environment requirements
- [ ] Usage examples for each environment
- [ ] Clear indication of which environments are supported
- [ ] Migration guide if service replaces older implementation

## Service Categories and Requirements

### Category A: Universal Services (Work Everywhere)
- Auth services (with environment-specific implementations)
- Data formatting/transformation services
- Business logic services
- API client services

### Category B: Node-Only Services (CLI/Server)
- File system operations
- Process execution
- Direct database migrations
- System monitoring

### Category C: Browser-Only Services
- DOM manipulation
- Browser storage (localStorage, sessionStorage)
- Web-specific APIs (WebRTC, etc.)

### Category D: Proxy-Required Services
- File operations from browser (via proxy)
- Git operations from browser (via proxy)
- System commands from browser (via proxy)

## Implementation Examples

### Good Example - Environment-Aware Service:
```typescript
export class DataProcessingService {
  private static instance: DataProcessingService | null = null;
  private client?: SupabaseClient;
  
  private constructor(client?: SupabaseClient) {
    this.client = client;
  }
  
  static getInstance(client?: SupabaseClient): DataProcessingService {
    if (typeof window !== 'undefined') {
      if (!client) {
        throw new Error('DataProcessingService requires Supabase client in browser');
      }
      return new DataProcessingService(client);
    }
    
    if (!this.instance) {
      this.instance = new DataProcessingService();
    }
    return this.instance;
  }
  
  async processData(data: any): Promise<any> {
    // Works in both environments
    return transformData(data);
  }
}
```

### Bad Example - Environment-Unaware Service:
```typescript
// ❌ WRONG - Will fail in browser
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

export class FileService {
  private supabase = createClient(...); // Direct client creation
  
  async readFile(path: string) {
    return fs.readFileSync(path); // Node-only API
  }
}
```

## Validation Process

1. **Static Analysis**: Run TypeScript compiler to catch import errors
2. **Environment Testing**: Test service in all three environments
3. **Documentation Review**: Ensure README explains environment support
4. **Code Review**: Verify checklist items are met
5. **Integration Testing**: Test with real apps/CLIs/servers

## Migration Strategy for Non-Compliant Services

1. **Identify Current Usage**: Find all imports and usages
2. **Classify Service Type**: Determine which environments it should support
3. **Implement Environment Detection**: Add proper getInstance pattern
4. **Update Imports**: Change from direct imports to getInstance calls
5. **Test Thoroughly**: Verify in all supported environments
6. **Update Documentation**: Document the changes and new usage patterns

## Conclusion

Following this checklist ensures services are:
- Predictable across environments
- Easy to debug when issues arise
- Maintainable as new features are added
- Scalable as new environments emerge

Every service should be reviewed against this checklist before being marked as "production-ready" for the monorepo.