# Database Migration Best Practices

## Quick Reference - Which Command to Use

### ✅ Use `migration apply` (Recommended)
```bash
./scripts/cli-pipeline/database/database-cli.sh migration apply <file.sql>
```

**When to use:**
- ✅ Most migrations (tables, indexes, views, functions)
- ✅ Complex SQL with DO blocks and dollar quotes
- ✅ Single-file migrations
- ✅ When you want simple, reliable execution

**Features:**
- Executes entire file as one transaction
- No complex parsing - just runs the SQL
- Clear error messages
- Tracks successful migrations
- Works with any valid SQL

### ⚠️ Use `migration run-staged` (Complex Cases)
```bash
./scripts/cli-pipeline/database/database-cli.sh migration run-staged <file.sql>
```

**When to use:**
- When you need to execute sections separately
- When you want confirmation between sections
- For very large migrations that need monitoring
- When debugging failed migrations section by section

**Limitations:**
- May fail with complex SQL syntax
- Parsing can struggle with DO blocks
- More complicated to use

### 🚀 Direct Supabase Dashboard (Fallback)
```
https://supabase.com/dashboard/project/jdksnfkupzywjdfefkyj/sql
```

**When to use:**
- When CLI commands fail
- For emergency fixes
- For viewing/debugging existing data
- When you need immediate results

## Common Migration Patterns

### 1. Creating Tables
```sql
-- Always use IF NOT EXISTS for safety
CREATE TABLE IF NOT EXISTS my_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Always add RLS
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Always add basic policies
CREATE POLICY "read_all" ON my_table FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_all" ON my_table FOR INSERT TO authenticated WITH CHECK (true);
```

### 2. Adding Indexes
```sql
-- Use IF NOT EXISTS to make idempotent
CREATE INDEX IF NOT EXISTS idx_my_table_name ON my_table(name);
```

### 3. Creating Functions
```sql
-- Use CREATE OR REPLACE for functions
CREATE OR REPLACE FUNCTION my_function()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 'Hello World';
END;
$$;
```

## Migration Workflow

### 1. Test First
```bash
# Test connection and preview
./scripts/cli-pipeline/database/database-cli.sh migration apply --test migration.sql
```

### 2. Apply Migration
```bash
# Apply with verbose output
./scripts/cli-pipeline/database/database-cli.sh migration apply --verbose migration.sql
```

### 3. Regenerate Types
```bash
# If tables/views changed
pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts
```

## Troubleshooting

### execute_sql Function Missing
If you get "execute_sql function not available", run this first:
```bash
./scripts/cli-pipeline/database/database-cli.sh migration apply supabase/migrations/20250301000003_add_execute_sql_function.sql
```

### Permission Errors
- Check RLS policies
- Ensure authenticated role has permissions
- Try running in Supabase dashboard as postgres user

### Migration Already Applied
- Migrations should be idempotent (use IF NOT EXISTS)
- Check .applied-migrations.json for history
- Consider writing a rollback migration

### Complex SQL Fails
- Break into multiple files
- Use Supabase dashboard for very complex operations
- Simplify DO blocks where possible

## Best Practices

1. **Always use IF NOT EXISTS** for CREATE statements
2. **Always enable RLS** on new tables
3. **Always add basic policies** (at least read access)
4. **Keep migrations focused** - one feature per file
5. **Name migrations clearly** - include date and description
6. **Test locally first** if possible
7. **Document complex migrations** with comments
8. **Make migrations idempotent** - safe to run multiple times

## Example: Complete Migration
```sql
-- Migration: 20250615_add_user_preferences.sql
-- Purpose: Add user preferences table for storing app settings

-- Create table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    notifications_enabled BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own preferences
CREATE POLICY "users_manage_own_preferences" ON user_preferences
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add to table registry
INSERT INTO sys_table_definitions (table_name, description, purpose)
VALUES ('user_preferences', 'User preferences and settings', 'Store per-user app configuration')
ON CONFLICT (table_name) DO NOTHING;
```

Apply with:
```bash
./scripts/cli-pipeline/database/database-cli.sh migration apply supabase/migrations/20250615_add_user_preferences.sql
```