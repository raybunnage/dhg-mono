# Phase 2 Careful Migration Plan

## Overview

Migrating imports from `packages/cli` to existing shared services. Key finding: `PromptQueryService` functionality already exists in `packages/shared/services/prompt-service`.

## Migration Strategy

### 1. Service Mapping

| Old Service (packages/cli) | Existing Shared Service | Notes |
|---------------------------|------------------------|-------|
| PromptQueryService | PromptService | Same functionality, different method names |
| SupabaseClientService | SupabaseClientService | Already in shared |
| FileService | FileService | Already in shared |
| Logger | Logger | Already in shared/utils |
| ErrorHandler | - | Remove, use try/catch |
| config | - | Remove, use env vars |

### 2. Method Mapping

| Old Method | New Method | Notes |
|-----------|------------|-------|
| getPromptWithQueryResults() | loadPrompt() | Different return format |
| Returns: { prompt, databaseQueryResults } | Returns: { prompt, databaseQueries: [...] } | Need to update destructuring |

### 3. Files to Update

**Presentations Pipeline (6 files)**:
- generate-summary.ts
- test-process-document.ts
- process-mp4-files.ts
- process-mp4-files-action.ts
- check-prompt.ts

**Scripts Pipeline (1 file)**:
- classify-script-with-prompt.ts

**Document Pipeline (3 files)**:
- sync-markdown-files.ts
- display-doc-paths-simple.ts
- display-doc-paths-enhanced.ts

### 4. Manual Fixes Required After Migration

1. **Return Format Changes**:
   ```typescript
   // Old:
   const { prompt: summaryPrompt } = await promptQueryService.getPromptWithQueryResults('name');
   
   // New:
   const result = await promptService.loadPrompt('name');
   const summaryPrompt = result.prompt;
   ```

2. **Error Handling**:
   ```typescript
   // Old:
   ErrorHandler.handle(error);
   
   // New:
   try {
     // code
   } catch (error) {
     console.error('Error:', error);
   }
   ```

3. **Config Usage**:
   ```typescript
   // Old:
   const value = config.get('key');
   
   // New:
   const value = process.env.KEY || 'default';
   ```

### 5. Testing Plan

After migration:
1. Test presentations pipeline commands
2. Test document pipeline commands
3. Test scripts pipeline command
4. Verify prompt loading still works
5. Check database query execution

### 6. Rollback Plan

If issues arise:
1. Git reset to before migration
2. Keep packages/cli temporarily
3. Fix issues incrementally

## Execution Steps

1. ✅ Created migration script: `migrate-cli-imports.ts`
2. ⏳ Run migration script
3. ⏳ Manual fixes for return format changes
4. ⏳ Test all affected pipelines
5. ⏳ Archive packages/cli once verified