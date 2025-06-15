# Manual Migration Steps for sys_cli_pipelines

## Prerequisites
The following files have been created and are ready to use:
- Archive service and CLI
- Migration SQL files
- Update scripts

## Step 1: Run Database Migrations

Run these migrations in order through Supabase Dashboard SQL Editor or psql:

```sql
-- 1. Create archive system
-- File: supabase/migrations/20250615_create_sys_archived_tables.sql

-- 2. Add refactoring fields
-- File: supabase/migrations/20250615_add_refactoring_fields_to_sys_cli_pipelines.sql

-- 3. Migrate data
-- File: supabase/migrations/20250615_migrate_registry_to_sys_cli_pipelines.sql
```

## Step 2: Run the Complete Migration Script

After migrations are applied:

```bash
ts-node scripts/complete-sys-migration.ts
```

This will:
1. Update refactoring status for all 50 pipelines
2. Archive registry_cli_pipelines table
3. Show verification results

## Step 3: Drop the Old Table (Manual)

After confirming the archive is successful:

```sql
DROP TABLE registry_cli_pipelines CASCADE;
```

## Verification Checklist

- [ ] sys_archived_tables table exists
- [ ] sys_cli_pipelines has refactoring fields
- [ ] All data migrated (38 records from registry → sys)
- [ ] Refactoring status updated (50 pipelines total)
- [ ] registry_cli_pipelines archived
- [ ] All code references updated (already done)

## Current Status

✅ Code is ready and updated
✅ Migration files created
✅ Archive service implemented
✅ Refactoring data prepared
⏳ Waiting for database migrations to be run

## Summary of Changes

- 50 pipelines with full refactoring tracking:
  - ALPHA: 11 pipelines, 86 tests
  - BETA: 17 pipelines, 148 tests
  - GAMMA: 22 pipelines, 133 tests
  - Total: 367 tests across all pipelines