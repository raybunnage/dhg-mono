# Migration Management System

## Overview
This document describes our process for managing Supabase database migrations.

## Directory Structure
```
/supabase/
├── templates/          # Migration templates
│   └── migration.sql   # Standard migration template
└── migrations/         # All migrations in chronological order
    ├── 20250210015657_create_sources_google.sql        # Applied migration
    ├── 20240321000001_add_last_synced_column.sql      # New migration
```

## Migration Template

```sql
-- Migration: {description}
-- Created at: {timestamp}
-- Status: [planned|applied]
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
- Create migration file in `/supabase/migrations` directory
- Use timestamp prefix: YYYYMMDDHHMMSS (e.g., 20240321000001)
- Include clear description, status, and affected tables in comments

### 2. Testing
```bash
# 1. Create backup
pnpm supabase db dump -f backup_pre_migration.sql

# 2. Apply migration
pnpm db:migrate

# 3. Verify changes
# Run verification queries

# 4. Test rollback if needed
pnpm db:rollback
```

### 3. Application
- Update migration status comment from "planned" to "applied"
- Document in change log
- Keep rollback commands in migration comment block

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
pnpm db:migrate

# Check migration status
pnpm db:list

# Rollback last migration
pnpm db:rollback
```

## Verification Queries

### Check Table Structure
```