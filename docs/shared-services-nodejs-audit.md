# Shared Services Node.js Dependency Audit

**Date**: January 12, 2025

## Summary

This audit identifies Node.js-specific dependencies in `/packages/shared/services/` that prevent browser compatibility. Services are categorized by their ability to be made cross-platform.

## Service Categories

### ✅ BROWSER-COMPATIBLE (No Node.js dependencies)

These services have no Node.js dependencies and are already browser-compatible:

1. **audio-service/audio-service.ts**
   - Uses Supabase client only
   - No Node.js imports

2. **auth-service/browser-auth-service.ts**
   - Specifically designed for browser use
   - No Node.js imports

3. **auth-service/browser.ts**
   - Browser-specific exports
   - No Node.js imports

4. **supabase-cache.ts**
   - Pure TypeScript/JavaScript
   - No Node.js imports

5. **media-analytics-service/media-analytics-service.ts**
   - Uses Supabase client only
   - No Node.js imports

6. **media-tracking-service/media-tracking-service.ts**
   - Uses Supabase client only
   - No Node.js imports

7. **user-profile-service/user-profile-service.ts**
   - Uses Supabase client only
   - No Node.js imports

8. **light-auth-enhanced-service/light-auth-enhanced-service.ts**
   - Uses Supabase client only
   - No Node.js imports

9. **filter-service/filter-service-client.ts**
   - Client-side service
   - No Node.js imports

10. **element-catalog-service.ts**
    - Uses Supabase client only
    - No Node.js imports

11. **element-criteria-service.ts**
    - Uses Supabase client only
    - No Node.js imports

12. **google-drive/browser-index.ts**
    - Browser-safe exports only
    - No Node.js imports

13. **google-drive/google-drive-browser-service.ts**
    - Browser-compatible Google Drive service
    - No Node.js imports

14. **ai-processing-service/ai-processing-service.ts**
    - Uses Claude service only
    - No Node.js imports (no winston despite being in ai-processing)

### 🔧 NEEDS-MIGRATION (Has Node.js deps that can be made cross-platform)

These services can be refactored for cross-platform compatibility:

1. **claude-service/claude-service.ts**
   - **Issue**: Uses `process.env` directly
   - **Solution**: Already has `configure()` method for browser environments
   - **Action**: Move environment check to a separate initialization pattern

2. **supabase-service/supabase-service.ts**
   - **Issue**: Uses `@shared/utils/logger` (winston)
   - **Solution**: Replace with cross-platform logger or console
   - **Action**: Create browser-compatible logger interface

3. **supabase-client.ts & supabase-client/index.ts**
   - **Issue**: Uses `@shared/utils/logger` (winston), `process.env`
   - **Solution**: Already has pattern for browser adapter
   - **Action**: Remove logger dependency, use configuration pattern

4. **prompt-service/prompt-service.ts**
   - **Issue**: Uses `@shared/utils/logger` (winston)
   - **Solution**: Replace with console or cross-platform logger
   - **Action**: Remove winston dependency

5. **document-type-service/document-type-service.ts**
   - **Issue**: Uses `@shared/utils/logger` (winston)
   - **Solution**: Replace with console logging
   - **Action**: Remove winston dependency

6. **document-type-service/document-type-ai-service.ts**
   - **Issue**: Uses `@shared/utils/logger` (winston)
   - **Solution**: Replace with console logging
   - **Action**: Remove winston dependency

7. **database-service/database-service.ts**
   - **Issue**: Uses `@shared/utils/logger` (winston)
   - **Solution**: Replace with console logging
   - **Action**: Remove winston dependency

8. **database-metadata-service/database-metadata-service.ts**
   - **Issue**: Uses `@shared/utils/logger` (winston)
   - **Solution**: Replace with console logging
   - **Action**: Remove winston dependency

9. **batch-database-service.ts**
   - **Issue**: Uses `@shared/utils/logger` (winston)
   - **Solution**: Replace with console logging
   - **Action**: Remove winston dependency

10. **batch-processing-service.ts**
    - **Issue**: Uses `@shared/utils/logger` (winston)
    - **Solution**: Replace with console logging
    - **Action**: Remove winston dependency

11. **classify-service.ts**
    - **Issue**: Uses `@shared/utils/logger` (winston)
    - **Solution**: Replace with console logging
    - **Action**: Remove winston dependency

12. **report-service/report-service.ts**
    - **Issue**: Uses `@shared/utils/logger` (winston)
    - **Solution**: Replace with console logging
    - **Action**: Remove winston dependency

13. **formatter-service/formatter-service.ts**
    - **Issue**: Uses `path` module for file extensions
    - **Solution**: Use string manipulation instead
    - **Action**: Replace `path.extname()` with regex

14. **env-config-service/env-config-service.ts**
    - **Issue**: Uses `process.env`
    - **Solution**: Accept configuration object in browser
    - **Action**: Add browser configuration method

15. **prompt-service/prompt-output-templates.ts**
    - **Issue**: Uses `path` module
    - **Solution**: Use string manipulation for paths
    - **Action**: Replace path operations with string methods

### ❌ NODE-ONLY (Inherently requires Node.js)

These services fundamentally require Node.js and cannot be made browser-compatible:

1. **file-system-service.ts**
   - Uses: `fs`, `path`, `crypto`, `process.stdout`
   - Purpose: File system operations
   - Cannot be browser-compatible

2. **command-execution-service/command-execution-service.ts**
   - Uses: `child_process` (exec, spawn)
   - Purpose: Execute shell commands
   - Cannot be browser-compatible

3. **git-service/git-service.ts**
   - Uses: `child_process` (execSync)
   - Purpose: Git command execution
   - Cannot be browser-compatible

4. **converter-service/converter-service.ts**
   - Uses: `fs`, `path`, `child_process` (spawn for FFmpeg)
   - Purpose: Media file conversion
   - Cannot be browser-compatible

5. **file-service/file-service.ts**
   - Uses: `fs`, `path`
   - Purpose: File operations
   - Cannot be browser-compatible

6. **deployment-service.ts**
   - Uses: `fs`, `path`, `child_process`, `@shared/utils/logger`
   - Purpose: Deployment operations
   - Cannot be browser-compatible

7. **document-archiving-service.ts**
   - Uses: `fs`, `path`, `@shared/utils/logger`
   - Purpose: Archive documents on file system
   - Cannot be browser-compatible

8. **document-pipeline/document-pipeline-service.ts**
   - Uses: `fs`, `path`, `@shared/utils/logger`
   - Purpose: Process documents from file system
   - Cannot be browser-compatible

9. **script-pipeline/script-pipeline-service.ts**
   - Uses: `fs`, `path`, `@shared/utils/logger`
   - Purpose: Process scripts from file system
   - Cannot be browser-compatible

10. **pdf-processor-service/index.ts**
    - Uses: `fs`, winston logger
    - Purpose: Process PDF files
    - Cannot be browser-compatible

11. **unified-classification-service/unified-classification-service.ts**
    - Uses: `fs`, `path`, winston logger
    - Purpose: Classify files from file system
    - Cannot be browser-compatible

12. **tracking-service/command-tracking-service.ts**
    - Uses: `fs`, winston logger
    - Purpose: Track CLI commands
    - Cannot be browser-compatible

13. **document-classification-service/index.ts**
    - Uses: `fs`, `path`
    - Purpose: Classify documents from file system
    - Cannot be browser-compatible

14. **ports-management-service.ts**
    - Uses: `fs`, `path`, winston logger
    - Purpose: Manage server ports
    - Cannot be browser-compatible

15. **audio-service/audio-service.ts** (Different from above)
    - Uses: `fs`, `path`, winston logger
    - Purpose: Process audio files
    - Cannot be browser-compatible

16. **follow-up-task-service.ts**
    - Uses: `fs`, winston logger
    - Purpose: Manage follow-up tasks with file I/O
    - Cannot be browser-compatible

17. **living-docs-prioritization-service.ts**
    - Uses: `fs`, winston logger
    - Purpose: Prioritize living docs with file I/O
    - Cannot be browser-compatible

18. **server-registry-service.ts**
    - Uses: `fs`, winston logger
    - Purpose: Manage server registry
    - Cannot be browser-compatible

19. **clipboard-service/clipboard-service.ts**
    - Uses: `fs`, winston logger
    - Purpose: Manage clipboard with file storage
    - Cannot be browser-compatible

20. **worktree-management-service/worktree-management-service.ts**
    - Uses: winston logger
    - Purpose: Manage git worktrees
    - Cannot be browser-compatible

21. **work-summary-service/work-summary-service.ts**
    - Uses: winston logger
    - Purpose: Track work summaries
    - Cannot be browser-compatible

22. **google-drive/google-drive-service.ts**
    - Uses: `fs`, winston logger
    - Purpose: Download files to file system
    - Cannot be browser-compatible

23. **google-drive/google-auth-service.ts**
    - Uses: `fs`, winston logger
    - Purpose: Read service account from file system
    - Cannot be browser-compatible

24. **google-drive/google-drive-sync-service.ts**
    - Uses: winston logger
    - Purpose: Sync files to file system
    - Cannot be browser-compatible

25. **audio-transcription/audio-transcription-service.ts**
    - Uses: winston logger
    - Purpose: Transcribe audio files
    - Cannot be browser-compatible

26. **auth-service/auth-service.ts**
    - Uses: `fs`, `path`, `os`, `crypto`
    - Purpose: Authentication with CLI token storage
    - Cannot be browser-compatible (file system operations for CLI tokens)

## Action Plan

### Phase 1: Create Cross-Platform Logger (Priority 1)
1. Create a new `@shared/utils/cross-platform-logger.ts` that:
   - Works in both Node.js and browser environments
   - Falls back to console methods in browser
   - Uses winston in Node.js environments
   - Maintains same API as current logger

### Phase 2: Migrate Services with Logger Dependencies (Priority 2)
1. Replace all `@shared/utils/logger` imports with cross-platform logger
2. Test services in both environments
3. Services to migrate:
   - All services in "NEEDS-MIGRATION" category
   - Focus on most commonly used services first

### Phase 3: Fix Environment Variable Usage (Priority 3)
1. Create environment configuration pattern for browser apps
2. Update services that use `process.env` directly:
   - claude-service (already has configure method)
   - supabase-client (already has adapter pattern)
   - env-config-service

### Phase 4: Replace Path Module Usage (Priority 4)
1. Create utility functions for path operations using string manipulation
2. Update services using `path` module:
   - formatter-service
   - prompt-output-templates

### Phase 5: Document Browser-Compatible Services
1. Create documentation for which services work in browser
2. Add TypeScript types to indicate environment compatibility
3. Update CLAUDE.md with browser service guidelines

## Recommendations

1. **Immediate Action**: Create the cross-platform logger to unblock most services
2. **Service Pattern**: All new services should be designed browser-first with Node.js adapters
3. **Testing**: Add browser environment tests for migrated services
4. **Documentation**: Clearly mark which services are browser-compatible

## Summary Statistics

- **Total Services Analyzed**: 68 files
- **Browser-Compatible**: 14 services (21%)
- **Can Be Migrated**: 15 services (22%)
- **Node.js Only**: 26 services (38%)
- **Test/Type Files**: 13 files (19%)

The majority of services requiring migration only need the winston logger replaced, making this a relatively straightforward migration path.