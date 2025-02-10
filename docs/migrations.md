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

# If you get errors about relations not existing, push only the creation file:
pnpm supabase db push supabase/migrations/[timestamp]_create_sources_google.sql

# When asked about which migrations to push:
# - Review the listed migration files
# - Start with the creation (.sql) file first
# - Type Y to confirm the push

# Check status
pnpm supabase migration list
```