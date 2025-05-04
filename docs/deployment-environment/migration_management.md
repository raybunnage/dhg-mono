# Migration Management System

## Overview
This document describes our process for managing database migrations using pnpm scripts and direct Postgres commands.

## Migration Scripts

| pnpm Command | Internal Script | Description |
|--------------|-----------------|-------------|
| `db:migrate` | `./scripts/supabase/run-migration.sh up` | Apply new migrations |
| `db:rollback` | `./scripts/supabase/run-migration.sh down` | Rollback last migration |
| `db:list` | `./scripts/supabase/run-migration.sh list` | List migrations |
| `db:repair` | `./scripts/supabase/run-migration.sh repair` | Repair migration state |
| `db:check` | `./scripts/supabase/run-migration.sh check` | Check migration status |
| `db:psql` | `./scripts/supabase/start-psql.sh` | Start psql session |

## Migration Process

### 1. Create Migration
```bash
pnpm supabase migration new your_migration_name
```

### 2. Apply Migration
```bash
pnpm db:migrate
```

### 3. Verify Migration
```bash
pnpm db:check
```

## Direct Postgres Commands

Our scripts now use direct Postgres commands instead of Supabase CLI for:
- Migration application
- Schema verification
- Data manipulation

The only Supabase CLI usage is for:
- Creating new migration files (`pnpm supabase migration new`)
- Listing migrations (`pnpm supabase migration list`)
- Some repair operations (`pnpm supabase migration repair`)
- Initial project setup (`pnpm supabase init`)

## Migration Discovery

1. Scripts scan `supabase/migrations/` for `.sql` files
2. Compare with `schema_migrations` table
3. Apply migrations in timestamp order
4. Record applied migrations in `schema_migrations`

## Troubleshooting

### Duplicate Migrations
```bash
# Check state
pnpm db:check

# Repair specific version
pnpm db:repair 20250213011132
```

### Connection Issues
```bash
# Push individual migration
pnpm db:migrate supabase/migrations/20250213011132_migration.sql
```

## RLS Policy Management

Check policies:
```bash
pnpm db:psql "SELECT * FROM pg_policies WHERE tablename = 'your_table';"
```

## Safety Guidelines

1. Always backup before migration
2. Test migrations in isolation
3. Keep rollback scripts ready
4. Verify after each step
5. Document all changes

## Verification Queries

### Check Table Structure
```sql
SELECT * FROM information_schema.tables 
WHERE table_name = 'your_table';
```

### Check Migration State
```sql
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;
```

## Managing Schema Migrations Table

### Reset Migration State
Sometimes you need to reset the migration state table. Use with caution:

```bash
# Connect to database
pnpm db:psql

# View current migrations
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;

# Backup current state (optional but recommended)
CREATE TABLE supabase_migrations.schema_migrations_backup AS 
SELECT * FROM supabase_migrations.schema_migrations;

# Clear migration state
TRUNCATE supabase_migrations.schema_migrations;

# Verify table is empty
SELECT COUNT(*) FROM supabase_migrations.schema_migrations;

# Exit psql
\q

# Then repair migration state
pnpm db:repair
```

### Reset Google Sources Data
⚠️ WARNING: This will delete ALL data in sources_google and related tables

```sql
-- Start transaction
BEGIN;

-- First truncate dependent tables due to foreign key constraints
TRUNCATE TABLE expert_documents CASCADE;

-- Then truncate sources_google
TRUNCATE TABLE sources_google CASCADE;

-- Verify tables are empty
SELECT COUNT(*) FROM expert_documents;
SELECT COUNT(*) FROM sources_google;

COMMIT;
```

⚠️ DANGER: The CASCADE option will automatically truncate any table that has a foreign key 
pointing to sources_google. Make sure you understand which tables will be affected before running this command.

### Restore from Backup
If needed, you can restore the backup:

```sql
-- First verify backup exists
SELECT COUNT(*) FROM supabase_migrations.schema_migrations_backup;

-- Then restore
INSERT INTO supabase_migrations.schema_migrations 
SELECT * FROM supabase_migrations.schema_migrations_backup;
```

⚠️ Warning: Truncating the schema_migrations table should be done with caution 
and only when you're sure about the current state of your database schema.