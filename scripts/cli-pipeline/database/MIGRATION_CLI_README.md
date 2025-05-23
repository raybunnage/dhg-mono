# Database Migration CLI System

A comprehensive database migration system designed to solve the common problem of SQL validation and testing before execution in Supabase UI.

## Core Problems Solved

1. **SQL Syntax Validation** - Validate SQL before running in Supabase UI
2. **Incremental Testing** - Test migration components separately  
3. **Schema Verification** - Verify schema after migration
4. **Migration Recording** - Record what actually worked
5. **Staged Execution** - Execute with confirmation between sections

## Migration File Format

Instead of traditional up/down files, use **section-based SQL files**:

```sql
-- MIGRATION: migration_name
-- VERSION: 20250522000000  
-- DESCRIPTION: Description of changes
-- AUTHOR: Your Name (optional)
-- DEPENDENCIES: other_migration_name (optional)

-- SECTION: extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SECTION: tables
CREATE TABLE IF NOT EXISTS public.my_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SECTION: indexes
CREATE INDEX IF NOT EXISTS idx_my_table_name ON public.my_table(name);

-- SECTION: functions
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void AS $$
BEGIN
  -- Function logic here
END;
$$ LANGUAGE plpgsql;

-- SECTION: rls
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own records"
  ON public.my_table
  FOR SELECT
  USING (auth.uid() = user_id);

-- SECTION: grants
GRANT SELECT ON public.my_table TO authenticated;
```

## Available Commands

### 1. Validation

```bash
# Validate migration file
./database-cli.sh migration validate migration.sql

# Validate with warnings
./database-cli.sh migration validate --warnings migration.sql

# Validate specific section
./database-cli.sh migration validate --section tables migration.sql

# Verbose validation
./database-cli.sh migration validate --verbose migration.sql
```

**Benefits:**
- Catches syntax errors before execution
- Validates section dependencies
- Checks for security issues
- Provides best practice recommendations

### 2. Dry Run

```bash
# Show execution plan
./database-cli.sh migration dry-run migration.sql

# Show with SQL code
./database-cli.sh migration dry-run --show-sql migration.sql

# Export to JSON for review
./database-cli.sh migration dry-run --output plan.json migration.sql

# Focus on specific section
./database-cli.sh migration dry-run --section tables migration.sql
```

**Benefits:**
- Preview what will be executed
- See execution order and dependencies
- Export results for team review
- Estimate execution time and impact

### 3. Section Testing

```bash
# Test all sections against database
./database-cli.sh migration test migration.sql

# Test only table sections
./database-cli.sh migration test --section tables migration.sql

# Dry run test (show what would be executed)
./database-cli.sh migration test --dry-run migration.sql

# Verbose testing with details
./database-cli.sh migration test --verbose migration.sql
```

**Benefits:**
- Test individual components separately
- Catch errors before full migration
- Verify database permissions
- Test with actual database connection

### 4. Staged Execution

```bash
# Interactive execution with confirmations
./database-cli.sh migration run-staged migration.sql

# Auto-confirm all sections
./database-cli.sh migration run-staged --auto-confirm migration.sql

# Continue on errors with logging
./database-cli.sh migration run-staged --continue-on-error --log migration.log migration.sql

# Execute only specific section type
./database-cli.sh migration run-staged --section functions migration.sql
```

**Benefits:**
- Execute with confirmation between sections
- Stop on errors or continue based on preference
- Detailed logging and error reporting
- Rollback capability if issues occur

## Section Types

The system recognizes these section types (executed in this order):

1. **extensions** - Database extensions
2. **tables** - Table creation and modification
3. **indexes** - Index creation
4. **functions** - Function and stored procedure definitions
5. **triggers** - Trigger definitions
6. **views** - View definitions
7. **rls** - Row Level Security policies
8. **grants** - Permission grants
9. **custom** - Custom SQL that doesn't fit other categories

## Recommended Workflow

### 1. Development Phase
```bash
# 1. Validate your migration file
./database-cli.sh migration validate --warnings my-migration.sql

# 2. Preview execution plan
./database-cli.sh migration dry-run --show-sql my-migration.sql

# 3. Test individual sections
./database-cli.sh migration test --section tables my-migration.sql
./database-cli.sh migration test --section functions my-migration.sql
```

### 2. Staging/Testing Phase
```bash
# 4. Test complete migration against staging
./database-cli.sh migration test my-migration.sql

# 5. Execute with confirmations
./database-cli.sh migration run-staged my-migration.sql
```

### 3. Production Phase
```bash
# 6. Final validation
./database-cli.sh migration validate my-migration.sql

# 7. Execute with logging
./database-cli.sh migration run-staged --log production.log my-migration.sql
```

## Error Handling and Recovery

### Common Validation Errors

- **Syntax errors** - Invalid SQL syntax
- **Dependency errors** - Missing required sections or objects
- **Security issues** - Potential SQL injection or unsafe patterns
- **Best practice violations** - Missing IF NOT EXISTS, no primary keys

### Common Execution Errors

- **Permission denied** - Check database permissions
- **Object already exists** - Use IF NOT EXISTS clauses
- **Invalid column references** - Verify table and column names
- **RLS policy conflicts** - Check existing policies

### Recovery Options

1. **Fix and re-run** - Correct errors and execute again
2. **Section-by-section** - Run individual sections that failed
3. **Continue on error** - Use `--continue-on-error` flag
4. **Manual cleanup** - Fix issues in Supabase UI then record final state

## Integration with Existing Files

To test with your existing SQL migration files:

### Option 1: Add Section Headers
Add section comments to your existing files:

```sql
-- MIGRATION: your_existing_migration
-- VERSION: 20250522120000
-- DESCRIPTION: Existing migration converted to new format

-- SECTION: tables
-- (your existing table SQL here)

-- SECTION: functions  
-- (your existing function SQL here)
```

### Option 2: Test Without Sections
The system will treat files without sections as one "custom" section:

```bash
# Test existing file as-is
./database-cli.sh migration validate your-file.sql
./database-cli.sh migration dry-run your-file.sql
```

## Files Created

- `types/migration.ts` - TypeScript type definitions
- `services/migration-parser.ts` - SQL parsing and validation logic
- `commands/migration/validate.ts` - Validation command
- `commands/migration/dry-run.ts` - Dry run command  
- `commands/migration/test-sections.ts` - Testing command
- `commands/migration/run-staged.ts` - Staged execution command
- `sample-migration.sql` - Example migration file

## Dependencies

The migration system requires:

1. **SupabaseClientService** - Database connection (already available)
2. **execute_sql function** - For SQL execution (may need to be created)
3. **TypeScript/Node.js** - Runtime environment

## Next Steps

1. **Test with your existing SQL files**
2. **Create execute_sql function in Supabase if needed**
3. **Convert existing migrations to section-based format**
4. **Integrate into your development workflow**

The system is designed to work with your existing files and provide immediate value for validation and testing, even without converting to the new format.