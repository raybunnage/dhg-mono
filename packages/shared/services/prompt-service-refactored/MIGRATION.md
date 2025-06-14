# PromptService Migration Guide

## Overview
PromptService has been refactored to extend SingletonService for proper resource management and to support both Node.js and browser environments through environment abstraction.

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import { promptService } from '@shared/services/prompt-service/prompt-service';
```

**After:**
```typescript
import { PromptService } from '@shared/services/prompt-service-refactored/PromptService';
```

### 2. Usage Changes

**Before:**
```typescript
// Direct usage of exported instance
const prompt = await promptService.getPrompt('document-classification');
```

**After:**
```typescript
// Get singleton instance first
const promptService = PromptService.getInstance();
const prompt = await promptService.getPrompt('document-classification');
```

### 3. Environment Setup

For browser environments, provide an environment adapter:

```typescript
const browserAdapter = {
  readFileSync: (path: string) => localStorage.getItem(path) || '',
  existsSync: (path: string) => localStorage.getItem(path) !== null,
  joinPath: (...paths: string[]) => paths.join('/'),
  resolvePath: (path: string) => path,
  isAbsolute: (path: string) => path.startsWith('/')
};

PromptService.initialize({ environmentAdapter: browserAdapter });
```

### 4. Initialization

The service now supports explicit initialization:

```typescript
// Initialize with custom config
await PromptService.initialize({
  supabaseClient: customClient,
  fileService: customFileService,
  environmentAdapter: browserAdapter
});

// Or use defaults (Node.js environment)
const service = PromptService.getInstance();
```

### 5. New Features

- **Health Checks**: `await service.healthCheck()`
- **Metrics**: `const metrics = service.getMetrics()`
- **Resource Cleanup**: `await service.cleanup()`
- **Better Error Handling**: All methods now throw typed errors

### 6. Breaking Changes

1. No more direct instance export - must use `getInstance()`
2. Methods may throw errors that need to be caught
3. Environment adapter required for browser usage
4. File operations abstracted through environment adapter

### 7. Benefits

- Proper singleton pattern with lifecycle management
- Cross-environment compatibility (Node.js and browser)
- Built-in health monitoring and metrics
- Better error handling and resource cleanup
- Type-safe throughout

## Example Migration

**Old Code:**
```typescript
import { promptService } from '@shared/services/prompt-service/prompt-service';

async function classifyDocument(content: string) {
  const prompt = await promptService.getPrompt('document-classification');
  return await claude.analyze(prompt, content);
}
```

**New Code:**
```typescript
import { PromptService } from '@shared/services/prompt-service-refactored/PromptService';

async function classifyDocument(content: string) {
  try {
    const service = PromptService.getInstance();
    const prompt = await service.getPrompt('document-classification');
    return await claude.analyze(prompt, content);
  } catch (error) {
    console.error('Failed to classify document:', error);
    throw error;
  }
}
```

## Rollback

If issues arise, the original service remains at:
```typescript
import { promptService } from '@shared/services/prompt-service/prompt-service';
```

Both can coexist during the migration period.