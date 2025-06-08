# Claude Code Instructions (v1.06)

## ⚠️ Database Tables Renamed

For table/view renaming mappings, see `docs/database/table-view-renaming-reference.md`.
- Tables use prefixes: auth_, ai_, google_, learn_, media_, doc_, etc.
- Views end with `_view` suffix
- Check `supabase/types.ts` for current schema

## ⚠️ Critical Rules

1. **No workarounds without permission** - Explain issues and get approval
2. **No PRs with worktrees** - Use `git push origin branch:development`
3. **Check shared services first** - `packages/shared/services/`
4. **Use health checks** - `./scripts/cli-pipeline/maintenance-cli.sh health-check`

## Code Review Checklist

**Before writing:**
- Check shared services, proper file locations, existing functionality
- Use `supabase/types.ts` as single source of truth
- Never hardcode secrets - use .env files

**Before submitting:**
- Run `tsc --noEmit`
- Test with real data
- Verify CLI integration
- No hardcoded credentials

## Project State

**Ongoing refactoring:**
- Tables renamed with consistent prefixes (see renaming doc)
- 14+ CLI pipelines - check `command_pipelines` table
- Shared services being extracted from apps
- Types auto-generated after migrations
- Update old code as you find it

## Code Organization Principles

## Code Organization

1. **Never add files to root** - Use proper locations:
   - Scripts: `scripts/cli-pipeline/{domain}/`
   - Services: `packages/shared/services/`
   - Docs: `docs/{category}/`

2. **Shared services first** - Check existing before creating new

3. **UI pages as service sources** - Extract reusable functionality

4. **CLI Pipelines** - Scripts go in `scripts/cli-pipeline/{domain}/`:
   - all_pipelines, analysis, auth, database, dev_tasks
   - document, document_types, gmail, google_sync
   - media-processing, presentations, prompt_service
   - service_dependencies, viewers
   
   Standards: Flat structure, commander.js, command tracking

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

   **Table Naming** - Always use prefixes:
   - auth_, ai_, google_, learn_, media_, doc_
   - expert_, email_, command_, filter_, batch_
   - scripts_, sys_, dev_, registry_, service_
   - worktree_, import_ (for SQLite imports)
   
   Ask before creating tables without matching prefix.
   
   **Views** - Must end with `_view` and use primary table prefix

   **DB Best Practices**:
   - Views: read-only, aggregations
   - Tables: writable data, core entities
   - Name FK constraints descriptively
   - Use RLS for security
   - Never hardcode credentials

5. **Archiving** - Use `.archived_scripts` folders with dates


## CLI Integration

1. **Integrate all scripts** into CLI pipelines (never standalone)
2. **Track commands** - use `track_command` function
3. **Register new commands**:
   ```bash
   ./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh populate-command-registry
   ./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh sync-command-status
   ```

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

1. **QA**: Run `tsc --noEmit`, test with real data
2. **DB Migrations**: Types auto-generated after migrations
3. **Refactoring**: Small incremental changes, test each step
4. **Document**: Add troubleshooting to CLAUDE.md after solving issues

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
1. Run `tsc --noEmit`
2. No hardcoded credentials
3. Test with real data
4. Scripts in `scripts/cli-pipeline/{domain}/`
5. Commands integrated into CLI

## DB Migrations
```bash
./scripts/cli-pipeline/database/database-cli.sh migration validate [file]
./scripts/cli-pipeline/database/database-cli.sh migration test [file]
./scripts/cli-pipeline/database/database-cli.sh migration run-staged [file]
```

## Common Issues

1. **Wrong file locations** - Scripts go in `scripts/cli-pipeline/{domain}/`
2. **Direct DB clients** - Use adapters/singletons, not `createClient()`
3. **Hardcoded secrets** - Use `.env.development`
4. **Workarounds** - Ask permission first
5. **Standalone scripts** - Integrate into CLI pipelines
6. **SQL ambiguity** - Qualify columns: `table.column`
7. **Multiple Supabase files** - One `lib/supabase.ts` per app
8. **Date handling** - Use `date +%Y%m%d` or `new Date()`

## Debugging Tips

1. **Config issues** - Compare with working apps (dhg-hub, dhg-improve-experts)
2. **React Router** - Check `BrowserRouter` in main.tsx
3. **Import fails** - Use specific paths: `@shared/components/profile/ProfileForm`
4. **Refactoring** - Test incrementally, keep error handling

## TypeScript
- Explicit types for all parameters/returns
- No `any` - use `unknown` with guards
- Handle null/undefined
- Use `supabase/types.ts` for DB types

## TypeScript Errors

1. **Module not found** - Check paths, run `pnpm install`
2. **Type mismatches** - Handle nulls: `data.field ?? 'default'`
3. **ESM/CommonJS** - Use `.mjs` or `"type": "module"`
4. **import.meta.env** - Pass env from app, not shared packages

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

## SQLite Import Safety

**⚠️ ALWAYS use `import_` prefix for SQLite imports**

```sql
-- Check existing tables first
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Use import_ prefix
CREATE TABLE import_document_types (...);

-- Safe drop
DROP TABLE IF EXISTS import_web_concepts;
```

**Real incident**: Tables were overwritten causing data loss. Never repeat.

## Claude Service Usage

**Import and Use the Singleton**:
```typescript
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

// Use directly - never create new instances
const response = await claudeService.sendPrompt('Your prompt');
const jsonResponse = await claudeService.getJsonResponse('Your prompt');
```

## google_sources Hierarchy

Use `drive_id` and `parent_folder_id` for navigation (not Supabase UUIDs):

```sql
WITH RECURSIVE folder_tree AS (
  SELECT drive_id, parent_folder_id, name FROM google_sources 
  WHERE drive_id = 'target_folder_id'
  UNION ALL
  SELECT s.drive_id, s.parent_folder_id, s.name
  FROM google_sources s
  INNER JOIN folder_tree ft ON s.parent_folder_id = ft.drive_id
)
SELECT * FROM folder_tree;
```

## Cross-Environment Services

**Use dependency injection** - Services should accept clients, not create them:
```typescript
// ❌ Wrong: Auto-initialize in constructor
private supabase = SupabaseClientService.getInstance().getClient();

// ✅ Right: Accept as parameter
constructor(supabaseClient: SupabaseClient<any>) {
  this.supabase = supabaseClient;
}
```

### Vite Cache Issues

**Not seeing code changes?** Clear caches:
```bash
./scripts/clear-all-caches.sh        # All apps
./scripts/clear-app-cache.sh dhg-audio  # Specific app
./scripts/dev-fresh.sh dhg-audio     # Clear + start dev
```
Also: Hard refresh browser (Cmd+Shift+R)

### Supabase Adapter

**Browser apps** - Pass environment:
```typescript
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
const supabase = createSupabaseAdapter({ env: import.meta.env as any });
```

**CLI/Server** - No params needed:
```typescript
const supabase = createSupabaseAdapter();
```

**Vite config** - Add alias:
```typescript
alias: {
  '@shared': path.resolve(__dirname, '../../packages/shared'),
}
```

### Browser Node.js Compatibility

**Node.js module errors?**
1. Create browser-safe exports
2. Use Vite aliases to redirect imports
3. Add polyfills in index.html:
```html
<script>
if (typeof global === 'undefined') window.global = window;
if (typeof process === 'undefined') {
  window.process = { env: {}, platform: 'browser' };
}
</script>
```

## Google Drive Setup

**Required**: `.service-account.json` in project root

**Commands needing Drive access**:
- `sync`, `find-folder`, `get-current-drive-id`
- `check-duplicates --check-current`

**Error "Could not initialize Google Drive API"?**
- Check `.service-account.json` exists
- Verify service account permissions

### Google Drive iframe Previews

**Use `/preview` endpoint** to avoid CSP errors:
```typescript
const extractDriveId = (url: string | null): string | null => {
  const match = url?.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
};

<iframe src={`https://drive.google.com/file/d/${extractDriveId(url)}/preview`} />
```

## Port Management

**Ranges**: 3000-3099 (servers), 5000-5999 (Vite dev), 4000-4999 (preview)

**Start all servers**: `pnpm servers`

**Port in use?**
```bash
lsof -i :3001
kill -9 $(lsof -t -i:3001)
```

**Key ports**: 3001-3010 (various servers), 5173-5179/5194/8080 (Vite apps)

## Git & Worktrees

### Claude Code Manages All Git Operations

**Worktrees** = separate directories for parallel work:
```
dhg-mono/                # Main (development branch)
dhg-mono-feature-xyz/    # Feature worktree
```

**Workflow cycle**:
1. Work in isolation
2. Push to development: `git push origin branch:development`
3. Pull updates: `git fetch origin development && git merge origin/development`
4. Repeat

**⚠️ NO PULL REQUESTS** - Direct push only:
```bash
# ❌ Wrong: gh pr create
# ✅ Right: git push origin branch:development
```

**Branches**: development (main), production (protected), feature branches (temporary)

## pnpm-lock.yaml Conflicts

```bash
git checkout --theirs pnpm-lock.yaml
git add pnpm-lock.yaml
pnpm install
```
Never manually edit - always regenerate.

## Key Points
1. No workarounds without permission
2. Scripts in `scripts/cli-pipeline/{domain}/`
3. Use singleton services
4. No PRs with worktrees - direct push only
5. Test before submitting
6. `.service-account.json` for Google Drive
7. Ask when unsure

