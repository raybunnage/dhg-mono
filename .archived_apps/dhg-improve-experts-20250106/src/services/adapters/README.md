# Service Adapters

These adapter patterns facilitate the transition from direct app code to shared services in `packages/shared`.

## Purpose

1. **Transition Layer**: Adapters provide a stable interface while the underlying implementation changes
2. **Progressive Migration**: Allows gradual migration to shared services without breaking the app
3. **Consistent API**: Maintains a consistent API for consumers even as the implementation evolves

## Usage

Import the adapter instead of using the service directly:

```typescript
// Instead of importing the service directly
// import { someService } from '@/services/someService';

// Import the adapter
import { someServiceAdapter } from '@/services/adapters/some-service-adapter';

// Use the adapter's methods
const result = await someServiceAdapter.someMethod();
```

## Migration Strategy

1. Start by replacing direct service usage with adapter usage in the application
2. Later, implement the shared service in `packages/shared/services/`
3. Finally, update the adapter to use the shared service instead of the local implementation

## Available Adapters

- `BatchProcessButton.tsx` - React component for batch processing documents
- `command-history-adapter.ts` - Adapter for command history service
- `content-service-adapter.ts` - Adapter for content service
- `documentation-adapter.ts` - Adapter for documentation service
- `markdown-file-adapter.ts` - Adapter for markdown file service
- `script-file-adapter.ts` - Adapter for script file service

## Adapter Design Pattern

Each adapter follows a consistent pattern:
- Wraps the current service implementation
- Exposes the same interface that will be used by the shared service
- Includes error handling and logging
- Exports a singleton instance for consistent usage