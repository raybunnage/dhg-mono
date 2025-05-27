# Database Prefix Migration - Phase 1 Implementation Details

## Overview

This document provides detailed implementation guidance for Phase 1 of the database table prefix migration strategy. Phase 1 establishes the critical infrastructure needed to safely rename all database tables with minimal risk and zero downtime.

## Phase 1 Components

### 1. Migration Infrastructure

#### A. Table Renaming Utility Script

**Location**: `scripts/cli-pipeline/database/rename-table.ts`

**Purpose**: Automate the table renaming process with safety checks and compatibility layer creation.

**Key Functions**:
- Validate table existence before renaming
- Check migration tracking to prevent duplicate migrations
- Execute atomic rename operation with transaction support
- Automatically create compatibility views
- Handle dependent objects (constraints, indexes, triggers)
- Record migration metadata for tracking and rollback

**Script Workflow**:
```typescript
// Pseudo-code for main logic
async function renameTable(oldName: string, newName: string) {
  // 1. Pre-flight checks
  - Verify table exists
  - Check if already migrated
  - Validate new name doesn't conflict
  
  // 2. Analyze dependencies
  - Find foreign keys referencing this table
  - List indexes, triggers, functions using the table
  - Identify RLS policies
  
  // 3. Execute migration (in transaction)
  - Rename the table
  - Create compatibility view
  - Update dependent objects
  - Record in sys_table_migrations
  
  // 4. Post-migration validation
  - Test view functionality
  - Verify application queries still work
  - Log success/issues
}
```

#### B. Rollback Script

**Location**: `scripts/cli-pipeline/database/rollback-table-rename.ts`

**Purpose**: Safely reverse any table rename operation.

**Key Functions**:
- Look up original name from migration tracking
- Remove compatibility view
- Restore original table name
- Revert any dependent object changes
- Update migration tracking status

#### C. Migration Tracking Table

**SQL Definition**:
```sql
CREATE TABLE sys_table_migrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  old_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  migrated_at TIMESTAMP DEFAULT NOW(),
  migrated_by TEXT DEFAULT current_user,
  rollback_at TIMESTAMP,
  rollback_by TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'rolled_back', 'pending')),
  compatibility_view_created BOOLEAN DEFAULT true,
  dependencies JSONB, -- Store info about FKs, indexes, etc.
  notes TEXT,
  UNIQUE(old_name, status) -- Prevent duplicate active migrations
);

-- Index for quick lookups
CREATE INDEX idx_sys_table_migrations_status ON sys_table_migrations(status);
CREATE INDEX idx_sys_table_migrations_new_name ON sys_table_migrations(new_name);
```

### 2. Type Generation Updates

#### A. Type Alias System

**Location**: `supabase/types/table-aliases.ts`

**Purpose**: Maintain backward compatibility for TypeScript types during migration.

**Implementation**:
```typescript
// Auto-generated file - DO NOT EDIT MANUALLY
import { Database } from './database.types';

// Table name aliases for migration compatibility
export type TableAliases = {
  // Document Management
  document_types: Database['public']['Tables']['doc_types'];
  document_type_aliases: Database['public']['Tables']['doc_type_aliases'];
  document_concepts: Database['public']['Tables']['doc_concepts'];
  documentation_files: Database['public']['Tables']['doc_files'];
  
  // Expert System
  experts: Database['public']['Tables']['expert_profiles'];
  expert_documents: Database['public']['Tables']['expert_documents'];
  
  // ... continue for all tables
};

// Helper type for accessing tables by either name
export type Tables = Database['public']['Tables'] & TableAliases;
```

#### B. Type Generation Process Modification

**Update**: `scripts/cli-pipeline/database/generate-types.ts`

**New Workflow**:
1. Run standard Supabase type generation
2. Query `sys_table_migrations` for active migrations
3. Generate `table-aliases.ts` based on migration data
4. Update package.json script to include alias generation

**Example Script Addition**:
```typescript
async function generateTableAliases() {
  // Query active migrations
  const { data: migrations } = await supabase
    .from('sys_table_migrations')
    .select('old_name, new_name')
    .eq('status', 'active');
    
  // Generate TypeScript aliases
  const aliases = migrations.map(m => 
    `${m.old_name}: Database['public']['Tables']['${m.new_name}'];`
  ).join('\n  ');
  
  // Write to file
  await fs.writeFile(
    'supabase/types/table-aliases.ts',
    generateAliasFileContent(aliases)
  );
}
```

### 3. View-Based Compatibility Layer

#### A. View Creation Strategy

**Automatic View Creation**:
```sql
-- Template for view creation (executed by migration script)
CREATE OR REPLACE VIEW [old_table_name] AS 
SELECT * FROM [new_table_name];

-- For tables with write operations, add rules or triggers
CREATE OR REPLACE RULE [old_table_name]_insert AS
ON INSERT TO [old_table_name]
DO INSTEAD INSERT INTO [new_table_name] VALUES (NEW.*);

CREATE OR REPLACE RULE [old_table_name]_update AS
ON UPDATE TO [old_table_name]
DO INSTEAD UPDATE [new_table_name] SET ... WHERE ...;

CREATE OR REPLACE RULE [old_table_name]_delete AS
ON DELETE TO [old_table_name]
DO INSTEAD DELETE FROM [new_table_name] WHERE ...;
```

#### B. View Management

**Tracking Views**:
- Views are tracked in `sys_table_migrations` table
- Each migration records if a view was created
- Cleanup script uses this data to remove views

**Performance Considerations**:
- Simple views (SELECT *) have negligible performance impact
- PostgreSQL optimizer "sees through" simple views
- Monitor query plans to ensure optimization

#### C. Testing Compatibility

**Test Script**: `scripts/cli-pipeline/database/test-view-compatibility.ts`

**Tests to Run**:
1. SELECT queries through views
2. INSERT/UPDATE/DELETE operations (if supported)
3. JOIN operations with other tables
4. Performance comparison (direct vs view)
5. Application integration tests

## Implementation Workflow

### Step 1: Create Infrastructure Scripts

1. **Set up the database CLI structure**:
   ```bash
   cd scripts/cli-pipeline/database
   npm init -y
   npm install commander@11.0.0 @supabase/supabase-js
   ```

2. **Create the main CLI entry point** (`cli.ts`):
   ```typescript
   import { Command } from 'commander';
   import { renameTable } from './rename-table';
   import { rollbackRename } from './rollback-table-rename';
   
   const program = new Command();
   
   program
     .command('rename-table <oldName> <newName>')
     .description('Rename a table with compatibility view')
     .action(renameTable);
     
   program
     .command('rollback-rename <tableName>')
     .description('Rollback a table rename')
     .action(rollbackRename);
     
   program.parse();
   ```

3. **Integrate into shell script** (`database-cli.sh`):
   ```bash
   # Add new commands
   rename-table)
     track_command "rename-table" "$@"
     npx ts-node cli.ts rename-table "$@"
     ;;
   rollback-rename)
     track_command "rollback-rename" "$@"
     npx ts-node cli.ts rollback-rename "$@"
     ;;
   ```

### Step 2: Create Migration Tracking Table

1. **Create migration file**: `supabase/migrations/[timestamp]_create_table_migration_tracking.sql`
2. **Apply migration**: `npm run supabase:db:push`
3. **Verify table creation**: Check via Supabase dashboard or CLI

### Step 3: Implement Core Functions

1. **Dependency Analysis Function**:
   ```typescript
   async function analyzeDependencies(tableName: string) {
     // Query foreign keys
     // Query indexes
     // Query triggers
     // Query functions
     // Query RLS policies
     return {
       foreignKeys: [...],
       indexes: [...],
       triggers: [...],
       functions: [...],
       policies: [...]
     };
   }
   ```

2. **Migration Execution Function**:
   ```typescript
   async function executeMigration(oldName: string, newName: string) {
     const client = await supabase.rpc('begin_transaction');
     try {
       // Rename table
       // Create view
       // Update dependencies
       // Record migration
       await client.rpc('commit_transaction');
     } catch (error) {
       await client.rpc('rollback_transaction');
       throw error;
     }
   }
   ```

### Step 4: Test Infrastructure

1. **Create test tables**:
   ```sql
   CREATE TABLE test_migration_source (
     id UUID PRIMARY KEY,
     data TEXT
   );
   ```

2. **Run test migration**:
   ```bash
   ./database-cli.sh rename-table test_migration_source test_migration_target
   ```

3. **Verify**:
   - Table renamed correctly
   - View created and functional
   - Migration tracked in sys_table_migrations
   - Types updated appropriately

## Risk Mitigation

### 1. Transaction Safety
- All migrations run in transactions
- Automatic rollback on any error
- No partial migrations possible

### 2. Validation Checks
- Pre-migration validation prevents issues
- Post-migration tests ensure functionality
- Dependency analysis prevents broken references

### 3. Monitoring
- Log all migration operations
- Track performance impact
- Alert on any query failures

### 4. Rollback Capability
- Every migration can be reversed
- Rollback script is tested with each migration
- Original state fully restored

## Success Criteria

Phase 1 is complete when:

1. **Scripts Created**:
   - ✓ rename-table command works
   - ✓ rollback-rename command works
   - ✓ Integration with database-cli.sh

2. **Tracking Functional**:
   - ✓ sys_table_migrations table exists
   - ✓ Migrations properly recorded
   - ✓ Status tracking accurate

3. **Type System Updated**:
   - ✓ Alias generation automated
   - ✓ Both old and new names work in TypeScript
   - ✓ No type errors in existing code

4. **Views Working**:
   - ✓ Compatibility views created automatically
   - ✓ Existing queries work unchanged
   - ✓ Performance impact measured and acceptable

5. **Testing Complete**:
   - ✓ Test migrations successful
   - ✓ Rollback tested and working
   - ✓ Application continues functioning

## Next Steps

After Phase 1 completion:
1. Begin Phase 2 with low-impact system tables
2. Monitor the infrastructure during first real migrations
3. Refine scripts based on real-world usage
4. Document any additional considerations discovered

## Troubleshooting Guide

### Common Issues and Solutions

1. **Foreign Key Conflicts**:
   - Issue: Cannot rename table with incoming foreign keys
   - Solution: Script handles FK updates automatically

2. **Type Generation Fails**:
   - Issue: Alias file not generated
   - Solution: Check sys_table_migrations connectivity

3. **View Performance**:
   - Issue: Queries slower through views
   - Solution: Analyze query plans, consider materialized views

4. **Rollback Fails**:
   - Issue: Cannot rollback due to new dependencies
   - Solution: Script analyzes and handles new dependencies

## Conclusion

Phase 1 establishes a robust, safe foundation for the entire table renaming project. The infrastructure handles complexity automatically while maintaining zero downtime and full reversibility. With these tools in place, the actual migration phases become straightforward executions of well-tested processes.