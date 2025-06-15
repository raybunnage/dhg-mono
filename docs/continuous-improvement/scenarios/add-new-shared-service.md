# Continuous Improvement Scenario: Add New Shared Service

## Scenario ID: `add-new-shared-service`
**Category**: Development
**Complexity**: Medium
**Estimated Time**: 30-45 minutes
**Last Updated**: 2025-06-15

## Overview
This scenario documents the complete process for adding a new shared service to the monorepo. Shared services provide reusable functionality across multiple apps and CLI pipelines.

## Prerequisites
- Clear understanding of the service's purpose and API
- Knowledge of TypeScript and service patterns
- Understanding of singleton vs dependency injection patterns (see CLAUDE.md)

## When to Use
- Creating functionality that will be used by multiple apps
- Extracting common code from apps into a shared service
- Building new infrastructure services (API clients, utilities)

## Step-by-Step Process

### 1. Determine Service Type
**Decision Point**: Is this an infrastructure service or business logic service?

- **Infrastructure Service** (database, API clients): Use singleton pattern
- **Business Service** (domain logic): Use dependency injection

### 2. Create Service Directory
**Location**: `packages/shared/services/{service-name}/`

```bash
mkdir -p packages/shared/services/{service-name}
```

### 3. Create Service Files

#### Main Service File
**File**: `packages/shared/services/{service-name}/{service-name}.ts`

**Template for Infrastructure Service (Singleton)**:
```typescript
export class {ServiceName}Service {
  private static instance: {ServiceName}Service;
  
  private constructor() {
    // Initialize
  }
  
  static getInstance(): {ServiceName}Service {
    if (!{ServiceName}Service.instance) {
      {ServiceName}Service.instance = new {ServiceName}Service();
    }
    return {ServiceName}Service.instance;
  }
  
  // Service methods
}

export const {serviceName}Service = {ServiceName}Service.getInstance();
```

**Template for Business Service (DI)**:
```typescript
export class {ServiceName}Service {
  constructor(
    private supabase: SupabaseClient,
    private logger?: Logger
  ) {}
  
  // Service methods
}
```

#### Index Export
**File**: `packages/shared/services/{service-name}/index.ts`
```typescript
export * from './{service-name}';
```

### 4. Create Test File
**File**: `packages/shared/services/{service-name}/__tests__/{service-name}.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { {ServiceName}Service } from '../{service-name}';

describe('{ServiceName}Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should initialize correctly', () => {
    // Test initialization
  });
  
  // Add comprehensive tests
});
```

### 5. Update Shared Services Index
**File**: `packages/shared/services/index.ts`

Add export:
```typescript
export * from './{service-name}';
```

### 6. Add Type Definitions (if needed)
**File**: `packages/shared/types/{service-name}.types.ts`

```typescript
export interface {ServiceName}Config {
  // Configuration options
}

export interface {ServiceName}Response {
  // Response types
}
```

### 7. Update package.json Exports
**File**: `packages/shared/package.json`

Add to exports if creating a new category:
```json
"exports": {
  "./services/{service-name}": "./dist/services/{service-name}/index.js"
}
```

### 8. Create Usage Documentation
**File**: `docs/shared-services/{service-name}-service.md`

Document:
- Purpose and use cases
- API reference
- Usage examples
- Configuration options

### 9. Add to Service Registry
**Database Migration**: `supabase/migrations/{date}_add_{service_name}_service.sql`

```sql
INSERT INTO sys_shared_services (
  service_name,
  service_path,
  service_type,
  pattern_type,
  description,
  usage_examples
) VALUES (
  '{service-name}',
  'packages/shared/services/{service-name}',
  'business|infrastructure',
  'singleton|dependency-injection',
  'Service description',
  jsonb_build_array('Example usage 1', 'Example usage 2')
);
```

### 10. Test Integration
1. Run unit tests: `pnpm test packages/shared/services/{service-name}`
2. Test in a sample app
3. Verify TypeScript compilation: `tsc --noEmit`

## Validation Checklist
- [ ] Service follows appropriate pattern (singleton/DI)
- [ ] Comprehensive tests with >80% coverage
- [ ] TypeScript types are explicit (no implicit any)
- [ ] Service is exported in shared index
- [ ] Documentation created
- [ ] No hardcoded values or credentials
- [ ] Cross-environment compatible (Node.js and browser)
- [ ] Added to service registry database
- [ ] Integration tested in at least one app

## Common Issues
- **Import Errors**: Ensure service is exported in both local and shared index files
- **TypeScript Errors**: Run `tsc --noEmit` to catch type issues early
- **Browser Compatibility**: Avoid Node.js-only dependencies in shared services
- **Circular Dependencies**: Be careful with service interdependencies

## Related Scenarios
- `modify-database-tables` - If service needs new database tables
- `add-new-tests` - For comprehensive test coverage
- `add-new-app-page` - When creating UI to use the service

## Automation Notes
When automated, this scenario should:
- Generate service files from templates based on type
- Automatically update all index files
- Create placeholder tests
- Generate basic documentation
- Create database migration
- Run initial tests