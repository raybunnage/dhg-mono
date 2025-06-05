# Expert Service Refactoring Plan

## Overview

This document outlines the plan for refactoring the expert service to be more integrated with the adapter pattern and to prepare for migration to shared services.

## Current State

The current expert service directly accesses the database through Supabase and is used by multiple components. It handles:

1. Expert data management (CRUD operations)
2. Expert document management
3. Related data retrieval (sources, etc.)

## Target State

We want to:

1. Transition the expert service to use the adapter pattern
2. Create a clear separation between data access and business logic
3. Prepare for eventual migration to shared services
4. Maintain backward compatibility with existing components

## Refactoring Approach

### Phase 1: Create Expert Service Adapter

Create a new adapter that follows the pattern established with document-pipeline-adapter and script-pipeline-adapter:

```typescript
/**
 * Adapter for expert service
 * 
 * This adapter will eventually use the shared expert-service.
 * It's designed as an adapter to make the future transition smoother.
 */
import { Expert, ExpertDocument } from '@/types/expert';
import { expertService } from './expert-service';

export class ExpertServiceAdapter {
  /**
   * Get all experts
   */
  async getAllExperts(): Promise<Expert[]> {
    return await expertService.getAllExperts();
  }
  
  /**
   * Get expert by ID
   */
  async getExpertById(id: string): Promise<Expert | null> {
    return await expertService.getExpertById(id);
  }
  
  // Additional methods to wrap expertService functionality
}

// Export singleton instance
export const expertServiceAdapter = new ExpertServiceAdapter();
```

### Phase 2: Update Components to Use Adapter

Update all components currently using expertService to use the expertServiceAdapter instead:

1. ExpertList
2. ExpertForm
3. ExpertDetailView
4. ExpertDocumentForm (where not already using adapters)
5. ExpertDocumentList
6. Any other components using expert data

### Phase 3: Prepare for Shared Service Transition

Modify the adapter to align with expected shared service interfaces:

```typescript
// Future implementation that uses shared service
import { expertService as sharedExpertService } from '@dhg/shared/services/expert-service';

export class ExpertServiceAdapter {
  /**
   * Get all experts
   */
  async getAllExperts(): Promise<Expert[]> {
    // Call shared service
    const experts = await sharedExpertService.getAll();
    
    // Map to application-specific types if needed
    return experts.map(expert => ({
      id: expert.id,
      expert_name: expert.name,
      // Other fields mapping
    }));
  }
  
  // Other methods...
}
```

## Implementation Tasks

1. **Create Expert Service Adapter**:
   - Define interface based on current expertService
   - Create initial implementation that delegates to current service
   - Add appropriate error handling and logging

2. **Update Component Dependencies**:
   - Identify all components using expertService
   - Update imports to use adapter
   - Test functionality to ensure it works as before

3. **Add Test Coverage**:
   - Create unit tests for adapter
   - Test adapter with mock services
   - Verify proper error handling

4. **Document the Changes**:
   - Update migration documentation
   - Add adapter usage examples
   - Update migration checklist

## Benefits

1. **Incremental Migration**: Components can be updated one at a time
2. **Interface Stability**: Components are insulated from future changes to service implementation
3. **Testing Isolation**: Adapter can be mocked for testing components
4. **Clear Path to Shared Services**: Pattern aligns with shared service transition strategy

## Timeline

1. Create adapter and initial tests (1-2 days)
2. Update components incrementally (3-5 days)
3. Documentation and finalization (1 day)

## Success Criteria

1. All components use adapter instead of direct service
2. All tests pass
3. Functionality remains unchanged from user perspective
4. Code structure is cleaner and more maintainable
5. Clear path for shared service integration is established