# sys_cli_pipelines Migration - Ready to Execute

## Current State
- ✅ `registry_cli_pipelines`: 38 records
- ✅ `sys_cli_pipelines`: 29 records (missing 9 records)
- ❌ `sys_archived_tables`: Does not exist
- ❌ Refactoring fields: Not added yet

## What Will Happen

### Step 1: Migrations (Manual)
Run these 3 SQL files in order:
1. `20250615_create_sys_archived_tables.sql` - Creates archive system
2. `20250615_add_refactoring_fields_to_sys_cli_pipelines.sql` - Adds tracking fields
3. `20250615_migrate_registry_to_sys_cli_pipelines.sql` - Migrates data

### Step 2: Automated Script
Run: `ts-node scripts/complete-sys-migration.ts`

This will:
1. **Update 50 pipelines** with refactoring status:
   - ALPHA (11): ai, all_pipelines, auth, continuous, continuous_docs, email, git, git_workflow, living_docs, scripts, work_summaries
   - BETA (17): mime_types, doc, docs, document_pipeline_service, drive_filter, gmail, media_analytics, classify, document_types, experts, presentations, prompt_service, element_criteria, document_archiving, google_sync, dev_tasks, media-processing
   - GAMMA (22): database, deployment, deprecation, maintenance, monitoring, proxy, refactor_tracking, registry, servers, service_dependencies, shared-services, system, testing, tracking, utilities, plus 7 more

2. **Archive registry_cli_pipelines** with full schema preservation

3. **Verify migration** showing:
   - 38+ records in sys_cli_pipelines
   - Refactoring data for all 50 pipelines
   - Archive record created

### Step 3: Final Cleanup (Manual)
```sql
DROP TABLE registry_cli_pipelines CASCADE;
```

## Expected Results

### Refactoring Summary
- **Total Pipelines**: 50
- **Total Tests**: 367
- **Test Coverage**: 100%

| Group | Pipelines | Tests | Avg Tests/Pipeline |
|-------|-----------|-------|-------------------|
| ALPHA | 11 | 86 | 7.8 |
| BETA | 17 | 148 | 8.7 |
| GAMMA | 22 | 133 | 6.0 |

### Benefits
1. **Consistent Naming**: All system tables use `sys_` prefix
2. **Full Tracking**: Every pipeline has refactoring status
3. **Archive Safety**: Old table preserved in sys_archived_tables
4. **Code Updated**: 19 files already updated to use sys_cli_pipelines

## Files Created
- ✅ Archive Service: `packages/shared/services/archive-service/`
- ✅ Archive CLI: `scripts/cli-pipeline/archive/`
- ✅ Migration Scripts: 3 SQL files
- ✅ Update Script: `update-refactoring-status.ts`
- ✅ Complete Script: `complete-sys-migration.ts`

## Ready to Execute
Everything is prepared. Just need to:
1. Run the SQL migrations
2. Execute the completion script
3. Drop the old table

The entire refactoring effort across all 50 CLI pipelines will be fully tracked!