# Claude Code Instructions (v1.04)

## ⚠️ CRITICAL: Database Tables Have Been Renamed

Many database tables have undergone a major renaming effort. When troubleshooting issues with missing tables or outdated code references, consult the `sys_table_migrations` table or use the reference below:

| Old Table Name | New Table Name | Purpose |
|----------------|----------------|---------|
| allowed_emails | auth_allowed_emails | Authentication email allowlist |
| citation_expert_aliases | expert_citation_aliases | Expert citation aliases (intermediate) |
| cli_auth_tokens | auth_cli_tokens | CLI authentication tokens |
| cli_command_tracking | command_tracking | CLI command usage tracking |
| documentation_files | doc_files | Documentation file storage |
| document_concepts | learn_document_concepts | Document concept mapping |
| emails | email_messages | Email message storage |
| expert_citation_aliases | expert_profile_aliases | Expert profile aliases |
| expert_documents | google_expert_documents | Expert documents from Google Drive |
| experts | expert_profiles | Expert information storage |
| learning_topics | learn_topics | Learning topic definitions |
| media_bookmarks | learn_media_bookmarks | Media bookmarks |
| media_playback_events | learn_media_playback_events | Media playback tracking |
| media_sessions | learn_media_sessions | Media session tracking |
| media_topic_segments | learn_media_topic_segments | Media topic segments |
| mime_types | sys_mime_types | System MIME type registry |
| presentation_assets | media_presentation_assets | Presentation media assets |
| presentations | media_presentations | Media presentations |
| processing_batches | batch_processing | Batch processing operations |
| prompt_categories | ai_prompt_categories | Prompt categorization |
| prompt_output_templates | ai_prompt_output_templates | Prompt output templates |
| prompt_relationships | ai_prompt_relationships | Prompt relationships |
| prompts | ai_prompts | AI prompt storage |
| prompt_template_associations | ai_prompt_template_associations | Template associations |
| scripts | scripts_registry | Script management registry |
| sources_google | google_sources | Google Drive file metadata |
| sources_google_experts | google_sources_experts | Google sources expert mapping |
| subject_classifications | learn_subject_classifications | Subject classifications |
| sync_history | google_sync_history | Google Drive sync tracking |
| sync_statistics | google_sync_statistics | Sync operation statistics |
| table_classifications | learn_document_classifications | Document classification tracking |
| user_content_scores | learn_user_scores | User content scores |
| user_filter_profile_drives | filter_user_profile_drives | User drive filters |
| user_filter_profiles | filter_user_profiles | User filter profiles |
| user_learning_analytics | learn_user_analytics | Learning analytics data |
| user_profiles_v2 | auth_user_profiles | User profile information |
| user_subject_interests | learn_user_interests | User learning interests |

**Note**: This is a temporary reference while code is being updated. Always check `supabase/types.ts` for the current schema.

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
   - ⚠️ **NEVER place scripts directly in `/scripts/` root folder**
   - Available domains: `google_sync/`, `document/`, `document_types/`, `media-processing/`, `presentations/`, `prompt_service/`
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

   **Database Table Naming Convention**:
   When creating new tables, follow the established prefix pattern:
   - `auth_` - Authentication & user management (e.g., auth_sessions, auth_tokens)
   - `ai_` - AI & prompt management (e.g., ai_models, ai_conversations)
   - `google_` - Google Drive integration (e.g., google_folders, google_permissions)
   - `learn_` - Learning platform features (e.g., learn_courses, learn_progress)
   - `media_` - Media & presentations (e.g., media_thumbnails, media_transcripts)
   - `doc_` - Document management (e.g., doc_versions, doc_comments, doc_continuous_monitoring)
   - `expert_` - Expert system (e.g., expert_ratings, expert_specialties)
   - `email_` - Email system (e.g., email_templates, email_logs)
   - `command_` - Command & analytics (e.g., command_aliases, command_logs)
   - `filter_` - User filtering & preferences (e.g., filter_rules, filter_history)
   - `batch_` - Batch operations (e.g., batch_jobs, batch_results)
   - `scripts_` - Script management (e.g., scripts_versions, scripts_logs)
   - `sys_` - System & infrastructure (e.g., sys_logs, sys_settings)
   - `dev_` - Development & task management (e.g., dev_tasks, dev_task_copies, dev_merge_queue, dev_merge_checklist)
   
   **Examples**: 
   - New authentication feature → `auth_password_resets`
   - New AI feature → `ai_embeddings`
   - New learning feature → `learn_quiz_results`
   
   Always check existing prefixes before creating a new one. All migrations must be tracked in `sys_table_migrations`.
   
   **Table Creation Dates**: When creating new tables, always add an entry to `sys_table_definitions` with the creation date:
   ```sql
   -- After creating your table, add its metadata
   INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
   VALUES ('public', 'your_new_table', 'Brief description', 'Purpose/use case', CURRENT_DATE);
   ```

   **Security**:
   - ⚠️ **NEVER hardcode credentials** - always use environment variables from `.env.development`
   - Check for hardcoded secrets before submitting any code

5. **Archiving Strategy**: 
   - Archive temporary or unused code in `.archived_scripts` folders within the appropriate domain directory
   - Archive outdated documentation in `.archive_docs` folders within doc markdown directories
   - Append the date to archived filenames (e.g., `scripts/cli-pipeline/google_sync/.archived_scripts/some-script.20250330.ts`)
   - This keeps the active codebase clean while preserving code history for potential future reference
   - Before archiving, ensure the code is not referenced elsewhere in the project


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
   - ⚠️ **After adding new commands, ALWAYS run**:
     ```bash
     ./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh populate-command-registry
     ./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh sync-command-status
     ```
     This ensures new commands are registered and tracking is enabled

3. **Implementation Standards**:
   - Implement full functionality, not placeholder code
   - Include proper error handling and logging
   - Test commands with real data before submitting

## CLI Command Registry

**Before creating new CLI commands**, check the existing command registry:
```sql
-- Check existing commands in a specific pipeline
SELECT cp.name as pipeline_name, cd.command_name, cd.description 
FROM command_pipelines cp
JOIN command_definitions cd ON cd.pipeline_id = cp.id
WHERE cp.name = 'google_sync' 
ORDER BY cd.command_name;

-- Check all active pipelines and their commands
SELECT cp.name as pipeline_name, cp.display_name, 
       COUNT(cd.id) as command_count, cp.status
FROM command_pipelines cp
LEFT JOIN command_definitions cd ON cd.pipeline_id = cp.id
WHERE cp.status = 'active'
GROUP BY cp.id, cp.name, cp.display_name, cp.status
ORDER BY cp.name;

-- Check which tables a pipeline uses
SELECT cpt.table_name, cpt.operation_type, cpt.description
FROM command_pipeline_tables cpt
JOIN command_pipelines cp ON cp.id = cpt.pipeline_id
WHERE cp.name = 'google_sync'
ORDER BY cpt.table_name;
```

**Key Registry Tables**:
- `command_pipelines` - CLI pipeline scripts (e.g., google-sync-cli.sh)
- `command_definitions` - Individual commands within each pipeline
- `command_pipeline_tables` - Database tables used by each pipeline
- `scripts_registry` - Individual script files (separate from CLI commands)

**Note**: CLI commands (in pipelines) and individual scripts are tracked separately. Focus on the command_* tables for CLI pipeline work.

## Development Workflow

1. **Quality Assurance**:
   - Run `tsc --noEmit` to check TypeScript errors before submitting
   - Test commands with real data and proper arguments
   - Verify no hardcoded credentials exist in code
   - Ensure CLI commands are properly integrated into pipeline structure

2. **Database Migration Workflow**:
   - ✅ **Types.ts is automatically regenerated after successful migrations**
   - The run-staged command now automatically runs: `pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts`
   - This ensures TypeScript interfaces always match the updated database schema
   - If type generation fails, the command provides manual instructions
   - Consider committing the updated types.ts file along with your migration

3. **Safe Refactoring**:
   - ⚠️ **Never break existing functionality**
   - Make small, incremental changes and test after each step
   - When moving code to shared services: make it work first, then extract, then replace
   - Ask for permission before major architectural changes

4. **Document Solutions After Struggles**:
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

## Database Migration Workflow

When creating database migrations, use the CLI pipeline commands:
1. **Validate**: `./scripts/cli-pipeline/database/database-cli.sh migration validate [migration.sql]`
2. **Test**: `./scripts/cli-pipeline/database/database-cli.sh migration test [migration.sql]`
3. **Apply**: `./scripts/cli-pipeline/database/database-cli.sh migration run-staged [migration.sql]`

This ensures migrations are properly tested before applying to the database.

## Common Issues to Avoid

1. **Creating files in wrong locations**: 
   - ❌ NEVER put scripts in the root directory
   - ❌ NEVER put scripts directly in `/scripts/` folder
   - ✅ ALWAYS use `scripts/cli-pipeline/{domain}/`
   - ✅ Example: `/scripts/cli-pipeline/prompt_service/check-prompt.ts`

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

6. **SQL Function Column Ambiguity**:
   - ❌ **Problem**: "column reference is ambiguous" errors in PostgreSQL functions
   - ✅ **Solution**: Always qualify column names with table alias in ORDER BY/WHERE clauses
   - Example fix:
     ```sql
     -- ❌ WRONG: Ambiguous column reference
     SELECT * FROM table_info ORDER BY table_name;
     
     -- ✅ CORRECT: Qualified column reference
     SELECT * FROM table_info ORDER BY table_info.table_name;
     ```
   - This commonly occurs when RETURNS TABLE has columns with same names as query columns

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

**Accessing auth.users Table**:
```typescript
// ❌ WRONG: Direct table access doesn't work from client code
const { data, error } = await supabase.from('auth.users').select('*');

// ✅ CORRECT: Use the auth admin API with service role key
const { data: { users }, error } = await supabase.auth.admin.listUsers();

// ✅ CORRECT: In SQL migrations, you CAN directly reference auth.users
// UPDATE auth_allowed_emails SET auth_user_id = (SELECT id FROM auth.users WHERE email = ...)
```

**Note**: The `auth.users` table is in the auth schema and requires special access. Use the auth admin API methods when working with user data from TypeScript/JavaScript code.

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

### Vite Cache Issues - Not Seeing Latest Code Changes

**❌ Problem**: After making code changes, running `pnpm dev` doesn't show the latest changes - old code still runs
- Vite aggressively caches modules in `node_modules/.vite`
- Browser caches can also prevent seeing updates
- Hot Module Replacement (HMR) sometimes fails silently
- TypeScript build artifacts can get stale

**✅ Solution**: Use the cache clearing scripts to ensure fresh builds
1. **For all apps**: `./scripts/clear-all-caches.sh`
2. **For specific app**: `./scripts/clear-app-cache.sh dhg-audio`
3. **Best practice**: `./scripts/dev-fresh.sh dhg-audio` (clears cache AND starts dev server)

**Additional steps**:
- Always hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
- Or in DevTools: Right-click refresh → "Empty Cache and Hard Reload"
- If issues persist, restart your terminal session

**Root causes**:
- Vite stores compiled modules in `.vite` cache directory
- File watchers sometimes miss changes in monorepo setups
- Symlinked packages can confuse the module resolution
- Browser ServiceWorkers can serve stale content

### Universal Supabase Adapter

**✅ Solution**: The project includes a universal Supabase adapter that handles both browser and server environments.

**Location**: `packages/shared/adapters/supabase-adapter.ts`

**Usage Pattern for Browser Apps (Vite)**:
```typescript
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Browser apps MUST pass their environment variables to the adapter
const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});
```

**Usage Pattern for CLI/Server**:
```typescript
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// CLI/Server can use without parameters (reads from process.env)
const supabase = createSupabaseAdapter();
```

**Important**: Due to CommonJS/ESM compatibility issues, browser apps must explicitly pass `import.meta.env` to the adapter. The shared package cannot access `import.meta.env` directly.

**Key Benefits**:
- Works in both browser and server environments
- Handles `VITE_` prefixed variables in browser, standard variables in CLI/server
- Avoids CommonJS/ESM compatibility issues
- Maintains type safety and error handling

**Common Error and Fix**:
```
❌ Error: Missing required Vite environment variable: VITE_SUPABASE_ANON_KEY
```
This happens when browser apps don't pass environment variables. Fix:
```typescript
// ❌ Wrong - doesn't work in browser
const supabase = createSupabaseAdapter();

// ✅ Correct - pass environment variables
const supabase = createSupabaseAdapter({ env: import.meta.env as any });
```

**When to Use**:
- All browser apps (dhg-hub, dhg-audio, dhg-admin-code, etc.)
- CLI scripts and server-side code
- Any situation where you need Supabase access across environments

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

### Displaying Google Drive Files in Browser (iframe previews)

When displaying Google Drive files in browser applications, use the `/preview` endpoint to avoid Content Security Policy restrictions:

**❌ Problem**: Embedding Google Drive directly causes CSP errors
```typescript
// This will fail with "frame-ancestors" CSP errors
<iframe src="https://drive.google.com/file/..." />
```

**✅ Solution**: Use the preview endpoint with extracted Drive ID
```typescript
// Extract Drive ID from web_view_link
const extractDriveId = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
};

// Use the preview endpoint
<iframe 
  src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
  className="w-full h-full"
  allow="autoplay"
  title="File preview"
/>
```

**Key Points**:
- Always use `/preview` endpoint for embedding Google Drive files
- Extract the Drive ID from the web_view_link URL
- Different file types need different iframe styling:
  - Documents/PDFs: Full height (`h-full`)
  - Videos: Aspect ratio preserved (`aspect-video`)
  - Audio: Small player height (`h-20`)
  - Images: Centered with max dimensions
- The preview endpoint works for all file types without CSP restrictions

## Port Management for Servers and Apps

### Port Allocation Strategy

To avoid port collisions in the monorepo, follow these standardized port ranges:

**Port Ranges**:
- **3000-3099**: Backend/API servers
- **5000-5999**: Vite development servers  
- **4000-4999**: Vite preview servers

**Reserved Ports**:
| Port | Service | Location |
|------|---------|----------|
| 3001 | Markdown Server | `scripts/cli-pipeline/viewers/simple-md-server.js` |
| 3002 | Script Server | `scripts/cli-pipeline/viewers/simple-script-server.js` |
| 3003 | Docs Archive Server | `scripts/cli-pipeline/viewers/docs-archive-server.js` |
| 3004 | (Available) | - |
| 3005 | Git Server | `apps/dhg-admin-code/git-server.cjs` |
| 3006 | Audio Proxy Server | `apps/dhg-audio/server.js` |
| 3007 | Experts Markdown Server | `apps/dhg-improve-experts/md-server.mjs` |
| 3008 | Continuous Docs Server | `apps/dhg-admin-code/continuous-docs-server.cjs` |
| 3009 | Git API Server | `apps/dhg-admin-code/git-api-server.cjs` |
| 3010 | Worktree Switcher | `scripts/cli-pipeline/viewers/worktree-switcher-server.js` |

**Vite App Ports**:
| Port | App | Status |
|------|-----|--------|
| 5173 | dhg-a, dhg-hub-lovable | Shared (don't run together) |
| 5174 | dhg-b, dhg-hub, dhg-admin-google | Shared (don't run together) |
| 5175 | dhg-admin-suite | Dedicated |
| 5177 | dhg-admin-code | Dedicated |
| 5194 | dhg-audio | Dedicated |
| 8080 | dhg-improve-experts | Dedicated |

### Starting All Servers

Use the centralized server management script:
```bash
# Start all backend servers with proper port assignments
pnpm servers

# Or manually with:
node scripts/start-all-servers.js
```

This script automatically:
- Assigns unique ports using environment variables
- Prevents port collisions
- Shows status of all running servers
- Handles graceful shutdown

### Adding New Servers

When creating a new server:

1. **Check available ports** in the 3000-3099 range
2. **Update `start-all-servers.js`** to include your server
3. **Use environment variables** for port configuration:
   ```javascript
   const PORT = process.env.YOUR_SERVER_PORT || 3009;
   ```
4. **Update this documentation** with the new port assignment

### Troubleshooting Port Issues

If you encounter "address already in use" errors:

1. **Check running processes**:
   ```bash
   # Find what's using a port
   lsof -i :3001
   
   # Kill process using a port
   kill -9 $(lsof -t -i:3001)
   ```

2. **Use the start-all-servers script** which handles port assignments automatically

3. **For Vite apps**, ensure you're not running multiple apps on the same port

## Handling pnpm-lock.yaml in Worktree Merges

When working with multiple worktrees and merging branches, `pnpm-lock.yaml` conflicts are common. Follow these guidelines:

**❌ Problem**: Manual merge conflict resolution in pnpm-lock.yaml leads to inconsistent dependencies
**✅ Solution**: Always accept incoming version and regenerate the lock file

### Standard Merge Process with Lock File Handling:
```bash
# If pnpm-lock.yaml conflicts arise during merge:
git checkout --theirs pnpm-lock.yaml  # Accept incoming version
git add pnpm-lock.yaml
pnpm install                           # Regenerate with all dependencies
```

### Key Principles:
- **Never manually edit** pnpm-lock.yaml during merge conflicts
- **Always regenerate** after accepting changes to ensure consistency
- **Keep backups** before major merge operations: `cp pnpm-lock.yaml pnpm-lock.yaml.backup`
- If `pnpm install` fails, delete both `node_modules/` and `pnpm-lock.yaml`, then reinstall

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
10. **Handle pnpm-lock.yaml properly** - accept incoming and regenerate during merges

When in doubt, ask for clarification rather than making assumptions or implementing temporary solutions.

