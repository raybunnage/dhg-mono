# Experts Module Migration Plan

## Overview

The DHG Improve Experts application is being incrementally refactored to use the shared services from the monorepo. This document outlines the migration strategy and steps.

## Current State

The Experts module is in the process of adopting the service layer pattern. We've created an abstraction layer that wraps Supabase calls, making it easier to transition to shared services later.

## Progress Update (2025-03-28)

Components migrated to service layer:
- ✅ ExpertList
- ✅ ExpertDetailView
- ✅ ExpertDocumentList
- ✅ ExpertForm

Services implemented:
- ✅ ExpertService (with CRUD operations)
- ✅ Utils for data normalization

## Target State

We aim to use the shared services from the monorepo, specifically:

1. `supabase-service` - For data access operations
2. `file-service` - For file operations
3. `report-service` - For generating reports

## Migration Strategy

### Phase 1: Abstraction Layer (Completed)

1. ✅ Create an `expert-service.ts` in the app to abstract database operations
2. ✅ Update React components to use this service instead of direct Supabase calls
3. ✅ Add utility functions for data normalization in the expert types
4. ✅ Implement document operations in the service layer

### Phase 2: Shared Service Integration

1. Add the shared package as a dependency in package.json:
   ```json
   "dependencies": {
     "@dhg/shared": "workspace:*",
     // other dependencies
   }
   ```

2. Update tsconfig.json to properly resolve shared package paths:
   ```json
   "compilerOptions": {
     "paths": {
       "@/*": ["./src/*"],
       "@dhg/*": ["../../packages/*"]
     }
   }
   ```

3. Refactor expert-service.ts to use the shared services:
   ```typescript
   import { supabaseService } from '@dhg/shared/services/supabase-service';
   ```

4. Replace direct supabase calls with the shared supabaseService

### Phase 3: Enhanced Expert Features

1. Implement document processing using the shared document-pipeline
2. Add expert profile enhancement using AI services
3. Implement enhanced search and filtering using shared services

## Benefits

- **Reduced code duplication**: Centralized data access logic
- **Consistent behavior**: Same data handling across all apps
- **Improved maintainability**: Easier to update data logic in one place
- **Better testing**: Services can be mocked and tested independently

## Risks and Considerations

- **Dependency management**: Need to ensure shared packages are properly versioned
- **API changes**: Changes to shared services might require updates in multiple places
- **Performance**: Abstraction layers could potentially impact performance

## Implementation Timeline

- Phase 1: Complete by end of Sprint X
- Phase 2: Complete by end of Sprint Y
- Phase 3: Complete by end of Sprint Z