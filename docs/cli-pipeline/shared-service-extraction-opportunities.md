# CLI Pipeline Shared Service Extraction Opportunities

Generated: 2025-06-07

## Executive Summary

After analyzing all 38 CLI pipelines that now pass health checks, I've identified significant opportunities to extract common functionality into shared services. This will reduce code duplication, improve maintainability, and ensure consistent behavior across pipelines.

## High-Priority Extraction Opportunities

### 1. **FileSystemService** (Most Duplicated Code)

**Current Duplication**: Found in 15+ pipelines
**Priority**: HIGH

**Functions to Extract**:
```typescript
interface FileSystemService {
  // File hashing (appears in google_sync, document, media-processing)
  calculateFileHash(filePath: string): Promise<string | null>
  
  // Directory walking (appears in document, google_sync, scripts)
  walkDir(dir: string, options?: WalkOptions): Promise<FileMetadata[]>
  
  // File metadata extraction
  getFileMetadata(filePath: string): Promise<FileMetadata>
  
  // Path utilities
  ensureDirectoryExists(path: string): Promise<void>
  getRelativePath(from: string, to: string): string
}
```

**Affected Pipelines**:
- google_sync (sync-files.ts, scan-drive.ts)
- document (document-service.ts, find-new-files.ts)
- media-processing (check-audio-exists.ts)
- scripts (sync-scripts.ts)

### 2. **BatchDatabaseService** (Performance Critical)

**Current Duplication**: Found in 12+ pipelines
**Priority**: HIGH

**Functions to Extract**:
```typescript
interface BatchDatabaseService {
  // Batch operations with progress tracking
  batchInsert<T>(table: string, data: T[], options?: BatchOptions): Promise<BatchResult>
  batchUpdate<T>(table: string, updates: T[], options?: BatchOptions): Promise<BatchResult>
  batchDelete(table: string, ids: string[], options?: BatchOptions): Promise<BatchResult>
  
  // Transaction management
  runInTransaction<T>(callback: () => Promise<T>): Promise<T>
}

interface BatchOptions {
  batchSize?: number
  onProgress?: (progress: Progress) => void
  onError?: (error: Error, item: any) => void
}
```

**Affected Pipelines**:
- google_sync (sync-files.ts, sync-sources.ts)
- scripts (import-scripts.ts, sync-scripts.ts)
- email (sync-emails.ts)
- media-processing (batch-transcribe.ts)

### 3. **ProgressTrackingService** (User Experience)

**Current Duplication**: Found in 10+ pipelines
**Priority**: MEDIUM

**Functions to Extract**:
```typescript
interface ProgressTrackingService {
  // Console progress displays
  createProgressBar(total: number, label: string): ProgressBar
  updateProgress(current: number, message?: string): void
  
  // Rate and ETA calculation
  calculateRate(processed: number, startTime: Date): number
  estimateTimeRemaining(current: number, total: number, startTime: Date): string
  
  // Multi-step progress
  createMultiStepProgress(steps: string[]): MultiStepProgress
}
```

**Affected Pipelines**:
- google_sync (all sync commands)
- media-processing (batch-transcribe.ts)
- email (sync-emails.ts)
- scripts (import-scripts.ts)

### 4. **ShellExecutionService** (System Integration)

**Current Duplication**: Found in 8+ pipelines
**Priority**: MEDIUM

**Functions to Extract**:
```typescript
interface ShellExecutionService {
  // Safe command execution
  execute(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>
  
  // Python script execution
  executePython(scriptPath: string, args: string[]): Promise<ExecResult>
  
  // Process management
  killProcess(pid: number): Promise<void>
  isProcessRunning(pid: number): boolean
}

interface ExecOptions {
  timeout?: number
  cwd?: string
  env?: Record<string, string>
  captureOutput?: boolean
}
```

**Affected Pipelines**:
- media-processing (transcribe commands)
- scripts (various script runners)
- ai (python script execution)

### 5. **ClaudePromptService** (AI Integration)

**Current Duplication**: Found in 6+ pipelines
**Priority**: MEDIUM

**Functions to Extract**:
```typescript
interface ClaudePromptService {
  // Prompt management
  loadPromptTemplate(name: string): Promise<string>
  formatPrompt(template: string, variables: Record<string, any>): string
  
  // Response parsing
  parseJsonResponse<T>(response: string): T
  extractCodeBlocks(response: string): CodeBlock[]
  
  // Error handling
  handleClaudeError(error: any): ClaudeError
}
```

**Affected Pipelines**:
- scripts (analyze-scripts.ts)
- presentations (generate-presentation.ts)
- ai (various AI commands)

## Implementation Recommendations

### Phase 1: Core Services (Week 1)
1. **FileSystemService** - Most reused functionality
2. **BatchDatabaseService** - Critical for performance
3. Update affected pipelines to use new services

### Phase 2: Enhancement Services (Week 2)
1. **ProgressTrackingService** - Improve user experience
2. **ShellExecutionService** - Standardize system calls
3. **ClaudePromptService** - Centralize AI integration

### Phase 3: Specialized Services (Week 3)
1. **GoogleDriveEnhancedService** - Build on existing service
2. **MediaProcessingUtilsService** - Extend current audio services
3. **DocumentAnalysisService** - Advanced document utilities

## Expected Benefits

1. **Code Reduction**: ~30-40% reduction in pipeline code
2. **Consistency**: Standardized error handling and logging
3. **Performance**: Optimized batch operations across all pipelines
4. **Maintainability**: Single source of truth for common operations
5. **Testing**: Centralized testing for critical functionality

## Migration Strategy

1. **Create services incrementally** - Start with FileSystemService
2. **Test thoroughly** - Each service should have comprehensive tests
3. **Migrate pipelines gradually** - Update one pipeline at a time
4. **Maintain backward compatibility** - During transition period
5. **Document patterns** - Create usage examples for each service

## Success Metrics

- Number of duplicate code blocks eliminated
- Reduction in pipeline-specific code
- Improvement in test coverage
- Decrease in bug reports for common operations
- Developer satisfaction with shared services

## Next Steps

1. Review and prioritize this list with the team
2. Create GitHub issues for each service
3. Begin with FileSystemService implementation
4. Set up service testing framework
5. Create migration guide for pipeline authors