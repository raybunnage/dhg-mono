# Continuous Improvement Scenario: Modify Database Tables

## Scenario ID: `modify-database-tables`
**Category**: Database
**Complexity**: High
**Estimated Time**: 45-60 minutes
**Last Updated**: 2025-06-15

## Overview
This scenario covers the safe process for adding new database tables or modifying existing ones, including migrations, types, RLS policies, and testing.

## Prerequisites
- Understanding of PostgreSQL and Supabase
- Knowledge of Row Level Security (RLS)
- Familiarity with database naming conventions (see CLAUDE.md)

## When to Use
- Adding new tables to the database
- Modifying existing table structure
- Adding or updating RLS policies
- Creating database views or functions

## Step-by-Step Process

### 1. Check Naming Conventions
**Query**: Check existing prefixes before creating tables
```sql
-- View approved prefixes
SELECT * FROM sys_table_prefixes WHERE active = true ORDER BY prefix;

-- Check if your prefix exists
SELECT * FROM sys_table_prefixes WHERE prefix = 'your_prefix_';
```

**Important**: 
- If prefix doesn't exist, add it first or use existing one
- Views MUST end with `_view` suffix
- Follow patterns in `sys_table_definitions`

### 2. Design Table Schema
**Considerations**:
- Primary keys (usually UUID)
- Foreign key relationships
- Indexes for performance
- Audit fields (created_at, updated_at)
- Soft delete pattern (deleted_at)

### 3. Create Migration File
**Location**: `supabase/migrations/{timestamp}_{description}.sql`

**Template**:
```sql
-- Migration: {description}
-- Purpose: {why this change is needed}

-- Create new table
CREATE TABLE IF NOT EXISTS {prefix_table_name} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Core fields
    name TEXT NOT NULL,
    description TEXT,
    
    -- Foreign keys
    parent_id UUID REFERENCES parent_table(id) ON DELETE CASCADE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT uk_{table_name}_name UNIQUE(name)
);

-- Create indexes
CREATE INDEX idx_{table_name}_parent_id ON {prefix_table_name}(parent_id);
CREATE INDEX idx_{table_name}_created_at ON {prefix_table_name}(created_at);
CREATE INDEX idx_{table_name}_deleted_at ON {prefix_table_name}(deleted_at) WHERE deleted_at IS NULL;

-- Add RLS policies
ALTER TABLE {prefix_table_name} ENABLE ROW LEVEL SECURITY;

-- Public read (adjust as needed)
CREATE POLICY "{table_name}_select_policy" ON {prefix_table_name}
    FOR SELECT USING (true);

-- Authenticated write
CREATE POLICY "{table_name}_insert_policy" ON {prefix_table_name}
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "{table_name}_update_policy" ON {prefix_table_name}
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Add table metadata
INSERT INTO sys_table_definitions (
    table_schema, 
    table_name, 
    description, 
    purpose, 
    created_date
) VALUES (
    'public',
    '{prefix_table_name}',
    'Brief description',
    'Purpose/use case',
    CURRENT_DATE
);

-- Add helpful comments
COMMENT ON TABLE {prefix_table_name} IS 'Detailed description of table purpose';
COMMENT ON COLUMN {prefix_table_name}.id IS 'Unique identifier';
```

### 4. Create Down Migration
**File**: Same file, add rollback section
```sql
-- Down migration (for rollback)
-- DROP TABLE IF EXISTS {prefix_table_name} CASCADE;
-- DELETE FROM sys_table_definitions WHERE table_name = '{prefix_table_name}';
```

### 5. Test Migration Locally
```bash
# Validate syntax
./scripts/cli-pipeline/database/database-cli.sh migration validate migrations/{your_file}.sql

# Test in safe environment
./scripts/cli-pipeline/database/database-cli.sh migration test migrations/{your_file}.sql
```

### 6. Update TypeScript Types
```bash
# After migration succeeds, regenerate types
pnpm supabase gen types typescript --project-id {project-id} > supabase/types.ts
```

### 7. Create Type Guards (if needed)
**File**: `packages/shared/types/guards/{table-name}.guards.ts`
```typescript
import { Tables } from '@/supabase/types';

export function isValidTableRow(data: unknown): data is Tables<'{table_name}'> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    // Add other required field checks
  );
}
```

### 8. Update Service Layer
If table is used by services:
1. Update relevant service to use new table
2. Add methods for CRUD operations
3. Update tests

### 9. Create Integration Tests
**File**: `packages/shared/services/{service}/__tests__/{table-name}.integration.test.ts`
```typescript
describe('{table_name} integration', () => {
  it('should create records with proper RLS', async () => {
    // Test authenticated access
  });
  
  it('should enforce RLS policies', async () => {
    // Test policy enforcement
  });
});
```

### 10. Document Changes
**File**: `docs/database/{table-name}.md`
Document:
- Table purpose and structure
- RLS policies
- Usage examples
- Related tables/views

## Validation Checklist
- [ ] Table follows naming conventions (correct prefix)
- [ ] Primary key is UUID with default
- [ ] Foreign keys have proper constraints
- [ ] Indexes created for query performance
- [ ] RLS policies are appropriate
- [ ] Migration has down/rollback section
- [ ] Types regenerated after migration
- [ ] Integration tests pass
- [ ] Documentation updated
- [ ] Entry added to sys_table_definitions

## Common Issues
- **Naming conflicts**: Always check sys_table_migrations for renamed tables
- **RLS too restrictive**: Test policies with different user roles
- **Missing indexes**: Monitor query performance, add indexes as needed
- **Type generation fails**: Ensure migration syntax is valid PostgreSQL

## Database Standards Reference
Key standards to follow:
- Use `gen_random_uuid()` for UUID generation
- Include audit fields (created_at, updated_at)
- Name constraints descriptively
- Add table and column comments
- Test migrations before production

## Related Scenarios
- `add-new-shared-service` - If table needs service layer
- `add-new-tests` - For comprehensive testing
- `add-new-app-page` - For UI to manage table data

## Automation Notes
When automated, this scenario should:
- Validate naming conventions
- Generate migration from template
- Auto-create standard indexes
- Generate basic RLS policies
- Update type definitions
- Create placeholder tests