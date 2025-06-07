# Claude Code Instructions (v1.06)

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

## ⚠️ Database Views Have Been Renamed

All database views now follow a consistent naming convention:
1. **Must end with `_view` suffix**
2. **Must use the prefix of their primary table**

| Old View Name | New View Name | Primary Table Prefix |
|---------------|---------------|---------------------|
| command_refactor_status_summary | command_refactor_status_summary_view | `command_` |
| commands_needing_attention | command_refactor_needing_attention_view | `command_` |
| dev_tasks_with_git | dev_tasks_with_git_view | `dev_` |
| doc_continuous_status | doc_continuous_status_view | `doc_` |
| learn_user_progress | learn_user_progress_view | `learn_` |
| recent_ai_work_summaries | ai_work_summaries_recent_view | `ai_` |

**Note**: Views must use their primary table's prefix so they sort together in database tools.

⚠️ **CRITICAL: ASK BEFORE WORKAROUNDS**
- **NEVER implement workarounds without explicit permission**
- If you encounter an issue or error, STOP and explain the problem clearly
- Present options for proceeding, including proper solutions vs. temporary workarounds
- Let the user decide how to proceed - don't try to "make things work" by circumventing issues
- When problems arise, focus on fixing root causes, not symptoms

⚠️ **CRITICAL: NO PULL REQUESTS WITH WORKTREES**
- **NEVER create pull requests when working with worktrees**
- **ALWAYS use direct push**: `git push origin branch-name:development`
- PRs have caused deployment pipeline failures - avoid them completely
- See "Worktree Merging" section below for proper merge workflow

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

## Current Project State & Ongoing Refactoring

⚠️ **The codebase is undergoing significant refactoring**. Here's what you need to know:

### Database Table Renaming
- **Major renaming effort completed** - Most tables now follow consistent prefix patterns
- **Check renamed tables** - See the table at the top of this document
- **Always verify table names** - Use `supabase/types.ts` as the source of truth
- **Some code may still use old names** - Update as you encounter them

### CLI Pipeline Consolidation
- **14+ active pipelines** exist but may be consolidated
- **New pipelines added**: `service_dependencies/`, `dev_tasks/`, `database/`
- **Some pipelines may merge** - Check `command_pipelines` table for current status
- **Command tracking is mandatory** - All new commands must be registered

### Shared Services Migration
- **Ongoing effort** to extract common functionality from apps to shared services
- **UI pages in dhg-improve-experts** are being mined for reusable services
- **Singleton patterns enforced** - Direct client creation is being eliminated
- **Cross-environment compatibility** required for all new services

### Type Generation & Schema Updates
- **Types are auto-generated** after migrations: `pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts`
- **Schema changes frequent** - Always pull latest types after database updates
- **RLS policies being standardized** - Most tables now have consistent policies

### What This Means For You
1. **Expect changes** - Table names, file locations, and APIs may shift
2. **Check before assuming** - Verify table names, pipeline locations, service patterns
3. **Update old code** - When you find outdated references, fix them
4. **Document discoveries** - Add to this file when you solve tricky issues

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
   
   **Current Active Pipelines**:
   - `all_pipelines/` - Master pipeline for managing all other pipelines
   - `analysis/` - Script analysis and classification tools
   - `auth/` - Authentication and user management
   - `database/` - Database migrations and management
   - `dev_tasks/` - Development task tracking and git integration
   - `document/` - Document processing and management
   - `document_types/` - Document type classification
   - `gmail/` - Gmail integration and email processing
   - `google_sync/` - Google Drive synchronization
   - `media-processing/` - Audio/video processing pipelines
   - `presentations/` - Presentation management
   - `prompt_service/` - AI prompt management
   - `service_dependencies/` - Service dependency mapping
   - `viewers/` - Various file viewers and servers
   
   **Pipeline Standards**:
   - Keep flat file structure within pipeline folders - no nested subfolders
   - Each pipeline uses commander.js for CLI integration
   - Each pipeline has its own package.json with commander.js v11.0.0
   - Always implement command tracking for new commands
   
   **⚠️ Pipeline Refactoring in Progress**:
   - Some pipelines may be consolidated or renamed
   - Check `command_pipelines` table for current active pipelines
   - New pipelines require proper registration in the database

4. **Essential Patterns**:

   **Singleton Services**: Always use the correct pattern for your environment:
   
   **Supabase Connection Patterns**:
   ```typescript
   // ✅ FOR BROWSER APPS (React/Vite) - Use createSupabaseAdapter
   // File: apps/{app-name}/src/lib/supabase.ts (ONE file per app!)
   import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
   
   export const supabase = createSupabaseAdapter({
     env: import.meta.env as any  // REQUIRED for browser apps!
   });
   
   // ✅ FOR CLI SCRIPTS & SERVER CODE - Use SupabaseClientService singleton
   import { SupabaseClientService } from '@shared/services/supabase-client';
   const supabase = SupabaseClientService.getInstance().getClient();
   ```
   
   - ⚠️ **NEVER create direct clients with createClient()** - always use the patterns above
   - ⚠️ **ONE Supabase file per app** - no multiple supabase.ts, supabase-browser.ts, etc.
   - ⚠️ **Browser apps MUST pass env** - `createSupabaseAdapter()` without env will fail
   
   **Claude AI**: 
   - ⚠️ `import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';`

   **Database Schema**: 
   - ⚠️ **ONLY use `supabase/types.ts`** for database schema information
   - This is the single source of truth for all table structures and relationships

   **Database Table Naming Convention**:
   
   ⚠️ **CRITICAL: Table Naming Rules**
   1. **ALWAYS use one of the established prefixes** - no exceptions
   2. **ALWAYS ask the user before creating ANY new table** - they may want to create a new prefix
   3. **NEVER create a table without a prefix** - this breaks the naming convention
   4. **NEVER overwrite existing table names** - always check if a table exists first
   
   **Established Prefixes**:
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
   - `registry_` - Registry tables for cataloging items (e.g., registry_scripts, registry_services, registry_apps)
   - `service_` - Service dependency & relationship tables (e.g., service_exports, service_command_dependencies)
   - `worktree_` - Git worktree management (e.g., worktree_definitions, worktree_app_mappings)
   - `import_` - **CRITICAL: Data import tables - ALWAYS use this prefix for SQLite imports** (e.g., import_urls, import_web_concepts)
   
   **Examples**: 
   - New authentication feature → `auth_password_resets`
   - New AI feature → `ai_embeddings`
   - New learning feature → `learn_quiz_results`
   - SQLite data import → `import_document_types` (NEVER just `document_types` if it exists!)
   
   ⚠️ **If your table doesn't fit any existing prefix**:
   - STOP and ask the user what to do
   - They may want to create a new prefix category
   - NEVER proceed without proper prefix assignment
   
   Always check existing prefixes before creating a new one. All migrations must be tracked in `sys_table_migrations`.
   
   **Table Creation Dates**: When creating new tables, always add an entry to `sys_table_definitions` with the creation date:
   ```sql
   -- After creating your table, add its metadata
   INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
   VALUES ('public', 'your_new_table', 'Brief description', 'Purpose/use case', CURRENT_DATE);
   ```
   
   **Database View Naming Convention**:
   - All views MUST end with `_view` suffix for clarity
   - ⚠️ **CRITICAL: Views MUST use the prefix of their primary table**
   - This ensures views sort alphabetically with their related tables
   - The prefix determines which functional area owns the view
   
   **Examples of Correct View Naming**:
   - `command_refactor_status_summary_view` - Uses `command_` prefix (primary table: command_refactor_tracking)
   - `dev_tasks_with_git_view` - Uses `dev_` prefix (primary table: dev_tasks)
   - `learn_user_progress_view` - Uses `learn_` prefix (primary table: learn_user_analytics)
   - `ai_work_summaries_recent_view` - Uses `ai_` prefix (primary table: ai_work_summaries)
   - `google_sources_with_experts_view` - Uses `google_` prefix (primary table: google_sources)
   
   **Why This Matters**:
   - Views appear next to their related tables in database tools
   - Clear ownership - you know which subsystem the view belongs to
   - Consistent organization across the entire schema
   - Easy to find all views for a specific functional area

   **Database Best Practices**:
   
   **When to Use Views vs Tables**:
   - **Use Views** when:
     - Combining data from multiple tables for read-only access
     - Creating computed columns or aggregations
     - Simplifying complex queries for app consumption
     - Enforcing a consistent API over changing table structures
   - **Use Tables** when:
     - Data needs to be written/updated
     - Performance is critical (views can be slower)
     - You need triggers, constraints, or indexes
     - Data represents a core business entity
   
   **Foreign Key Best Practices**:
   ```sql
   -- Always name constraints descriptively
   ALTER TABLE google_expert_documents 
   ADD CONSTRAINT fk_expert_documents_expert_profile 
   FOREIGN KEY (expert_id) REFERENCES expert_profiles(id) ON DELETE CASCADE;
   
   -- Use appropriate cascade actions
   ON DELETE CASCADE     -- Child records deleted with parent
   ON DELETE RESTRICT    -- Prevent parent deletion if children exist
   ON DELETE SET NULL    -- Set FK to null when parent deleted
   ```
   
   **Common RLS (Row Level Security) Patterns**:
   ```sql
   -- Pattern 1: Public read, authenticated write
   CREATE POLICY "Enable read access for all users" ON table_name
       FOR SELECT USING (true);
   CREATE POLICY "Enable insert for authenticated users" ON table_name
       FOR INSERT WITH CHECK (auth.role() = 'authenticated');
   
   -- Pattern 2: User-specific data
   CREATE POLICY "Users can view own data" ON user_data
       FOR SELECT USING (auth.uid() = user_id);
   
   -- Pattern 3: Admin override
   CREATE POLICY "Admins can do anything" ON table_name
       FOR ALL USING (
         EXISTS (
           SELECT 1 FROM auth_user_profiles
           WHERE auth.uid() = id AND role = 'admin'
         )
       );
   ```

   **Database View Naming Convention**:
   - ⚠️ **ALL views MUST end with `_view` suffix** (e.g., `ai_work_summaries_recent_view`, `media_content_view`)
   - Views should follow the same prefix pattern as tables
   - View descriptions in `sys_table_definitions` should explain:
     - Primary tables involved in the view
     - Purpose of the aggregation/joining
     - Any filtering or time-based constraints
   - Example: `command_refactor_status_summary_view` - "Aggregates command_refactor_tracking data to show overall refactoring progress by status and pipeline"
   - When creating views, add them to `sys_table_definitions` with `object_type = 'view'`

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
   
   **⚠️ Manual Type Generation** (when needed):
   ```bash
   pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts
   ```

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

## Task-Aware Git Commits

⚠️ **ALWAYS check for active tasks before committing changes**

When the user asks you to commit changes, follow this workflow:

1. **Check for active tasks in the current worktree**:
   ```bash
   ./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh commit
   ```
   
2. **If a task is found**:
   - The CLI will show active tasks in the current worktree
   - Select the appropriate task (or none if the work isn't task-related)
   - Include the task ID in your commit message:
   
   ```
   feat: implement worktree mappings feature
   
   Task: #07832f16-301d-4a77-8c97-67f84725fe37
   
   - Add WorktreeMappings page
   - Fix CreateTaskPage dropdown
   
   🤖 Generated with [Claude Code](https://claude.ai/code)
   
   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

3. **Benefits**:
   - Automatically links commits to tasks
   - Updates task notes with commit SHA
   - Makes it easy to track what commits solved which tasks
   - Helps with project history and debugging

4. **When to use**:
   - ✅ ALWAYS when committing task-related work
   - ✅ When the user asks for commits/merges
   - ❌ Skip for minor fixes unrelated to any task
   
**Note**: The task tracking is automatic - the CLI will find tasks based on the current worktree path

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
   - ❌ NEVER create your own Supabase clients with `createClient()`
   - ✅ BROWSER APPS: Use `createSupabaseAdapter({ env: import.meta.env as any })`
   - ✅ CLI/SERVER: Use `SupabaseClientService.getInstance().getClient()`

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

7. **Multiple Supabase Client Instances in Apps**:
   - ❌ **Problem**: Apps creating multiple Supabase client files/instances (e.g., supabase.ts, supabase-browser.ts, supabase-browser-adapter.ts)
   - ✅ **Solution**: See "Essential Patterns > Supabase Connection Patterns" above for the correct approach
   - Each app should have ONE `lib/supabase.ts` file
   - If an app has multiple Supabase files, consolidate them into one

8. **Incorrect Date Handling**:
   - ❌ **Problem**: Using incorrect dates in file names or documentation
   - ✅ **Solution**: Always check the actual date using system commands
   - **Getting Current Date**:
     ```bash
     # For file names (YYYYMMDD format):
     date +%Y%m%d  # Example: 20250607
     
     # For documentation headers:
     date          # Example: Sat Jun  7 08:58:14 PDT 2025
     
     # For timestamp in file names:
     date +%Y-%m-%dT%H-%M-%S  # Example: 2025-06-07T08-58-14
     ```
   - **In TypeScript/JavaScript**:
     ```typescript
     // Always use new Date() for current date
     const currentDate = new Date();
     const dateString = currentDate.toISOString().split('T')[0]; // 2025-06-07
     const timestamp = currentDate.toISOString(); // 2025-06-07T15:58:14.000Z
     ```
   - ⚠️ **Important**: The environment shows today's date in `<env>` tags but should be verified with actual system date

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

## TypeScript Troubleshooting

### Common TypeScript Errors and Solutions

1. **"Cannot find module" Errors**:
   ```
   ❌ Error: Cannot find module '@shared/services/...' or its corresponding type declarations
   ```
   **Solutions**:
   - Check if the path is correct and file exists
   - Verify tsconfig.json has proper path mappings
   - For browser apps, check vite.config.ts alias configuration
   - Try relative imports as a temporary workaround: `../../../packages/shared/...`
   - Run `pnpm install` to ensure dependencies are linked

2. **Type Mismatches with supabase/types.ts**:
   ```
   ❌ Error: Type 'string | null' is not assignable to type 'string'
   ```
   **Solutions**:
   - Always check for null: `if (data.field) { ... }`
   - Use nullish coalescing: `data.field ?? 'default'`
   - Update types after schema changes: `pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts`
   - Use type assertions carefully: `data.field as string` (only when certain)

3. **ESM/CommonJS Compatibility Issues**:
   ```
   ❌ Error: require() of ES Module not supported
   ❌ Error: Cannot use import statement outside a module
   ```
   **Solutions**:
   - For Node.js scripts, use `.mjs` extension or add `"type": "module"` to package.json
   - For mixed environments, use dynamic imports: `const module = await import('./module.js')`
   - In Vite apps, modules are ESM by default
   - For CLI scripts using ts-node: `ts-node --esm script.ts`

4. **Import.meta.env Errors in Shared Packages**:
   ```
   ❌ Error: Cannot access 'import.meta' outside a module
   ```
   **Solutions**:
   - Shared packages cannot access `import.meta.env` directly
   - Pass environment from the app: `createAdapter({ env: import.meta.env })`
   - Use dependency injection pattern for environment-specific values

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
- Use proper column names: `expert_profiles.expert_name`, `document_types.name`

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

## ⚠️ CRITICAL: SQLite to Supabase Migration Safety

**ALWAYS CHECK FOR EXISTING TABLES BEFORE IMPORTING FROM SQLITE**

When migrating data from SQLite to Supabase, you MUST verify that the target table name doesn't conflict with existing Supabase tables. Importing with the same name as an existing table can **permanently overwrite critical data**.

**⚠️ CRITICAL Rules for SQLite Imports**:
1. **ALWAYS prefix imported tables with `import_`** - no exceptions
2. **ALWAYS check existing tables before creating any import table**
3. **NEVER use the same name as an existing Supabase table**
4. **ALWAYS verify the import script checks for existing tables**

**❌ DANGEROUS Example**:
```sql
-- If 'document_types' already exists in Supabase, this will DESTROY it!
CREATE TABLE document_types AS SELECT * FROM sqlite_export;
pgloader sqlite://file.db postgresql://... -- Without checking target tables!
```

**✅ SAFE Approach**:
```sql
-- 1. Always check for existing tables first
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('web_concepts', 'import_web_concepts');

-- 2. ALWAYS use import_ prefix for SQLite imports
CREATE TABLE import_document_types (...);  -- CORRECT: import_ prefix
CREATE TABLE import_web_concepts (...);    -- CORRECT: import_ prefix

-- 3. Keep backups before any migration
pg_dump ... > backup_before_migration.sql

-- 4. In your import scripts, ALWAYS include existence checks:
DROP TABLE IF EXISTS import_web_concepts;  -- Safe - only drops import table
CREATE TABLE import_web_concepts (...);
```

**Real Incident**: Tables like `document_types` and `ai_prompts` were accidentally overwritten because they had the same names in both SQLite and Supabase. This caused significant data loss that required restoration from backups. **This MUST never happen again.**

**Import Script Requirements**:
- Must check for existing tables before creating
- Must use `import_` prefix for all imported tables
- Must NOT drop or modify non-import tables
- Should include clear comments about what's being imported

## Claude Service Usage

**Import and Use the Singleton**:
```typescript
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

// Use directly - never create new instances
const response = await claudeService.sendPrompt('Your prompt');
const jsonResponse = await claudeService.getJsonResponse('Your prompt');
```

## Database Table Relationships

### google_sources (formerly sources_google) Recursive Search

The `google_sources` table uses a hierarchical structure for Google Drive folders and files:

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
  FROM google_sources 
  WHERE drive_id = 'target_folder_id'
  
  UNION ALL
  
  -- Recursive case: find children
  SELECT s.drive_id, s.parent_folder_id, s.name, s.path_depth, ft.level + 1
  FROM google_sources s
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

**Setting Up @shared Alias in Vite Apps**:
```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
});
```

**Common Errors and Fixes**:

1. **Missing environment variable error**:
```
❌ Error: Missing required Vite environment variable: VITE_SUPABASE_ANON_KEY
```
Fix: Pass environment variables to adapter:
```typescript
// ❌ Wrong - doesn't work in browser
const supabase = createSupabaseAdapter();

// ✅ Correct - pass environment variables
const supabase = createSupabaseAdapter({ env: import.meta.env as any });
```

2. **Module resolution error (500 Internal Server Error)**:
```
❌ Error: Cannot find module '@shared/adapters/supabase-adapter'
```
Fix: Add @shared alias to vite.config.ts (see above)

3. **Obsolete adapter methods**:
```
❌ Error: Cannot find name 'supabaseAdapter'
```
The old `supabaseAdapter` object with methods like `getDiagnostics()` and `ensureAuth()` no longer exists. Use the Supabase client directly:
```typescript
// ❌ Old way
const { success } = await supabaseAdapter.ensureAuth();

// ✅ New way
const { data, error } = await supabase.from('table').select();
```

**When to Use**:
- All browser apps (dhg-hub, dhg-audio, dhg-admin-code, etc.)
- CLI scripts and server-side code
- Any situation where you need Supabase access across environments

### Browser Compatibility for Node.js Dependencies

**❌ Problem**: Browser apps importing shared services that use Node.js-specific modules
- Error: `Module "node:events" has been externalized for browser compatibility`
- Error: `Cannot read properties of undefined (reading 'isTTY')`
- Error: `Class extends value undefined is not a constructor`
- These occur when shared services import Node.js modules like `googleapis`, `google-auth-library`, or use Node.js globals

**✅ Solution**: Create browser-safe imports and provide Node.js polyfills

1. **Create Browser-Safe Export Files**:
   ```typescript
   // packages/shared/services/google-drive/browser-index.ts
   export { GoogleDriveBrowserService, googleDriveBrowser } from './google-drive-browser-service';
   // Only export browser-compatible services, exclude Node.js-specific ones
   ```

2. **Configure Vite Aliases**:
   ```typescript
   // vite.config.ts
   resolve: {
     alias: {
       '@shared/services/google-drive': path.resolve(__dirname, '../../packages/shared/services/google-drive/browser-index.ts'),
     }
   }
   ```

3. **Add Node.js Polyfills in HTML**:
   ```html
   <!-- index.html - Add before main script -->
   <script>
     if (typeof global === 'undefined') window.global = window;
     if (typeof process === 'undefined') {
       window.process = {
         env: {},
         stdout: { isTTY: false },
         stderr: { isTTY: false },
         stdin: { isTTY: false },
         platform: 'browser',
         version: 'v16.0.0',
         versions: { node: '16.0.0' }
       };
     }
   </script>
   ```

4. **Add Required Environment Variables**:
   ```env
   # .env.development for browser apps
   VITE_CLAUDE_API_KEY=your-api-key
   VITE_ANTHROPIC_API_KEY=your-api-key
   ```

**Key Principles**:
- Browser apps cannot use Node.js modules (`fs`, `path`, `crypto`, `events`, etc.)
- Create separate browser-safe exports that exclude Node.js dependencies
- Use Vite aliases to redirect imports to browser-safe versions
- Provide polyfills for Node.js globals that some libraries expect
- Always check if a shared service imports Node.js modules before using in browser

**When Issues Persist**:
- Run `./scripts/cli-pipeline/all_pipelines/app-reinstall.sh app-name` to clean dependencies
- Check for indirect Node.js dependencies in shared services
- Consider creating browser-specific service implementations

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
| 5173 | dhg-hub-lovable | Dedicated |
| 5174 | dhg-hub | Dedicated |
| 5175 | dhg-admin-suite | Dedicated |
| 5176 | dhg-admin-google | Dedicated |
| 5177 | dhg-admin-code | Dedicated |
| 5178 | dhg-a | Dedicated |
| 5179 | dhg-b | Dedicated |
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

## Git & Worktree Management

### ⚠️ CRITICAL: This Repository is Managed by Claude Code

**Important Context**:
- **ALL git operations are handled by Claude Code** - not by humans
- **NO manual git commands** should be run by users
- **NO GitHub UI operations** for merging or PRs
- **Worktrees are used** for parallel development work

### Understanding Worktree Branch Management

**The Unique Nature of Worktrees**:

Each worktree is a **separate directory with its own branch**, allowing parallel development:
```
dhg-mono/                    # Main worktree (development branch)
dhg-mono-improve-audio/      # Worktree for audio improvements
dhg-mono-feature-xyz/        # Worktree for feature XYZ
```

**The Worktree Update Cycle** (unique to this workflow):

1. **Branch lives independently** in its own directory
   - You work in isolation without affecting other branches
   - Changes accumulate over time in your worktree

2. **Periodic merge to development**:
   ```bash
   # From worktree branch:
   git push origin feature-branch:development
   ```
   - Your changes flow into the main development branch
   - Other developers benefit from your work

3. **Pull updates back from development**:
   ```bash
   # Still in worktree:
   git fetch origin development
   git merge origin/development
   ```
   - You receive everyone else's changes
   - Your branch stays current with the project

4. **The cycle repeats**:
   - Work → Push to development → Pull from development → Work...
   - This creates a "breathing" pattern of isolation and integration

**Why This Is Different**:
- Traditional branches require constant switching
- Worktrees let each branch "live" permanently in its own space
- No need to stash changes or switch contexts
- Multiple features can progress simultaneously

### Standard Git Workflow

1. **Committing Changes**:
   - Claude Code handles all commits
   - Commits always include the 🤖 signature
   - Co-authored commits credit Claude
   - Task IDs are automatically included when applicable

2. **Branch Management**:
   - **Main branch**: `development` (not `main` or `master`)
   - **Feature branches**: Created in worktrees for specific work
   - **No feature branch PRs** - direct merges only

3. **Merging Workflow** (Claude Code handles this):
   ```bash
   # 1. Commit all changes in current branch
   git add .
   git commit -m "Your commit message..."
   
   # 2. Push branch to remote
   git push origin current-branch
   
   # 3. Merge to development (NO PR!)
   git push origin current-branch:development
   
   # 4. Update local development
   git fetch origin development
   git merge origin/development
   ```

### ⚠️ CRITICAL: Worktree Merging - NO PULL REQUESTS!

**IMPORTANT**: When working with multiple worktrees, **DO NOT create pull requests**. This has caused deployment issues where the PR workflow got stuck or confused the branch states.

**❌ WRONG - Do NOT do this**:
```bash
# NEVER DO THIS in worktrees:
gh pr create ...
# NEVER create PRs through GitHub UI
# NEVER use any PR-based workflow
```

**✅ CORRECT - Direct push to development**:
```bash
# Push your branch directly to development:
git push origin your-branch:development

# Then fetch and merge back:
git fetch origin development
git merge origin/development
```

### Why This Workflow?
- **Claude Code automation** - Git operations are automated
- **No PRs with worktrees** - Avoids deployment pipeline issues
- **Direct pushes** - Cleaner and more reliable
- **Consistent history** - All commits properly attributed
- **Task integration** - Commits linked to dev_tasks automatically

### Branch Strategy

**Active Branches**:
- `development` - Main development branch (default)
- `production` - Production deployments (protected)
- Feature branches - Created in worktrees for specific work

**Important Notes**:
- **Deployment happens from `development`** to staging environments
- **Production deployments** require special approval
- **Feature branches** are temporary and deleted after merging
- **No long-lived feature branches** - merge frequently

### What This Means for You (the User)

1. **Just describe what you want** - Claude Code handles the git work
2. **Don't run git commands manually** - Let Claude Code manage it
3. **Review commits in GitHub** - After Claude Code pushes changes
4. **Trust the process** - This workflow has been refined over time

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

This document provides the essential guidelines for working with Claude Code v1.05. The most important principles are:

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
11. **⚠️ NEVER create PRs with worktrees** - use direct push to development instead

When in doubt, ask for clarification rather than making assumptions or implementing temporary solutions.

