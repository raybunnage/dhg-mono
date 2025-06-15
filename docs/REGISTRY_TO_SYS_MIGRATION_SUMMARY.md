# Registry to Sys CLI Pipelines Migration Summary

## Overview
Migrated from `registry_cli_pipelines` to `sys_cli_pipelines` for consistency with the `sys_` naming convention used throughout the database.

## Migration Steps Completed

### 1. ✅ Created Archive Service & CLI
- **New Service**: `ArchiveService` in `packages/shared/services/archive-service/`
- **New CLI**: `archive-cli.sh` in `scripts/cli-pipeline/archive/`
- **New Table**: `sys_archived_tables` to store archived table schemas

### 2. ✅ Added Refactoring Tracking Fields
Added to `sys_cli_pipelines`:
- `refactoring_group` (ALPHA, BETA, GAMMA)
- `refactoring_status` (pending, in_progress, completed)
- `refactoring_checkpoint` (baseline, migrated, validated, finalized)
- `test_count` and `tests_passing`
- `refactoring_completed_at`
- `refactoring_notes`

### 3. ✅ Created Data Migration
- Migration script to copy all data from `registry_cli_pipelines` to `sys_cli_pipelines`
- Updates foreign key references
- Preserves all existing data

### 4. ✅ Updated Code References
- Updated 19 files from `registry_cli_pipelines` to `sys_cli_pipelines`
- Skipped migration files to preserve history

### 5. ✅ Created Refactoring Status Update Script
- Updates all 50 pipelines with their refactoring status
- Groups:
  - ALPHA: 11 pipelines, 86 tests
  - BETA: 17 pipelines, 148 tests  
  - GAMMA: 22 pipelines, 133 tests
- Total: 50 pipelines, 367 tests

## Migration Files Created

1. `20250615_create_sys_archived_tables.sql` - Archive system
2. `20250615_add_refactoring_fields_to_sys_cli_pipelines.sql` - New tracking fields
3. `20250615_migrate_registry_to_sys_cli_pipelines.sql` - Data migration
4. `20250615_archive_and_drop_registry_cli_pipelines.sql` - Final cleanup (manual)

## Next Steps

1. **Run Migrations** (in order):
   ```bash
   # Through Supabase CLI or database admin
   1. 20250615_create_sys_archived_tables.sql
   2. 20250615_add_refactoring_fields_to_sys_cli_pipelines.sql
   3. 20250615_migrate_registry_to_sys_cli_pipelines.sql
   ```

2. **Update Refactoring Status**:
   ```bash
   ts-node scripts/cli-pipeline/registry/update-refactoring-status.ts
   ```

3. **Archive the Old Table**:
   ```bash
   ./scripts/cli-pipeline/archive/archive-cli.sh archive-table registry_cli_pipelines \
     --reason "Migrated to sys_cli_pipelines for consistent sys_ naming convention"
   ```

4. **Drop the Old Table** (after confirming archive):
   ```sql
   DROP TABLE registry_cli_pipelines CASCADE;
   ```

## Benefits

1. **Consistency**: All system tables now use `sys_` prefix
2. **Tracking**: Full refactoring status tracking for all pipelines
3. **History**: Archived table preserves complete schema
4. **Safety**: Archive system allows recovery if needed