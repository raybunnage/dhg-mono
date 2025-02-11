# Migration Management System

## Overview
This document describes our process for managing Supabase database migrations, specifically for the hybrid storage implementation.

## Directory Structure
```
/supabase/
├── migrations/
│   ├── planned/      # Migrations being developed
│   ├── testing/      # Migrations under test
│   ├── applied/      # Successfully applied migrations
│   └── rollbacks/    # Rollback scripts
├── scripts/
│   └── test-migration.sh
└── templates/
    └── migration_template.sql
```

## Migration Template

```sql
-- Migration: {description}
-- Created at: {timestamp}
-- Affects tables: [LIST_TABLES]
-- Risk Level: [low|medium|high]

-- !!! BACKUP RECOMMENDED BEFORE PROCEEDING !!!
-- Backup command: pnpm supabase db dump -f backup_${timestamp}.sql

BEGIN;

-- 1. Verify preconditions
DO $$ 
BEGIN
  -- Add verification checks here
END $$;

-- 2. Backup affected data (if needed)
CREATE TABLE IF NOT EXISTS backup_{table}_{timestamp} AS 
  SELECT * FROM {table};

-- 3. Migration changes
-- [YOUR MIGRATION CODE HERE]

-- 4. Verify changes
DO $$ 
BEGIN
  -- Add post-migration verification
END $$;

COMMIT;

-- Rollback script
/*
BEGIN;
  -- Rollback steps here
COMMIT;
*/
```

## Migration Process

### 1. Planning
- Create migration file in `/planned` directory
- Use timestamp prefix: YYYYMMDDHHMMSS
- Include clear description and affected tables
- Document preconditions and dependencies

### 2. Testing
```bash
# 1. Create backup
pnpm supabase db dump -f backup_pre_migration.sql

# 2. Apply migration
cat migrations/planned/migration_file.sql | pnpm supabase db sql

# 3. Verify changes
# Run verification queries

# 4. Test rollback if needed
cat migrations/rollbacks/rollback_file.sql | pnpm supabase db sql
```

### 3. Application
- Move tested migration to `/applied/YYYY-MM/`
- Document in change log
- Keep rollback script in `/rollbacks`

## Safety Guidelines

1. Always backup before migration
2. Test migrations in isolation
3. Keep rollback scripts ready
4. Verify after each step
5. Document all changes

## Common Commands

```bash
# Create backup
pnpm supabase db dump -f backup_name.sql

# Apply migration
pnpm supabase db reset # In development only
cat migration_file.sql | pnpm supabase db sql

# Check table structure
SELECT * FROM information_schema.columns 
WHERE table_name = 'table_name';
```

## Verification Queries

### Check Table Structure
```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'table_name'
ORDER BY ordinal_position;
```

### Verify Constraints
```sql
SELECT 
  tc.constraint_name, 
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'table_name';
```

### Check Indexes
```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'table_name';
```

## Error Recovery

If a migration fails:

1. Check the error message
2. Roll back the transaction
3. Apply the rollback script if needed
4. Restore from backup if necessary
5. Document the failure and resolution

## Best Practices

1. One Change Per Migration
   - Keep migrations focused
   - Easier to test and rollback
   - Clear purpose

2. Version Control
   - Commit migrations separately
   - Include rollback scripts
   - Document dependencies

3. Testing
   - Test with representative data
   - Verify all constraints
   - Check application compatibility

4. Documentation
   - Clear descriptions
   - List affected tables
   - Note any prerequisites
   - Include verification steps
```

This completes the migration-management.md file with all essential information for managing our Supabase migrations. Would you like to proceed with creating our first migration using this system?