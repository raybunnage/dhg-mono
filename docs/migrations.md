# Database Migrations Guide

## Initial Setup

```bash
# From root directory
pnpm supabase init

# Login to Supabase
pnpm supabase login
```

## Creating New Migrations

```bash
# From root directory
pnpm supabase migration new your_migration_name
```

## Troubleshooting Migrations

```bash
# 1. Check current migration state
pnpm supabase migration list --debug

# 2. If migrations are out of sync, repair them:
pnpm supabase migration repair --status applied [migration_timestamp]

# 3. If multiple migrations need repair, do them in order:
pnpm supabase migration repair --status applied [first_migration]
pnpm supabase migration repair --status applied [second_migration]

# 4. After repairs, try pushing again
pnpm supabase db push
```

## Troubleshooting Duplicate Migrations

```bash
# 1. Check current migration state
pnpm supabase migration list --debug

# 2. If you see duplicate migrations:
# - Remove duplicate files
rm supabase/migrations/[duplicate_timestamp]_*.sql

# 3. Create fresh migrations if needed
pnpm supabase migration new your_migration_name

# 4. Repair migration state
pnpm supabase migration repair --status reverted [timestamp]

# 5. Push migrations
pnpm supabase db push
```

## Applying Migrations

```bash
# From root directory
pnpm supabase link --project-ref your-project-ref

# When prompted for database password:
# 1. Go to Supabase Dashboard > Project Settings > Database
# 2. Find "Database Password" section
# 3. Copy the password and paste it in the terminal
# Note: The password input will be hidden (no visual feedback)
# This is normal - just paste or type and press Enter

# Push migrations
pnpm supabase db push

# If you get a duplicate key error:
# 1. Repair the remote migration state
pnpm supabase migration repair --status reverted 20240308000000

# 2. Pull current database state
pnpm supabase db pull

# 3. Then push your migration
pnpm supabase db push

# When asked about which migrations to push:
# - Review the listed migration files
# - Start with the creation (.sql) file first
# - Type Y to confirm the push

# Check status
pnpm supabase migration list