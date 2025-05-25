# Claude Code Instructions (v1.03)

⚠️ **CRITICAL: ASK BEFORE WORKAROUNDS**
- **NEVER implement workarounds without explicit permission**
- If you encounter an issue or error, STOP and explain the problem clearly
- Present options for proceeding, including proper solutions vs. temporary workarounds
- Let the user decide how to proceed - don't try to "make things work" by circumventing issues
- When problems arise, focus on fixing root causes, not symptoms

⚠️ **SHARED SERVICES AVAILABLE**
- Check `packages/shared/services/` for existing functionality before implementing new features
- Health check tools: `./scripts/cli-pipeline/maintenance-cli.sh health-check`

⚠️ **CRITICAL: CODE REVIEW CHECKLIST**

## BEFORE WRITING ANY CODE:
- Review this CLAUDE.md file completely to understand project standards
- Check if existing shared services can solve the problem (`packages/shared/services`)
- Identify the appropriate location for new code (CLI pipeline, shared services, etc.)
- Check if similar functionality already exists that can be reused
- Look for opportunities to create or enhance singleton services
- Verify which environment variables are needed (always use .env files, never hardcode secrets)
- Ensure database operations will properly handle IDs (never null, use UUIDs)
- Use ONLY `supabase/types.ts` for database schema information (the single source of truth)

## AFTER WRITING CODE BUT BEFORE SUBMITTING:
- Run `tsc --noEmit` to check for TypeScript errors
- Verify all parameters and variables have explicit types (avoid implicit 'any')
- Ensure no hardcoded credentials or secrets exist in the code
- Check if any functionality should be moved to shared services
- Verify CLI commands are properly integrated into the pipeline structure
- Test the code with real data to ensure it works as expected
- For refactored code, thoroughly verify the functionality is unchanged
- If moving functionality to shared services, test both before and after
- Run appropriate tests for both the original behavior and any enhancements

## Code Organization Principles

0. **⚠️ CRITICAL: NEVER ADD FILES TO THE ROOT DIRECTORY**: 
   - ⚠️ **NEVER create any files in the root of the project directory**
   - ⚠️ **NEVER put scripts or tests in the root - use the dedicated `scripts/` folder structure**
   - All new files MUST be placed in the appropriate subdirectory:
     - **New scripts/CLI commands**: `scripts/cli-pipeline/{domain}/` (e.g., `scripts/cli-pipeline/google_sync/`, `scripts/cli-pipeline/document/`)
     - **New services**: `packages/shared/services/`
     - **New documentation**: `docs/{appropriate-category}/`
   - The `scripts/cli-pipeline/` folder contains domain-specific pipelines - this is where ALL new script files belong
   - If unsure where a file should go, ask for clarification rather than defaulting to the root
   
1. **Shared Services First**: Always prioritize using and enhancing the shared services in `packages/shared`. Before implementing any functionality, check if an existing service can be used or extended.
   - Check for existing services in `packages/shared/services` that could solve the problem
   - Consider creating new shared services when implementing functionality that could be reused
   - Avoid duplicating functionality that already exists in shared services
   - When enhancing CLI scripts, first check if the functionality can be implemented by using shared services

2. **UI Pages as Service Sources**: When examining UI pages in `apps/dhg-improve-experts`, treat them as potential sources for shared services. These comprehensive pages often contain functionality that can be abstracted into reusable services. Future refactoring will create "New" + page name versions that leverage these shared services while preserving the React UI components.

3. **CLI Pipeline Architecture**: 
   - ⚠️ **ALL new scripts MUST go in `scripts/cli-pipeline/{domain}/`**
   - Available domains: `google_sync/`, `document/`, `media-processing/`, `presentations/`, `prompt_service/`
   - Keep flat file structure within pipeline folders - no nested subfolders
   - Each pipeline uses commander.js for CLI integration
   - Each pipeline has its own package.json with commander.js v11.0.0
   - Always implement command tracking for new commands

4. **Essential Patterns**:

   **Singleton Services**: Always use existing singletons:
   - ⚠️ **Supabase**: `SupabaseClientService.getInstance().getClient()`
   - ⚠️ **Claude AI**: `import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';`
   - ⚠️ **NEVER create direct clients** - always use the singleton services

   **Database Schema**: 
   - ⚠️ **ONLY use `supabase/types.ts`** for database schema information
   - This is the single source of truth for all table structures and relationships

   **Security**:
   - ⚠️ **NEVER hardcode credentials** - always use environment variables from `.env.development`
   - Check for hardcoded secrets before submitting any code


## CLI Pipeline Integration Requirements

1. **Always Integrate New Commands**:
   - ⚠️ **EVERY new script MUST be integrated into the appropriate CLI pipeline**
   - ⚠️ **Always integrate into the shell script CLI** (e.g., `google-sync-cli.sh`) - this is what I actually use
   - ⚠️ **NEVER provide standalone `ts-node` scripts** - make commands accessible via the CLI pipeline
   - Identify the correct domain: `document/`, `google_sync/`, `media-processing/`, `presentations/`, etc.
   - Add proper help text and ensure commands appear in `--help` output

2. **Command Tracking**:
   - ⚠️ **ALWAYS implement command tracking** for new CLI commands
   - Add to shell script wrapper using `track_command` function
   - Copy structure from existing pipelines (e.g., google-sync-cli.sh)

3. **Implementation Standards**:
   - Implement full functionality, not placeholder code
   - Include proper error handling and logging
   - Test commands with real data before submitting

## Development Workflow

1. **Quality Assurance**:
   - Run `tsc --noEmit` to check TypeScript errors before submitting
   - Test commands with real data and proper arguments
   - Verify no hardcoded credentials exist in code
   - Ensure CLI commands are properly integrated into pipeline structure

2. **Safe Refactoring**:
   - ⚠️ **Never break existing functionality**
   - Make small, incremental changes and test after each step
   - When moving code to shared services: make it work first, then extract, then replace
   - Ask for permission before major architectural changes

3. **Document Solutions After Struggles**:
   - ⚠️ **After overcoming significant challenges, update this CLAUDE.md file**
   - Add concise troubleshooting guidance for future reference
   - Include specific error messages, root causes, and solutions
   - Follow the existing format with ❌ Problem and ✅ Solution examples
   - Focus on patterns that could help with similar issues in the future

## Final Checklist

⚠️ **BEFORE SUBMITTING CODE:**
1. Run `tsc --noEmit` to check TypeScript errors
2. Verify no hardcoded credentials in source files
3. Test CLI command functionality with real data
4. Ensure scripts are in proper `scripts/cli-pipeline/{domain}/` location
5. Check that commands are integrated into shell script CLI

## Project Structure
- **Monorepo with multiple apps** - When debugging issues, check working apps for patterns
- `apps/` - Multiple applications (dhg-hub, dhg-audio, dhg-improve-experts, etc.)
- `packages/shared/services/` - Reusable services (preferred for new functionality)
- `scripts/cli-pipeline/{domain}/` - CLI commands (ONLY place for new scripts)
- `supabase/types.ts` - Database schema (single source of truth)

## Common Issues to Avoid

1. **Creating files in wrong locations**: 
   - ❌ NEVER put scripts in the root directory
   - ✅ ALWAYS use `scripts/cli-pipeline/{domain}/`

2. **Direct database clients**: 
   - ❌ NEVER create your own Supabase clients
   - ✅ ALWAYS use `SupabaseClientService.getInstance().getClient()`

3. **Hardcoded credentials**: 
   - ❌ NEVER hardcode API keys or secrets
   - ✅ ALWAYS use environment variables from `.env.development`

4. **Implementing workarounds**: 
   - ❌ NEVER implement workarounds without permission
   - ✅ ALWAYS ask before taking shortcuts or temporary solutions

5. **Standalone scripts**: 
   - ❌ NEVER create standalone `ts-node` scripts
   - ✅ ALWAYS integrate into shell script CLI pipelines

## Debugging in a Monorepo Context

1. **When an app has configuration issues**:
   - ✅ **Compare with working apps** - Check how dhg-hub, dhg-improve-experts configure similar features
   - ✅ **Look for patterns** - Router setup, imports, environment variables
   - Example: If Vite config fails in dhg-audio, check dhg-hub's working vite.config.ts

2. **React Router common patterns**:
   - Most apps use `BrowserRouter` in main.tsx, not App.tsx
   - Check working apps for the correct pattern before making changes

3. **Import resolution issues**:
   - If `@shared/components` imports fail, it may be a deeper config issue
   - Don't assume simple fixes - check if other apps successfully import from shared
   - Consider using temporary placeholders while investigating root cause
   
   **Shared Component Import Pattern Fix (dhg-audio example)**:
   - ❌ **Problem**: `import { ProfileForm } from '@shared/components'` - General export may not be configured
   - ✅ **Solution**: Use specific path imports like working apps do
   - Example fix: `import { ProfileForm } from '@shared/components/profile/ProfileForm'`
   - **Debugging steps**:
     1. Check how working apps (dhg-admin-config, dhg-improve-experts) import the same component
     2. Look for the component's actual file location in `packages/shared/components/`
     3. Use the specific path import instead of relying on index.ts re-exports
     4. If multiple apps use different patterns, follow the most recent/working pattern

4. **Cleanup and refactoring**:
   - ⚠️ **Test incrementally** - Don't remove multiple files at once
   - ⚠️ **Understand file purpose** - Some files (like auth-service.ts) may be for future use
   - ⚠️ **Keep essential debug logs** - Remove verbose logs but keep error handling
   - After cleanup, always test the app still works before committing

## TypeScript Best Practices

- Explicitly type ALL function parameters, variables, and return types
- Avoid `any` type; use `unknown` with type guards instead
- Always run `tsc --noEmit` before submitting code
- Handle undefined/null values properly
- Use types from `supabase/types.ts` for database operations

## Supabase Query Patterns

**Connection Setup**:
```typescript
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
const supabase = SupabaseClientService.getInstance().getClient();
```

**Basic Query with Error Handling**:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('column1, column2')
  .limit(10);

if (error) {
  console.error('Database error:', error);
  throw new Error(`Failed to retrieve data: ${error.message}`);
}
```

**Insert with Auto-Generated ID**:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .insert({ column1: value1, column2: value2 })
  .select(); // Always include select() to get the inserted record
```

**Key Points**:
- Always use `SupabaseClientService` singleton - never create direct clients
- Always handle errors properly with `if (error)` checks
- Include `.select()` after inserts to get the created record
- Consult `supabase/types.ts` for schema information (single source of truth)
- Use proper column names: `experts.expert_name`, `document_types.name`

## Claude Service Usage

**Import and Use the Singleton**:
```typescript
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

// Use directly - never create new instances
const response = await claudeService.sendPrompt('Your prompt');
const jsonResponse = await claudeService.getJsonResponse('Your prompt');
```

## Database Table Relationships

### sources_google and expert_documents Recursive Search

The `sources_google` table uses a hierarchical structure for Google Drive folders and files:

**Key Principles:**
- **Use Google Drive IDs, not Supabase UUIDs** for navigation
- **path_depth field**: High-level folders have `path_depth = 0`, with nested folders incrementing this value
- **Hierarchy navigation**: Use `drive_id` and `parent_folder_id` fields to traverse the folder structure

**Example Recursive Query Pattern:**
```sql
-- Find all documents in a folder and its subfolders
WITH RECURSIVE folder_tree AS (
  -- Base case: start with target folder
  SELECT drive_id, parent_folder_id, name, path_depth, 0 as level
  FROM sources_google 
  WHERE drive_id = 'target_folder_id'
  
  UNION ALL
  
  -- Recursive case: find children
  SELECT s.drive_id, s.parent_folder_id, s.name, s.path_depth, ft.level + 1
  FROM sources_google s
  INNER JOIN folder_tree ft ON s.parent_folder_id = ft.drive_id
)
SELECT * FROM folder_tree;
```

**Important:** When implementing recursive folder traversal or searching operations, always use the `drive_id` and `parent_folder_id` fields to navigate the hierarchy, not the Supabase UUIDs.

## Cross-Environment Shared Services

### Environment-Aware Service Design

When creating shared services that work across different environments (browser vs server/CLI), follow these patterns:

**❌ Problem**: Singleton services that auto-initialize clients in constructors
```typescript
export class MyService {
  private static instance: MyService;
  private supabase = SupabaseClientService.getInstance().getClient(); // Fails in browser!
  
  private constructor() {}
  static getInstance() { return this.instance ||= new MyService(); }
}
```

**✅ Solution**: Dependency injection pattern with environment-specific client configuration
```typescript
export class MyService {
  private supabase: SupabaseClient<any>;
  
  constructor(supabaseClient: SupabaseClient<any>) {
    this.supabase = supabaseClient;
  }
}

// Browser usage: new MyService(browserConfiguredSupabaseClient)
// CLI usage: new MyService(SupabaseClientService.getInstance().getClient())
```

**Key Lessons:**
- Browser apps use `VITE_` prefixed environment variables, CLI/server use standard names
- Shared services should accept configured clients rather than creating them
- Use adapter pattern in apps to maintain backward compatibility
- Each environment handles its own client configuration needs

## Google Drive Service Account Integration

The project requires a valid Google Drive service account for accessing files in Google Drive.

### Setting Up Service Account Authentication

When working with scripts that access Google Drive, you need a valid service account configuration:

1. **Service Account Setup**:
   - The project expects a `.service-account.json` file in the project root directory
   - This is the standard approach used by all commands that access Google Drive
   - The `.service-account.json` file should contain your Google Cloud service account credentials

2. **Environment Variables**:
   - The service account credentials are automatically loaded from `.service-account.json`
   - Some commands may also use these environment variables:
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email address
     - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Service account private key

3. **Commands That Require Google Drive Access**:
   - `sync` - Syncs files from Google Drive to the database
   - `find-folder` - Searches for folders/files in Google Drive
   - `get-current-drive-id` - Gets the current drive_id for a file
   - `check-duplicates --check-current` - Verifies if drive_ids still exist
   - Any command that needs to read or verify files in Google Drive

4. **Troubleshooting**:
   - If you see "Could not initialize Google Drive API", check that `.service-account.json` exists
   - Ensure the service account has proper permissions to access the Google Drive folders
   - The service account needs at least read-only access to the drives/folders being accessed

## Key Points Summary

This document provides the essential guidelines for working with Claude Code v1.03. The most important principles are:

1. **Ask before implementing workarounds** - explain problems and get permission
2. **Use proper file locations** - scripts go in `scripts/cli-pipeline/{domain}/`
3. **Use singleton services** - never create direct clients for Supabase, Claude, etc.
4. **Design for cross-environment compatibility** - use dependency injection for shared services
5. **Integrate CLI commands** - always add to shell script wrappers
6. **Follow TypeScript best practices** - run `tsc --noEmit` before submitting
7. **Leverage the monorepo** - when debugging, compare with working apps for patterns
8. **Test incrementally** - especially during cleanup or refactoring
9. **Configure Google Drive access** - ensure `.service-account.json` exists for Drive commands

When in doubt, ask for clarification rather than making assumptions or implementing temporary solutions.

