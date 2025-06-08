# File Service Migration Guide

## Overview

Currently, there are multiple implementations of file system utilities:
1. `/scripts/cli-pipeline/shared/file-service.ts` - Used by document and script pipelines
2. Individual `calculateFileHash` functions in various pipelines
3. Custom `walkDir` implementations in different pipelines

This guide shows how to migrate to the new centralized `FileSystemService` in `packages/shared/services/`.

## Key Differences

### Old Pattern (CLI Pipeline Specific):
```typescript
// In scripts/cli-pipeline/shared/file-service.ts
import { fileService } from '../shared/file-service';

const hash = fileService.calculateFileHash(filePath);
const files = fileService.walkDir(dir, ['.md'], ['node_modules']);
```

### New Pattern (Shared Service):
```typescript
// In any pipeline or app
import { fileSystemService } from '@shared/services/file-system-service';

const hash = await fileSystemService.calculateFileHash(filePath);
const files = await fileSystemService.walkDir(dir, {
  excludePatterns: [/node_modules/],
  includeDirectories: false
});
```

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import { fileService, FileMetadata } from '../shared/file-service';
```

**After:**
```typescript
import { fileSystemService, FileMetadata } from '@shared/services/file-system-service';
```

### 2. Update Method Calls

The new service uses async/await pattern consistently:

**Before:**
```typescript
const hash = fileService.calculateFileHash(filePath); // Synchronous
```

**After:**
```typescript
const hash = await fileSystemService.calculateFileHash(filePath); // Async
```

### 3. Update walkDir Options

The new service uses a more flexible options object:

**Before:**
```typescript
const files = fileService.walkDir(
  dir,
  ['.md', '.txt'],        // includePatterns
  ['node_modules'],       // excludeDirs
  true                    // includeHash
);
```

**After:**
```typescript
const files = await fileSystemService.walkDir(dir, {
  excludePatterns: [
    /node_modules/,
    /\.git/,
    /dist/
  ],
  includeDirectories: false,
  maxDepth: 10
});

// Filter by extension after if needed
const mdFiles = files.filter(f => 
  f.name.endsWith('.md') || f.name.endsWith('.txt')
);
```

### 4. Hash Calculation with Options

The new service supports multiple hash algorithms:

```typescript
// SHA256 (default)
const sha256Hash = await fileSystemService.calculateFileHash(filePath);

// MD5
const md5Hash = await fileSystemService.calculateFileHash(filePath, {
  algorithm: 'md5',
  encoding: 'hex'
});
```

## Example Migration: Document Pipeline

### Before (using cli-pipeline shared service):
```typescript
import { fileService } from '../shared/file-service';

export async function syncDocuments() {
  const files = fileService.findDocumentationFiles(true);
  
  for (const file of files) {
    const fullPath = path.join(process.cwd(), file.path);
    // Process file...
  }
}
```

### After (using shared service):
```typescript
import { fileSystemService } from '@shared/services/file-system-service';

export async function syncDocuments() {
  const files = await fileSystemService.walkDir(process.cwd(), {
    excludePatterns: [
      /node_modules/,
      /\.git/,
      /dist/,
      /backup/,
      /archive/
    ]
  });
  
  // Filter for documentation files
  const docFiles = files.filter(f => {
    const ext = fileSystemService.getFileExtension(f.path);
    return ['.md', '.txt', '.pdf', '.docx', '.doc', '.rtf'].includes(ext);
  });
  
  // Add hashes if needed
  for (const file of docFiles) {
    file.hash = await fileSystemService.calculateFileHash(file.path);
    // Process file...
  }
}
```

## Benefits of Migration

1. **Consistency**: All pipelines use the same file operations
2. **Performance**: Async operations allow better concurrency
3. **Flexibility**: More options for filtering and processing
4. **Maintenance**: Single source of truth for file operations
5. **Testing**: Centralized testing for critical operations

## Deprecation Timeline

1. **Phase 1** (Now): New FileSystemService available
2. **Phase 2** (Week 2): Migrate high-priority pipelines
3. **Phase 3** (Week 3): Migrate remaining pipelines
4. **Phase 4** (Week 4): Deprecate old file-service.ts

## Need Help?

- Check the FileSystemService source code for all available methods
- Look at migrated pipelines for examples
- Ask in the development channel for assistance