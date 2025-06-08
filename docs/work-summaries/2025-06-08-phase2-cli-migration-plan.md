# Phase 2: packages/cli Migration Plan
Date: June 8, 2025

## Summary of packages/cli Usage

### Files Currently Importing from packages/cli

1. **display-doc-paths-enhanced.ts** - Imports:
   - `SupabaseClient` (type)
   - `Logger`
   - `ErrorHandler`
   - `SupabaseClientService`
   - `config`

2. **display-doc-paths-simple.ts** - Imports:
   - `Logger`
   - `ErrorHandler`
   - `SupabaseClientService`
   - `config`

3. **sync-markdown-files.ts** - Imports:
   - `FileService`
   - `Logger`, `LogLevel`
   - `ErrorHandler`

4. **check-prompt.ts** - Imports:
   - `PromptQueryService`

5. **generate-summary.ts** - Imports:
   - `PromptQueryService`

6. **process-mp4-files-action.ts** - Imports:
   - `PromptQueryService`

7. **process-mp4-files.ts** - Imports:
   - `PromptQueryService`

8. **test-process-document.ts** - Imports:
   - `PromptQueryService`

9. **classify-script-with-prompt.ts** - Imports:
   - `FileService`

10. **migrate-size-field.ts** - Imports:
    - `getSupabaseClient`
    - `Logger`

## Analysis of Required Services

### 1. **SupabaseClientService** ✅ Already Exists
- **Current Location**: `packages/cli/src/services/supabase-client.ts`
- **Shared Equivalent**: `packages/shared/services/supabase-client.ts`
- **Status**: Migration ready - both have singleton pattern, same interface

### 2. **Logger** ✅ Already Exists
- **Current Location**: `packages/cli/src/utils/logger.ts` (re-exports from shared)
- **Shared Equivalent**: `packages/shared/utils/logger.ts`
- **Status**: Already using shared version

### 3. **ErrorHandler** ❌ Needs Migration
- **Current Location**: `packages/cli/src/utils/error-handler.ts`
- **Shared Equivalent**: None - needs to be created
- **Status**: Needs to be moved to shared utils

### 4. **config** ✅ Already Exists
- **Current Location**: `packages/cli/src/utils/config.ts`
- **Shared Equivalent**: `packages/shared/utils/config.ts`
- **Status**: Migration ready

### 5. **FileService** ✅ Already Exists
- **Current Location**: `packages/cli/src/services/file-service.ts`
- **Shared Equivalent**: `packages/shared/services/file-service/file-service.ts`
- **Status**: Migration ready - check for feature parity

### 6. **PromptQueryService** ✅ Can Use Shared PromptService
- **Current Location**: `packages/cli/src/services/prompt-query-service.ts`
- **Shared Equivalent**: `packages/shared/services/prompt-service/prompt-service.ts`
- **Status**: Shared service has `executeQuery` method with similar functionality
- **Key Differences**:
  - Table name: `prompts` (CLI) vs `ai_prompts` (shared)
  - Method names slightly different but functionality exists
  - Shared service has more features (file integration, output templates)

## Migration Steps

### Step 1: Create ErrorHandler in Shared Utils
1. Copy `packages/cli/src/utils/error-handler.ts` to `packages/shared/utils/error-handler.ts`
2. Update imports to use shared logger
3. Add export to `packages/shared/utils/index.ts`

### Step 2: Create PromptQueryService Adapter
Since the shared PromptService uses `ai_prompts` table and the CLI scripts expect `prompts` table:
1. Create a small adapter class that uses the shared PromptService
2. Map method names to match existing usage
3. Handle table name differences if needed
4. This ensures backward compatibility while using shared services

### Step 3: Update Import Statements
For each file, update imports:

```typescript
// OLD
import { Logger } from '../../packages/cli/src/utils/logger';
import { SupabaseClientService } from '../../packages/cli/src/services/supabase-client';

// NEW
import { Logger } from '@shared/utils';
import { SupabaseClientService } from '@shared/services/supabase-client';
```

### Step 4: Test Each Migration
1. Run TypeScript compilation: `tsc --noEmit`
2. Test each command after updating imports
3. Verify no functionality is broken

### Step 5: Remove packages/cli
Once all imports are updated and tested:
1. Archive packages/cli to `.archived_packages/cli.20250608`
2. Remove packages/cli from the repository
3. Update any documentation references

## Risk Assessment

### Low Risk Migrations
- Logger (already using shared)
- Config (straightforward migration)
- SupabaseClientService (same interface)

### Medium Risk Migrations
- FileService (need to verify feature parity)
- ErrorHandler (new shared utility)

### High Risk Migrations
- PromptQueryService (different from shared prompt service, used by multiple presentation commands)

## Order of Migration

1. **ErrorHandler** - Create in shared first
2. **Config & Logger** - Simple import updates
3. **SupabaseClientService** - Update imports and test
4. **FileService** - Verify feature parity, then migrate
5. **PromptQueryService** - Most complex, do last after analysis

## Critical Notes

### ⚠️ Table Name Differences
- **CLI PromptQueryService** uses `prompts` table
- **Shared PromptService** uses `ai_prompts` table
- Need to verify which table actually exists in the database before migration

### ⚠️ Hardcoded Credentials in packages/cli
- The `packages/cli/src/services/supabase-client.ts` contains hardcoded Supabase credentials
- These should be removed as part of the migration - shared service handles env loading properly

### ✅ Good News
- Most services already exist in shared with similar or better functionality
- Logger is already using shared version
- File service and Supabase client have compatible interfaces
- PromptService in shared has the query execution functionality needed

## Recommended Testing Before Migration

1. **Check database tables**: Verify if `prompts` or `ai_prompts` table exists
2. **Test each command** after updating imports to ensure functionality is preserved
3. **Run TypeScript compilation** after each step: `tsc --noEmit`
4. **Create backup** of packages/cli before starting migration