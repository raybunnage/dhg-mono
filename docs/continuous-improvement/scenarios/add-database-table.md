# Scenario: Add Database Table

**Purpose**: Add a new table to the database with proper standards  
**Time Estimate**: 20-30 minutes  
**Complexity**: Medium

## Pre-flight Checks (3 minutes)

```sql
-- 1. Check if table already exists
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE '%your_concept%';

-- 2. Check approved prefixes
SELECT * FROM sys_table_prefixes WHERE active = true;

-- 3. Check for similar tables
SELECT table_name, description FROM sys_table_definitions 
WHERE description ILIKE '%your concept%';
```

## Steps

### 1. Choose Correct Prefix (2 minutes)

Based on `sys_table_prefixes`:
- `sys_` - System/infrastructure tables
- `auth_` - Authentication/user management  
- `doc_` - Documentation tracking
- `media_` - Media files and content
- `dev_` - Development tracking
- `google_` - Google integration

**Your table**: `{prefix}_your_table_name`

### 2. Create Migration File (5 minutes)

```bash
# Create migration with timestamp
touch supabase/migrations/$(date +%Y%m%d_%H%M%S)_create_{prefix}_your_table.sql
```

Basic migration template:
```sql
-- Create {prefix}_your_table_name
-- Purpose: {one-line description}

CREATE TABLE IF NOT EXISTS {prefix}_your_table_name (
    -- Primary key (always UUID)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Your columns
    name TEXT NOT NULL,
    description TEXT,
    
    -- Standard audit columns
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Soft delete if needed
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT uk_{prefix}_your_table_name UNIQUE (name)
);

-- Indexes
CREATE INDEX idx_{prefix}_your_table_created 
  ON {prefix}_your_table_name(created_at DESC);

-- RLS (start with public read)
ALTER TABLE {prefix}_your_table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON {prefix}_your_table_name
    FOR SELECT USING (true);

-- Document in sys_table_definitions
INSERT INTO sys_table_definitions (
    table_schema, 
    table_name, 
    description, 
    purpose, 
    created_date
) VALUES (
    'public',
    '{prefix}_your_table_name',
    'Brief description',
    'What this table is used for',
    CURRENT_DATE
);

-- Add helpful comment
COMMENT ON TABLE {prefix}_your_table_name IS 'Your table description';
```

### 3. Test Migration Locally (5 minutes)

```bash
# Validate syntax
./scripts/cli-pipeline/database/database-cli.sh migration validate supabase/migrations/your_migration.sql

# Dry run
./scripts/cli-pipeline/database/database-cli.sh migration dry-run supabase/migrations/your_migration.sql
```

### 4. Apply Migration (3 minutes)

```bash
# Apply to database
./scripts/cli-pipeline/database/database-cli.sh migration run-staged supabase/migrations/your_migration.sql

# Or use direct approach if needed
ts-node scripts/cli-pipeline/database/commands/run-migration.ts supabase/migrations/your_migration.sql
```

### 5. Update Types (2 minutes)

```bash
# Regenerate TypeScript types
pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts
```

### 6. Quick Verification (3 minutes)

```typescript
// Test query
import { SupabaseClientService } from './packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();
const { data, error } = await supabase
  .from('{prefix}_your_table_name')
  .select('*')
  .limit(1);

console.log('Table accessible:', !error);
```

## Verification Checklist
- [ ] Correct prefix used from sys_table_prefixes
- [ ] UUID primary key
- [ ] Standard audit columns (created_at, updated_at)
- [ ] RLS enabled
- [ ] Documented in sys_table_definitions
- [ ] Types regenerated
- [ ] Basic query works

## Git Checkpoint
```bash
git add -A && git commit -m "add: {prefix}_your_table_name database table

- Purpose: {one-line description}
- Columns: {list main columns}
- Indexes: {list indexes}
- RLS: Public read (or describe policy)

Migration applied successfully
Types regenerated

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

## Rollback if Needed
```sql
-- Drop table (careful!)
DROP TABLE IF EXISTS {prefix}_your_table_name CASCADE;

-- Remove from definitions
DELETE FROM sys_table_definitions 
WHERE table_name = '{prefix}_your_table_name';
```

## Common Patterns

### Foreign Keys
```sql
-- Reference another table
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
document_id UUID REFERENCES doc_files(id) ON DELETE SET NULL,
```

### Check Constraints
```sql
-- Enum-like constraint
status TEXT CHECK (status IN ('draft', 'published', 'archived')),
-- Range constraint  
priority INTEGER CHECK (priority BETWEEN 1 AND 10),
```

### Unique Constraints
```sql
-- Single column
CONSTRAINT uk_email UNIQUE (email),
-- Multiple columns
CONSTRAINT uk_user_document UNIQUE (user_id, document_id),
```

## Design Tips
1. **Start minimal** - Add columns as needed
2. **Use constraints** - Let database enforce rules
3. **Index wisely** - Only columns used in WHERE/ORDER BY
4. **Document everything** - Future you will thank you
5. **Consider views** - For complex queries, create a view

## When NOT to Create a Table
- Temporary data → Use application memory
- Key-value pairs → Consider JSONB column
- Files → Use storage, reference in database
- Logs → Use logging service
- Cache → Use Redis or in-memory

## Next Steps
- Create service/repository for table access
- Add to relevant CLI commands
- Document in application code
- Monitor usage - unused tables = technical debt