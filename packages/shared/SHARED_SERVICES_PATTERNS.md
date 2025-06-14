# Shared Services Patterns Guide

## Overview

This guide documents the patterns and best practices for using shared services in the DHG monorepo. All CLI pipelines and applications should follow these patterns to ensure consistency, maintainability, and reusability.

## Core Principles

1. **Use Shared Services First**: Always check if a shared service exists before implementing functionality
2. **Extract Common Code**: If functionality is used by 2+ pipelines/apps, extract it to shared services
3. **Consistent Patterns**: Follow established patterns for service initialization and usage
4. **Cross-Environment Compatibility**: Services should work in both Node.js and browser environments

## Service Patterns

### 1. Singleton Pattern (CLI/Node.js)

For services used in CLI pipelines and Node.js environments:

```typescript
import { ServiceName } from '@shared/services';

// Get singleton instance
const service = ServiceName.getInstance();
```

### 2. Constructor Injection Pattern (Browser/Testing)

For services that need flexibility in browser apps or testing:

```typescript
import { ServiceName } from '@shared/services';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Create with specific client
const supabase = createSupabaseAdapter({ env: import.meta.env });
const service = new ServiceName(supabase);
```

### 3. Hybrid Pattern (Universal)

For maximum flexibility across environments:

```typescript
export class ServiceName {
  static getInstance(client?: SupabaseClient): ServiceName {
    if (!client) {
      if (typeof window !== 'undefined') {
        throw new Error('Browser requires client parameter');
      }
      // Use singleton in Node.js
      client = SupabaseClientService.getInstance().getClient();
    }
    // Return instance for this client
  }
}
```

## Available Shared Services

### Data Services
- **SupabaseClientService**: Database connection management
- **DatabaseService**: High-level database operations
- **BatchDatabaseService**: Batch operations with retry logic
- **FilterService**: Query filtering and profile management
- **MediaAnalyticsService**: Media consumption analytics

### Processing Services
- **ClaudeService**: AI text processing
- **AIProcessingService**: Document analysis and classification
- **DocumentPipelineService**: Document processing pipeline
- **ScriptPipelineService**: Script analysis and management

### Utility Services
- **FileService**: File operations
- **FileSystemService**: Advanced file system operations
- **ConverterService**: File format conversions
- **FormatterService**: Consistent formatting

### Authentication Services
- **AuthService**: User authentication
- **LightAuthEnhancedService**: Enhanced auth with profiles
- **UserProfileService**: User profile management

### Feature Services
- **ElementCatalogService**: App features and CLI commands catalog
- **ElementCriteriaService**: Success criteria and quality gates

## Common Utilities

Located in `packages/shared/utils/`:

### Formatting Utilities
```typescript
import { formatDuration, formatBytes, formatPercentage } from '@shared/utils';

formatDuration(3661); // "1h 1m 1s"
formatBytes(1536); // "1.5 KB"
formatPercentage(0.75); // "75%"
```

### Date Helpers
```typescript
import { daysAgo, formatDate, getRelativeTime } from '@shared/utils';

const lastWeek = daysAgo(7);
formatDate(new Date()); // "Jan 15, 2024, 10:30 AM"
getRelativeTime(lastWeek); // "7 days ago"
```

### File Helpers
```typescript
import { generateFileHash, ensureDirectory, findFiles } from '@shared/utils';

const hash = await generateFileHash('/path/to/file');
await ensureDirectory('/path/to/new/dir');
const tsFiles = await findFiles('/src', /\.ts$/);
```

## Migration Examples

### Before (Direct Database Access)
```typescript
// ❌ Old pattern - direct Supabase queries
const { data, error } = await supabase
  .from('filter_user_profiles')
  .insert({ name, description });
```

### After (Using Shared Service)
```typescript
// ✅ New pattern - using FilterService
const filterService = new FilterService(supabase);
const profile = await filterService.createProfile({ name, description });
```

### Before (Local Utility Functions)
```typescript
// ❌ Old pattern - duplicated utility function
function formatDuration(seconds) {
  // Implementation duplicated across files
}
```

### After (Using Shared Utils)
```typescript
// ✅ New pattern - using shared utilities
import { formatDuration } from '@shared/utils';
```

## Creating New Shared Services

When creating a new shared service:

1. **Check for existing services** that could be extended
2. **Follow the hybrid pattern** for cross-environment support
3. **Add to index.ts** exports
4. **Document the service** in this guide
5. **Include TypeScript types** for all methods
6. **Add error handling** with meaningful messages
7. **Consider browser compatibility** from the start

## Best Practices

1. **Never create direct Supabase clients** - use SupabaseClientService or adapters
2. **Extract utilities early** - if you write the same function twice, extract it
3. **Type everything** - avoid `any` types, use proper interfaces
4. **Handle errors gracefully** - services should not crash the application
5. **Document service methods** - include JSDoc comments
6. **Test in both environments** - ensure services work in Node.js and browsers
7. **Keep services focused** - single responsibility principle

## Common Pitfalls to Avoid

1. ❌ **Creating multiple Supabase instances** - use the singleton
2. ❌ **Hardcoding credentials** - use environment variables
3. ❌ **Browser-specific code in shared services** - use environment detection
4. ❌ **Tight coupling to specific implementations** - use dependency injection
5. ❌ **Skipping error handling** - always handle potential failures

## Questions?

If you're unsure whether to create a shared service or how to implement a pattern, ask for guidance before proceeding. The goal is consistency and reusability across the entire codebase.