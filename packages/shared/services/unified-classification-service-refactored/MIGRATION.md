# UnifiedClassificationService Migration Guide

## Overview

The UnifiedClassificationService has been refactored from a singleton pattern to a BusinessService with dependency injection. This migration improves testability, maintainability, and follows the established service architecture patterns.

## Migration Summary

- **From**: Singleton pattern with getInstance()
- **To**: BusinessService with constructor dependency injection
- **Impact**: Major breaking change requiring updates to all consumers
- **Benefits**: Better testability, dependency management, metrics tracking, health checks

## Breaking Changes

### 1. Service Instantiation

**Before (Singleton Pattern)**:
```typescript
import { unifiedClassificationService } from '@shared/services/unified-classification-service';

// Service was automatically instantiated
const result = await unifiedClassificationService.classifyDocuments(options);
```

**After (Dependency Injection)**:
```typescript
import { UnifiedClassificationService } from '@shared/services/unified-classification-service-refactored';
import { SupabaseClientService } from '@shared/services/supabase-client';
import { GoogleDriveService } from '@shared/services/google-drive-refactored';
import { PromptService } from '@shared/services/prompt-service-refactored';
import { claudeService } from '@shared/services/claude-service';
// ... other dependencies

const supabase = SupabaseClientService.getInstance().getClient();
const config = {
  googleDriveService: GoogleDriveService.getInstance(googleConfig),
  promptService: new PromptService(supabase),
  claudeService: claudeService,
  pdfProcessorService: pdfProcessorService,
  filterService: new FilterService(supabase),
};

const classificationService = new UnifiedClassificationService(supabase, config, logger);
const result = await classificationService.classifyDocuments(options);
```

### 2. Configuration Requirements

The new service requires explicit configuration of all dependencies:

```typescript
interface UnifiedClassificationServiceConfig {
  googleDriveService: GoogleDriveServiceInterface;
  promptService: PromptServiceInterface;
  claudeService: ClaudeServiceInterface;
  pdfProcessorService: PdfProcessorServiceInterface;
  filterService: FilterServiceInterface;
}
```

## New Features

### 1. Comprehensive Metrics

```typescript
const metrics = classificationService.getMetrics();
console.log(`Classifications completed: ${metrics.classificationsCompleted}`);
console.log(`Average processing time: ${metrics.averageProcessingTime}ms`);
console.log(`Cache hit rate: ${metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)}`);
```

### 2. Health Checks

```typescript
const health = await classificationService.getHealthStatus();
if (!health.healthy) {
  console.error('Service is unhealthy:', health.details);
}
```

### 3. Structured Logging

```typescript
import { Logger } from '@shared/utils/logger';

const logger = new Logger('UnifiedClassificationService');
const service = new UnifiedClassificationService(supabase, config, logger);
```

## Migration Steps

### Step 1: Update Imports

Replace singleton import with class import:

```diff
- import { unifiedClassificationService } from '@shared/services/unified-classification-service';
+ import { UnifiedClassificationService } from '@shared/services/unified-classification-service-refactored';
```

### Step 2: Set Up Dependencies

Create the required service configuration:

```typescript
import { SupabaseClientService } from '@shared/services/supabase-client';
import { GoogleDriveService } from '@shared/services/google-drive-refactored';
import { PromptService } from '@shared/services/prompt-service-refactored';
import { claudeService } from '@shared/services/claude-service';
import { FilterService } from '@shared/services/filter-service-refactored';
import { Logger } from '@shared/utils/logger';

const supabase = SupabaseClientService.getInstance().getClient();
const logger = new Logger('ClassificationWorkflow');

const config = {
  googleDriveService: GoogleDriveService.getInstance({
    serviceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './.service-account.json',
    enableBrowser: false,
  }),
  promptService: new PromptService(supabase, logger),
  claudeService: claudeService,
  pdfProcessorService: pdfProcessorService, // Ensure this exists
  filterService: new FilterService(supabase, logger),
};
```

### Step 3: Create Service Instance

```typescript
const classificationService = new UnifiedClassificationService(supabase, config, logger);
```

### Step 4: Update Method Calls

The API remains the same, but now called on the instance:

```diff
- const result = await unifiedClassificationService.classifyDocuments(options);
+ const result = await classificationService.classifyDocuments(options);
```

## Example Migrations

### CLI Script Migration

**Before**:
```typescript
// scripts/classify-documents.ts
import { unifiedClassificationService } from '@shared/services/unified-classification-service';

async function main() {
  const result = await unifiedClassificationService.classifyDocuments({
    limit: 10,
    types: ['pdf', 'md'],
    verbose: true,
  });
  
  console.log(`Processed ${result.successfulFiles} files`);
}
```

**After**:
```typescript
// scripts/classify-documents.ts
import { UnifiedClassificationService } from '@shared/services/unified-classification-service-refactored';
import { SupabaseClientService } from '@shared/services/supabase-client';
import { GoogleDriveService } from '@shared/services/google-drive-refactored';
import { PromptService } from '@shared/services/prompt-service-refactored';
import { claudeService } from '@shared/services/claude-service';
import { FilterService } from '@shared/services/filter-service-refactored';
import { Logger } from '@shared/utils/logger';

async function main() {
  const logger = new Logger('ClassifyDocuments');
  const supabase = SupabaseClientService.getInstance().getClient();
  
  const config = {
    googleDriveService: GoogleDriveService.getInstance({
      serviceAccountPath: './.service-account.json',
      enableBrowser: false,
    }),
    promptService: new PromptService(supabase, logger),
    claudeService: claudeService,
    pdfProcessorService: pdfProcessorService,
    filterService: new FilterService(supabase, logger),
  };
  
  const classificationService = new UnifiedClassificationService(supabase, config, logger);
  
  const result = await classificationService.classifyDocuments({
    limit: 10,
    types: ['pdf', 'md'],
    verbose: true,
  });
  
  console.log(`Processed ${result.successfulFiles} files`);
  
  // New: Access metrics
  const metrics = classificationService.getMetrics();
  logger.info('Classification metrics', metrics);
}
```

### Service Integration Migration

**Before**:
```typescript
// Another service using classification
export class DocumentProcessingService {
  async processDocuments() {
    const result = await unifiedClassificationService.classifyDocuments({
      limit: 50,
    });
    return result;
  }
}
```

**After**:
```typescript
import { UnifiedClassificationService } from '@shared/services/unified-classification-service-refactored';

export class DocumentProcessingService {
  constructor(
    private classificationService: UnifiedClassificationService,
    private logger?: Logger
  ) {}
  
  async processDocuments() {
    const result = await this.classificationService.classifyDocuments({
      limit: 50,
    });
    
    // New: Health check before processing
    const health = await this.classificationService.getHealthStatus();
    if (!health.healthy) {
      throw new Error('Classification service is unhealthy');
    }
    
    return result;
  }
}

// Usage with dependency injection
const classificationService = new UnifiedClassificationService(supabase, config, logger);
const documentService = new DocumentProcessingService(classificationService, logger);
```

## Testing Migration

### Before (Limited Testing)

The singleton pattern made testing difficult with global state.

### After (Comprehensive Testing)

Dependency injection enables easy mocking:

```typescript
import { UnifiedClassificationService } from './UnifiedClassificationService';

describe('UnifiedClassificationService', () => {
  let service: UnifiedClassificationService;
  let mockSupabase: any;
  let mockConfig: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    mockConfig = createMockConfig();
    service = new UnifiedClassificationService(mockSupabase, mockConfig);
  });

  it('should process documents successfully', async () => {
    const result = await service.classifyDocuments({ limit: 1 });
    expect(result.successfulFiles).toBe(1);
  });
});
```

## Performance Improvements

The refactored service includes:

1. **Metrics Tracking**: Detailed performance monitoring
2. **Cache Awareness**: Tracks cache hits/misses for optimization
3. **Concurrency Control**: Better handling of parallel processing
4. **Health Monitoring**: Proactive service health management

### Benchmark Results

Run the benchmark to see performance improvements:

```bash
cd packages/shared/services/unified-classification-service-refactored
ts-node benchmark.ts
```

Expected improvements:
- Better memory management (no global singleton state)
- Improved error handling and recovery
- Enhanced observability through metrics
- More predictable performance characteristics

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**: Change imports back to original service
2. **Gradual Migration**: Migrate services one at a time
3. **Testing in Isolation**: Use feature flags to test new service

```typescript
// Rollback import
import { unifiedClassificationService } from '@shared/services/unified-classification-service';

// Resume using original service
const result = await unifiedClassificationService.classifyDocuments(options);
```

## Validation Checklist

After migration, verify:

- [ ] All imports updated to new service
- [ ] Dependencies properly configured
- [ ] Service instantiation working correctly
- [ ] All method calls updated
- [ ] Tests passing with new service
- [ ] Metrics and health checks accessible
- [ ] Performance meets or exceeds original
- [ ] Error handling working as expected
- [ ] Logging configured and working

## Support

For migration assistance:

1. Check existing migrations in other refactored services
2. Review test files for proper dependency setup
3. Use benchmark to validate performance
4. Consult SERVICE_REFACTORING_COMPLETE_GUIDE.md for patterns

## Conclusion

This migration transforms UnifiedClassificationService from a rigid singleton to a flexible, testable, and observable business service. While it requires initial setup work, the benefits include:

- **Better Architecture**: Follows established service patterns
- **Enhanced Testing**: Full test coverage with dependency injection
- **Improved Monitoring**: Comprehensive metrics and health checks
- **Greater Flexibility**: Easy to configure and extend
- **Better Maintainability**: Clear dependencies and structured logging

The investment in migration will pay dividends in service reliability, maintainability, and development velocity.