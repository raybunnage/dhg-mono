# Phase 2 Migration Analysis: packages/cli → shared/services

## Current State Analysis

### Files Importing from packages/cli

1. **Presentations Pipeline (5 files)**
   - `generate-summary.ts` - imports PromptQueryService
   - `test-process-document.ts` - imports PromptQueryService
   - `process-mp4-files.ts` - imports PromptQueryService
   - `process-mp4-files-action.ts` - imports PromptQueryService
   - `check-prompt.ts` - imports PromptQueryService

2. **Document Pipeline (3 files)**
   - `sync-markdown-files.ts` - imports FileService, ErrorHandler, Logger, SupabaseClient
   - `display-doc-paths-simple.ts` - imports config, Logger
   - `display-doc-paths-enhanced.ts` - imports config, Logger, LogLevel

3. **Scripts Pipeline (1 file)**
   - `classify-script-with-prompt.ts` - imports PromptQueryService

4. **Utilities (1 file)**
   - `archive-packages.ts` - imports from shared (already migrated)

### Services Being Used

1. **PromptQueryService** (6 files)
   - Retrieves prompts from database
   - Executes associated database queries
   - Handles special cases for document_types

2. **FileService** (1 file)
   - File discovery and management

3. **Logger** (3 files)
   - Logging utility with LogLevel enum

4. **Config** (2 files)
   - Configuration utility

5. **ErrorHandler** (1 file)
   - Error handling utility

6. **SupabaseClient** (1 file)
   - Database client service

### Existing Shared Services

1. **prompt-service** exists but serves different purpose:
   - PromptManagementService - manages prompt templates
   - PromptOutputTemplateService - manages output templates
   - Does NOT have PromptQueryService functionality

2. **file-service** exists in shared
3. **supabase-client** exists in shared
4. **Logger** exists in shared/utils

### Migration Strategy

#### Phase 2A: Create Missing Services in Shared
1. Create `PromptQueryService` in shared/services/prompt-service
   - Move the query execution functionality
   - Maintain the same interface for compatibility

#### Phase 2B: Update Imports (9 files)
1. Update presentation pipeline files (5)
2. Update document pipeline files (3)
3. Update scripts pipeline file (1)

#### Phase 2C: Verify and Archive
1. Run tests on affected pipelines
2. Archive packages/cli

### Risk Assessment

- **Low Risk**: PromptQueryService is well-isolated
- **Medium Risk**: Config and Logger changes affect multiple files
- **Mitigation**: Update imports one pipeline at a time