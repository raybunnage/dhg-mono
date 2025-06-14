# GitOperationsService Migration Guide

## Overview

The GitOperationsService has been migrated from a standalone utility class to a proper SingletonService following the DHG service architecture standards. This migration brings comprehensive health monitoring, metrics tracking, caching, and structured logging to git operations.

## Breaking Changes

### Import Changes
```typescript
// ❌ OLD - Direct class import
import { GitOperationsService } from '../../../packages/shared/services/git-operations/GitOperationsService';

// ✅ NEW - Proper service import
import { GitOperationsService } from '@shared/services/git-operations';
```

### Instance Creation Changes
```typescript
// ❌ OLD - Direct instantiation (if it existed)
const gitOps = new GitOperationsService();

// ✅ NEW - Singleton pattern
const gitOps = GitOperationsService.getInstance();

// ✅ NEW - With configuration
const gitOps = GitOperationsService.getInstance({
  workingDirectory: '/custom/repo',
  cacheTimeout: 60000,
  enableMetrics: true
});
```

### Method Signature Changes

Most core methods remain the same, but now return `GitOperationResult<T>` objects:

```typescript
// ❌ OLD - Direct results (if methods existed)
const worktrees = await gitOps.getWorktrees();

// ✅ NEW - Structured results
const result = await gitOps.listWorktrees();
if (result.success) {
  const worktrees = result.data;
} else {
  console.error('Error:', result.error);
}
```

## New Features

### 1. Health Monitoring
```typescript
const gitService = GitOperationsService.getInstance();

// Check if service is healthy
if (gitService.isHealthy()) {
  // Service is ready
}

// Get detailed health information
const health = gitService.getHealth();
console.log('Git available:', health.gitAvailable);
console.log('Repository valid:', health.repositoryValid);
console.log('Cache size:', health.cacheSize);
```

### 2. Metrics Tracking
```typescript
const metrics = gitService.getMetrics();
console.log('Worktree operations:', metrics.worktreeOperations);
console.log('Cache hit rate:', metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses));
console.log('Average execution time:', metrics.averageExecutionTime);
```

### 3. Caching System
```typescript
// Operations are automatically cached
const result1 = await gitService.listWorktrees(); // Cache miss
const result2 = await gitService.listWorktrees(); // Cache hit (faster)

// Clear cache when needed
gitService.clearCache();
```

### 4. Structured Logging
```typescript
import { Logger } from '@shared/services/logger-service';

const logger = new Logger('GitOperations');
const gitService = GitOperationsService.getInstance(undefined, logger);

// All operations are automatically logged with structured data
```

## Migration Steps

### Step 1: Update Imports
Replace any existing imports with the new standardized import:

```typescript
import { GitOperationsService } from '@shared/services/git-operations';
```

### Step 2: Update Instance Creation
Convert any direct instantiation to singleton pattern:

```typescript
// Get instance with default configuration
const gitService = GitOperationsService.getInstance();

// Or with custom configuration
const gitService = GitOperationsService.getInstance({
  workingDirectory: process.cwd(),
  cacheTimeout: 30000,
  enableMetrics: true
});
```

### Step 3: Update Method Calls
Update method calls to handle the new result structure:

```typescript
// Before
try {
  const worktrees = await gitOps.someMethod();
  // use worktrees
} catch (error) {
  console.error(error);
}

// After
const result = await gitService.listWorktrees();
if (result.success) {
  const worktrees = result.data;
  // use worktrees
} else {
  console.error('Git operation failed:', result.error);
}
```

### Step 4: Add Health Checks (Optional)
Consider adding health checks in critical paths:

```typescript
if (!gitService.isHealthy()) {
  throw new Error('Git service is not available');
}
```

### Step 5: Add Metrics Collection (Optional)
In monitoring or admin interfaces, collect metrics:

```typescript
const metrics = gitService.getMetrics();
const health = gitService.getHealth();

// Log or send to monitoring system
console.log('Git service metrics:', { metrics, health });
```

## API Reference

### Core Methods

#### `listWorktrees(): Promise<GitOperationResult<GitWorktree[]>>`
List all git worktrees in the repository.

```typescript
const result = await gitService.listWorktrees();
if (result.success) {
  result.data.forEach(worktree => {
    console.log(`${worktree.path} -> ${worktree.branch} (${worktree.commit})`);
  });
}
```

#### `createWorktree(path: string, options?: WorktreeCreateOptions): Promise<GitOperationResult<void>>`
Create a new git worktree.

```typescript
const result = await gitService.createWorktree('/path/to/new/worktree', {
  branch: 'feature-branch',
  checkout: 'main'
});
```

#### `removeWorktree(path: string, force?: boolean): Promise<GitOperationResult<void>>`
Remove an existing git worktree.

```typescript
const result = await gitService.removeWorktree('/path/to/worktree', true);
```

#### `listBranches(includeRemote?: boolean): Promise<GitOperationResult<GitBranch[]>>`
List all branches in the repository.

```typescript
const result = await gitService.listBranches(true); // Include remote branches
if (result.success) {
  const currentBranch = result.data.find(branch => branch.current);
}
```

#### `createBranch(name: string, startPoint?: string): Promise<GitOperationResult<void>>`
Create a new branch.

```typescript
const result = await gitService.createBranch('feature-branch', 'main');
```

#### `deleteBranch(name: string, force?: boolean): Promise<GitOperationResult<void>>`
Delete a branch.

```typescript
const result = await gitService.deleteBranch('feature-branch', false);
```

#### `getCommitHistory(limit?: number, branch?: string): Promise<GitOperationResult<GitCommit[]>>`
Get commit history.

```typescript
const result = await gitService.getCommitHistory(10, 'main');
if (result.success) {
  result.data.forEach(commit => {
    console.log(`${commit.shortHash}: ${commit.message} by ${commit.author}`);
  });
}
```

#### `getCommit(hash: string): Promise<GitOperationResult<GitCommit>>`
Get details of a specific commit.

```typescript
const result = await gitService.getCommit('abc123');
if (result.success) {
  console.log('Files changed:', result.data.filesChanged);
  console.log('Insertions:', result.data.insertions);
  console.log('Deletions:', result.data.deletions);
}
```

#### `getStatus(): Promise<GitOperationResult<GitStatus>>`
Get current repository status.

```typescript
const result = await gitService.getStatus();
if (result.success) {
  console.log('Current branch:', result.data.branch);
  console.log('Clean working tree:', result.data.clean);
  console.log('Staged files:', result.data.staged);
}
```

#### `mergeBranch(branch: string, options?: MergeOptions): Promise<GitOperationResult<void>>`
Merge a branch into the current branch.

```typescript
const result = await gitService.mergeBranch('feature-branch', {
  strategy: 'recursive',
  fastForward: true
});
```

### Health & Monitoring Methods

#### `isHealthy(): boolean`
Quick health check.

#### `getHealth(): GitOperationsServiceHealth`
Detailed health information.

#### `getMetrics(): GitOperationsServiceMetrics`
Performance and usage metrics.

#### `clearCache(): void`
Clear all cached results.

#### `getConfig(): GitOperationsServiceConfig`
Get current service configuration.

## Configuration Options

```typescript
interface GitOperationsServiceConfig {
  workingDirectory?: string;    // Git repository path (default: process.cwd())
  cacheTimeout?: number;        // Cache timeout in ms (default: 30000)
  maxCacheSize?: number;        // Maximum cache entries (default: 1000)
  enableMetrics?: boolean;      // Enable metrics tracking (default: true)
  gitPath?: string;            // Git executable path (default: 'git')
}
```

## Error Handling

All methods return `GitOperationResult<T>` objects with consistent error handling:

```typescript
interface GitOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  stdout?: string;
  stderr?: string;
  command?: string;
}
```

This allows for consistent error handling across all git operations:

```typescript
const result = await gitService.someOperation();
if (!result.success) {
  console.error('Operation failed:', result.error);
  if (result.stderr) {
    console.error('Git stderr:', result.stderr);
  }
  if (result.command) {
    console.error('Failed command:', result.command);
  }
}
```

## Performance Considerations

### Caching
- All read operations are cached automatically
- Cache timeout is configurable (default: 30 seconds)
- Clear cache after write operations that might affect cached data
- Monitor cache hit rates through metrics

### Concurrent Operations
- The service handles concurrent operations safely
- Use the singleton pattern to avoid creating multiple instances
- Monitor metrics to identify performance bottlenecks

### Memory Usage
- Cache has configurable size limits
- Monitor memory usage through health checks
- Clear cache periodically in long-running processes

## Testing

### Unit Tests
```bash
# Run the comprehensive test suite
npm test packages/shared/services/git-operations/GitOperationsService.test.ts
```

### Benchmarks
```bash
# Run performance benchmarks
ts-node packages/shared/services/git-operations/GitOperationsService.benchmark.ts
```

### Integration Testing
```typescript
import { GitOperationsService } from '@shared/services/git-operations';

// Test in a real git repository
const gitService = GitOperationsService.getInstance({
  workingDirectory: '/path/to/test/repo'
});

const result = await gitService.listWorktrees();
expect(result.success).toBe(true);
```

## Troubleshooting

### Common Issues

1. **Git not found**
   ```typescript
   const health = gitService.getHealth();
   if (!health.gitAvailable) {
     console.error('Git executable not found in PATH');
   }
   ```

2. **Invalid working directory**
   ```typescript
   const health = gitService.getHealth();
   if (!health.workingDirectoryValid) {
     console.error('Working directory is not a valid git repository');
   }
   ```

3. **Cache issues**
   ```typescript
   // Clear cache if getting stale data
   gitService.clearCache();
   ```

4. **Performance issues**
   ```typescript
   const metrics = gitService.getMetrics();
   console.log('Average execution time:', metrics.averageExecutionTime);
   console.log('Cache hit rate:', metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses));
   ```

### Debug Mode
Enable debug logging for detailed operation information:

```typescript
import { Logger } from '@shared/services/logger-service';

const logger = new Logger('GitOperations', 'debug');
const gitService = GitOperationsService.getInstance(undefined, logger);
```

## Database Integration

The service automatically registers itself in the `sys_shared_services` table with:
- Service type: 'Infrastructure'
- Base class: 'SingletonService'
- Dependency injection: false
- Health checks: enabled
- Metrics tracking: enabled

Monitor service health through the database:
```sql
SELECT * FROM sys_shared_services WHERE service_name = 'GitOperationsService';
```

## Conclusion

The migrated GitOperationsService provides a robust, observable, and maintainable solution for git operations. The singleton pattern ensures efficient resource usage, while the comprehensive monitoring capabilities enable better operational visibility.

For questions or issues with the migration, consult the service documentation or check the comprehensive test suite for usage examples.