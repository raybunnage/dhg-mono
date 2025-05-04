# Architectural Migration Process

## Overview

This document outlines the overall strategy for migrating the DHG monorepo to a more structured and maintainable architecture. The migration focuses on centralizing shared services, implementing consistent patterns, and improving code reusability.

## Core Principles

1. **Incremental Migration**: Changes are made in small, testable increments
2. **Service Abstraction**: Business logic is moved into service layers
3. **Shared Functionality**: Common functionality is centralized in shared packages
4. **Explicit Dependencies**: Dependencies between components are made explicit
5. **Testing First**: Components are tested before and after migration

## Current Progress

Recently completed migrations:
- `file-service` → `packages/shared/services/file-service`
- `supabase-service` → `packages/shared/services/supabase-service`
- `report-service` → `packages/shared/services/report-service`

Key progress indicators:
- Service layer abstractions are being implemented in apps
- Shared packages structure is established
- Component architecture is being standardized

## Migration Process

### Phase 1: Service Layer Abstraction (In Progress)

1. Create service abstractions for direct API/database calls
2. Update components to use these services
3. Ensure consistent error handling and logging
4. Add appropriate typing and documentation

#### Example:
```typescript
// Before: Direct database call in component
const { data, error } = await supabase.from('experts').select('*');

// After: Using service abstraction
const experts = await expertService.getAllExperts();
```

### Phase 2: Shared Service Integration (Next)

1. Move common services to shared packages
2. Update imports in consuming code
3. Implement proper dependency management
4. Add comprehensive testing

### Phase 3: Standardization and Documentation

1. Standardize API patterns across services
2. Improve cross-service error handling
3. Add comprehensive documentation
4. Create usage examples

### Phase 4: Legacy Code Archiving

1. Identify all references to legacy implementations
2. Migrate all consumers to new implementations
3. Thorough testing of new implementations
4. Archive old implementations with clear documentation

## When to Archive Legacy Code

**Legacy code should ONLY be archived when:**

1. ✓ All consumers have been migrated to the new implementations
2. ✓ Comprehensive tests verify the new implementations
3. ✓ All edge cases are covered and tested
4. ✓ Monitoring is in place to catch regressions
5. ✓ Documentation is updated
6. ✓ All team members are trained on the new patterns

## Application Status

| Application | Service Layer | Shared Services | Documentation |
|-------------|---------------|-----------------|---------------|
| dhg-improve-experts | In Progress | Not Started | In Progress |
| dhg-hub-lovable | Not Started | Not Started | Not Started |
| dhg-a | Not Started | Not Started | Not Started |
| dhg-b | Not Started | Not Started | Not Started |

## Documentation and Resources

- [Experts Migration Plan](./experts-migration-plan.md)
- [Scripts Migration Plan](../solution-guides/SCRIPTS_MIGRATION_PLAN.md)
- [Script for Finding Service Dependencies](../../scripts/find-service-dependencies.sh)

## Next Steps

1. Complete the service layer implementation for the experts module
2. Update packages to properly expose shared services
3. Begin migration of scripts that use these services
4. Implement CI/CD pipeline tests for the migrated services