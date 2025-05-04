# Service Adapter Pattern for Shared Services

## Overview

The Service Adapter Pattern is being used in our application to facilitate the migration from direct database/API calls to shared services. This document explains the pattern, its benefits, and implementation guidelines.

## The Problem

When migrating to shared services, we face several challenges:

1. Direct replacement can cause widespread changes throughout the codebase
2. Shared services may have different interfaces than existing code expects
3. Dependency management becomes more complex
4. Testing becomes difficult without proper isolation

## The Solution: Service Adapter Pattern

The Service Adapter Pattern creates an intermediate layer between application components and shared services:

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Application  │     │    Adapter    │     │    Shared     │
│  Components   │ ──> │    Service    │ ──> │    Service    │
└───────────────┘     └───────────────┘     └───────────────┘
```

### Implementation Steps

1. **Create an adapter interface** that matches what the application components expect
2. **Implement adapter with temporary logic** for testing without shared services
3. **Update components** to use the adapter instead of direct API/DB calls
4. **Later, update adapter implementation** to use shared services

## Advantages

- **Incremental migration**: Components can be updated one at a time
- **Testing isolation**: Adapters can be mocked for testing components
- **Interface stability**: Application components are insulated from shared service changes
- **Dependency management**: Shared package dependencies are isolated to adapters

## Implementation Example

### 1. Create Adapter Interface

```typescript
// document-pipeline-adapter.ts

export interface DocumentPipelineAdapter {
  processDocument(documentId: string): Promise<boolean>;
  getRecentDocuments(limit?: number): Promise<Document[]>;
  queueDocumentsForProcessing(documentIds: string[]): Promise<number>;
}
```

### 2. Temporary Implementation

```typescript
export class DocumentPipelineAdapterImpl implements DocumentPipelineAdapter {
  async processDocument(documentId: string): Promise<boolean> {
    // Temporary implementation using local services
    const doc = await localDocumentService.getDocument(documentId);
    // Process document logic...
    return true;
  }
  
  // Other methods...
}
```

### 3. Using the Adapter in Components

```typescript
// In a component
import { documentPipelineAdapter } from '@/services/document-pipeline-adapter';

async function handleProcess() {
  const success = await documentPipelineAdapter.processDocument(documentId);
  // Handle result...
}
```

### 4. Final Implementation with Shared Services

```typescript
import { documentPipelineService } from '@dhg/shared/services/document-pipeline';

export class DocumentPipelineAdapterImpl implements DocumentPipelineAdapter {
  async processDocument(documentId: string): Promise<boolean> {
    // Call shared service
    const result = await documentPipelineService.executeCommand(
      'process-single',
      documentId
    );
    return result === 0;
  }
  
  // Other methods...
}
```

## Best Practices

1. **Keep interfaces stable**: Once components use an adapter, avoid changing its interface
2. **Use dependency injection**: For easier testing and flexibility
3. **Minimize adapter logic**: Adapters should primarily convert between interfaces
4. **Consistent error handling**: Standardize how errors are caught and reported
5. **Logging**: Include detailed logging for debugging

## Testing

### Testing Components with Adapters

```typescript
// Mock adapter for testing
const mockAdapter: DocumentPipelineAdapter = {
  processDocument: jest.fn().mockResolvedValue(true),
  // Other required methods...
};

test('component processes document', async () => {
  render(<MyComponent adapter={mockAdapter} />);
  // Test component behavior...
  expect(mockAdapter.processDocument).toHaveBeenCalledWith('doc-123');
});
```

### Testing Adapters

```typescript
// For the temporary implementation
test('adapter processes document', async () => {
  const adapter = new DocumentPipelineAdapterImpl();
  const result = await adapter.processDocument('doc-123');
  expect(result).toBe(true);
});

// For the shared service implementation
test('adapter calls shared service', async () => {
  // Mock the shared service
  documentPipelineService.executeCommand = jest.fn().mockResolvedValue(0);
  
  const adapter = new DocumentPipelineAdapterImpl();
  const result = await adapter.processDocument('doc-123');
  
  expect(documentPipelineService.executeCommand)
    .toHaveBeenCalledWith('process-single', 'doc-123');
  expect(result).toBe(true);
});
```

## Migration Timeline

1. **Phase 1**: Create adapters with temporary implementations
2. **Phase 2**: Update components to use adapters
3. **Phase 3**: Update adapters to use shared services
4. **Phase 4**: Remove temporary implementations

## Conclusion

The Service Adapter Pattern allows for a gradual, controlled migration to shared services while maintaining application functionality and testability. By isolating the interface from the implementation, we can evolve each independently.