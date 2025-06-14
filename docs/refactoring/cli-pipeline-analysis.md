# CLI Pipeline Analysis: Code Duplication & Service Extraction Opportunities

## Executive Summary

After analyzing the CLI pipelines in `scripts/cli-pipeline/`, I've identified significant opportunities for code consolidation and service extraction. The analysis reveals widespread duplication of core functionality that could be centralized into shared services, improving maintainability and consistency across the codebase.

## Key Findings

### 1. Direct Database Operations (77 files)

Many pipelines contain direct Supabase queries that should be abstracted into domain-specific services:

**Common Patterns:**
- Direct `supabase.from()` calls scattered across pipelines
- Repeated table queries (e.g., `google_sources`, `expert_documents`, `document_types`)
- Inconsistent error handling for database operations
- Duplicate query logic for common operations

**Examples:**
```typescript
// Found in multiple files:
const { data, error } = await supabase
  .from('google_sources')
  .select('*')
  .eq('mime_type', 'application/pdf')
  .is('is_deleted', false);
```

### 2. AI/Claude Service Usage (48 files)

Multiple pipelines implement similar AI processing patterns:

**Common Patterns:**
- Direct `claudeService.sendPrompt()` calls
- Duplicate prompt construction logic
- Inconsistent error handling for Claude API failures
- Repeated retry logic with exponential backoff
- Similar PDF processing workflows

**Example Duplication:**
- `google_sync/classify-pdfs-with-service.ts` - 1270 lines with extensive PDF processing
- `media-processing/commands/process-summary.ts` - Similar Claude integration
- `presentations/commands/generate-summary.ts` - Duplicate prompt handling

### 3. File System Operations (191+ files)

Extensive file operations that could benefit from a unified file service:

**Common Patterns:**
- Direct `fs` operations without proper error handling
- Duplicate file reading/writing logic
- Inconsistent path resolution
- Repeated temporary file management
- No centralized file validation

### 4. Git Operations (20 files)

Git command execution scattered across pipelines:

**Common Patterns:**
- Direct `execSync` calls for git commands
- Duplicate branch management logic
- Inconsistent error handling
- Repeated worktree operations

### 5. Google Drive Operations

Multiple pipelines interact with Google Drive independently:

**Common Patterns:**
- Authentication logic repeated
- File download/upload code duplicated
- Folder traversal logic repeated
- No centralized error handling

## Recommended Service Extractions

### 1. **DocumentQueryService**
Centralize all document-related database operations:
- Document type lookups
- Expert document management
- Classification operations
- Batch processing queries

### 2. **AIProcessingService**
Unify AI/Claude operations:
- Prompt management
- Retry logic with backoff
- Response parsing
- Error handling
- Token management

### 3. **FileProcessingService**
Consolidate file operations:
- Safe file reading/writing
- Temporary file management
- Path resolution
- File validation
- Cleanup operations

### 4. **GitOperationService**
Centralize git commands:
- Branch operations
- Commit management
- Worktree operations
- Status checking

### 5. **GoogleDriveQueryService**
Extend existing Google Drive service:
- Batch file operations
- Folder structure queries
- Metadata management
- Download/upload queuing

### 6. **BatchProcessingService** (Enhancement)
Improve existing service:
- Progress tracking
- Error recovery
- Concurrency management
- Result aggregation

## Specific Code Duplication Examples

### 1. PDF Classification Logic
- **Files:** `classify-pdfs-with-service.ts`, `direct-classify-pdfs.ts`, `validate-pdf-classification.ts`
- **Duplication:** PDF download, temp file management, Claude API calls
- **Lines of duplicate code:** ~500+ lines

### 2. Database Queries
- **Pattern:** Expert document queries repeated in 15+ files
- **Example:**
  ```typescript
  // This query appears in multiple variations
  await supabase
    .from('google_expert_documents')
    .select('*')
    .eq('document_processing_status', 'needs_reprocessing')
  ```

### 3. Error Handling
- **Pattern:** Claude API retry logic duplicated
- **Files:** 10+ files implement similar retry patterns
- **Opportunity:** Central retry service with configurable backoff

### 4. File Operations
- **Pattern:** Temp file creation and cleanup
- **Files:** 20+ files create temporary files
- **Issue:** Inconsistent cleanup, path handling

## Impact Analysis

### Current Issues:
1. **Maintenance burden**: Changes need to be made in multiple places
2. **Inconsistency**: Different error handling, logging approaches
3. **Testing difficulty**: Logic scattered across files
4. **Performance**: No shared caching or connection pooling
5. **Reliability**: Inconsistent retry and error recovery

### Benefits of Consolidation:
1. **Single source of truth** for business logic
2. **Consistent error handling** and logging
3. **Easier testing** with isolated services
4. **Performance optimization** through caching
5. **Reduced code size** (~30-40% reduction estimated)

## Migration Strategy

### Phase 1: Create Core Services
1. DocumentQueryService
2. AIProcessingService
3. FileProcessingService

### Phase 2: Gradual Migration
1. Start with new features using services
2. Migrate high-usage pipelines first
3. Update pipelines during bug fixes

### Phase 3: Cleanup
1. Remove duplicate code
2. Update documentation
3. Add comprehensive tests

## Conclusion

The CLI pipelines contain significant code duplication that impacts maintainability and reliability. By extracting common functionality into shared services, we can:
- Reduce codebase size by 30-40%
- Improve consistency and reliability
- Make testing easier
- Enable better performance optimization
- Reduce the learning curve for new developers

The recommended services align with the existing shared services architecture and would significantly improve the codebase quality.