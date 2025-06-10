# Database Naming Consolidation and Service Table Merger

**Date**: June 10, 2025  
**Branch**: improve-cli-pipelines  
**Category**: refactor  
**Tags**: database, naming-conventions, table-consolidation, service-registry

## Summary

This work session focused on improving database consistency through two major initiatives:

1. **Database Table/View Renaming**: Renamed several tables and views to follow consistent naming conventions with proper prefixes
2. **Service Table Consolidation**: Merged the redundant `service_shared` table into `sys_shared_services` for a single source of truth

## Major Changes

### 1. Table/View Renaming for Consistency

Renamed the following database objects to follow proper prefix conventions:

- `cli_commands_ordered_view` → Already renamed to `command_commands_ordered_view` (found in previous migration)
- `shared_services` → `service_shared` (to follow noun_adjective pattern)
- `task_criteria_inheritance` → `dev_task_criteria_inheritance` (to use dev_task_ prefix)
- `success_criteria_templates` → `element_success_criteria_templates` (to use element_ prefix)

### 2. Service Table Consolidation

Consolidated two redundant service tracking tables:
- Merged `service_shared` (58 records) into `sys_shared_services` (40 records)
- Added missing columns to `sys_shared_services`: `used_by_apps`, `used_by_pipelines`, `service_name_normalized`
- Created name mapping from kebab-case to PascalCase service names
- Updated all foreign key relationships
- Preserved all data from both tables

## Technical Implementation

### Database Migrations Created

1. **20250610_rename_tables_for_consistency.sql**
   - Safe renaming with existence checks
   - Updates to sys_table_definitions and sys_table_migrations
   - Proper DO blocks for error handling

2. **20250610_consolidate_service_tables.sql**
   - Added missing columns to sys_shared_services
   - Created normalize_service_name() function for name mapping
   - Migrated all data with proper merging logic
   - Updated foreign key constraints
   - Dropped the redundant service_shared table

### Code Updates

Updated references in:
- `apps/dhg-admin-code/src/pages/WorktreeMappings.tsx` (3 references)
- `packages/shared/services/element-catalog-service.ts` (1 reference)

### Benefits Achieved

1. **Consistent Naming**: All tables now follow proper prefix conventions
2. **Single Source of Truth**: Eliminated redundant service tracking
3. **Better Metadata**: sys_shared_services has more comprehensive service information
4. **Automated Maintenance**: Leverages existing populate-service-registry.ts script
5. **Preserved Data**: No data loss during consolidation

## Files Modified

- `supabase/migrations/20250610_rename_tables_for_consistency.sql` (new)
- `supabase/migrations/20250610_consolidate_service_tables.sql` (new)
- `apps/dhg-admin-code/src/pages/WorktreeMappings.tsx`
- `packages/shared/services/element-catalog-service.ts`
- `supabase/types.ts` (auto-generated after migrations)

## Key Commands Executed

```bash
# Migration validation and execution
npx ts-node scripts/cli-pipeline/database/commands/migration/validate.ts --file <migration>
npx ts-node scripts/cli-pipeline/database/commands/migration/run-staged.ts <migration>

# TypeScript validation
tsc --noEmit --skipLibCheck
```

## Next Steps

- Monitor the consolidated sys_shared_services table for any issues
- Ensure populate-service-registry.ts continues to work correctly
- Consider similar consolidation for other redundant tables if found