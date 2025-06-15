# Scenario: Add Database Table

## Critical Evaluation Gates ⚠️ COMPLETE FIRST

### Gate 1: Necessity Check (30 seconds max)
- [ ] **Duplication Search**: 
  ```bash
  # Copy/paste these exact commands:
  psql -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
  grep -i "table_name\|similar_concept" supabase/migrations/
  find supabase/migrations/ -name "*.sql" | xargs grep -l "CREATE TABLE.*{concept}"
  ```
- [ ] **What did you find?**: ____________________
- [ ] **Usage Justification**: Is this data truly different from existing tables or could existing be enhanced?
- [ ] **Complexity Check**: Will this add significant schema complexity or maintenance burden?

### Gate 2: Simplicity Assessment (2 minutes max)
- [ ] **Schema Enhancement**: Could existing table be enhanced with new columns instead?
  - If yes: **STOP HERE** - enhance existing rather than create new table
- [ ] **View Alternative**: Could this be implemented as a view over existing tables?
- [ ] **Right-Sized Solution**: Is a dedicated table the simplest approach vs other storage options?

### Gate 3: Quick Code Review (5 minutes max)
```bash
# Required searches (run these commands):
psql -c "SELECT * FROM sys_table_prefixes WHERE active = true ORDER BY prefix;"
grep -r "table_prefix\|CREATE TABLE" supabase/migrations/
rg -i "{data_concept}" supabase/types.ts
```

**Document your findings**:
- Similar tables/concepts found: ____________________
- Available prefixes that fit: ____________________
- Naming conflicts or schema overlaps: ____________________

### Gate 4: Go/No-Go Decision
- [ ] **Technical**: All searches completed, no major schema conflicts identified
- [ ] **Architectural**: Fits our naming conventions and RLS policy patterns
- [ ] **Value**: Clearly needed data that can't be handled by existing tables
- [ ] **Timing**: Right priority vs other schema improvements needed

**Decision**: APPROVE / REJECT / NEEDS_REVIEW

**If REJECT or NEEDS_REVIEW**: Document why and explore alternatives before proceeding.

---

## Implementation Steps (Only if APPROVED above)

### Step 1: Choose Table Prefix and Name
**Human Action**: Select appropriate prefix from `sys_table_prefixes` and create table name
**Claude Code Translation**: 
```typescript
// Query sys_table_prefixes for available/appropriate prefixes
// Check table name doesn't exist in information_schema
// Verify naming follows convention: {prefix}_{descriptive_name}
// Document prefix choice and reasoning
```
**Verification**: Table name is unique and follows naming conventions
**Checkpoint**: 
```bash
git add docs/table-naming-decision.md && git commit -m "decide: table name and prefix for {table-name}

Table: {prefix}_{table_name}
Prefix: {prefix} (from sys_table_prefixes)
Purpose: {brief description}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 2: Create Migration File
**Human Action**: Create new migration file with table creation SQL
**Claude Code Translation**:
```typescript
// Create migration file: supabase/migrations/{timestamp}_{description}.sql
// Add table creation with:
// - UUID primary key with gen_random_uuid() default
// - Appropriate column types and constraints
// - Foreign key relationships with ON DELETE CASCADE/RESTRICT
// - Audit fields: created_at, updated_at, deleted_at (if soft delete needed)
// - Proper indexes for query performance
```
**Verification**: Migration file has valid SQL syntax
**Checkpoint**:
```bash
git add supabase/migrations/{timestamp}_create_{table_name}.sql && git commit -m "migration: create {table_name} table

Columns: {list key columns}
Relationships: {list foreign keys}
Indexes: {list indexes}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 3: Add RLS Policies
**Human Action**: Add Row Level Security policies to migration
**Claude Code Translation**:
```typescript
// Add to migration file:
// ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
// CREATE POLICY for SELECT (usually public read)
// CREATE POLICY for INSERT/UPDATE/DELETE (usually authenticated users)
// Consider user-specific policies if data is user-owned
// Follow existing RLS patterns from similar tables
```
**Verification**: RLS policies follow security best practices
**Checkpoint**:
```bash
git add supabase/migrations/{timestamp}_create_{table_name}.sql && git commit -m "security: add RLS policies to {table_name}

Policies: SELECT (public), INSERT/UPDATE/DELETE (authenticated)
Security model: {describe access patterns}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 4: Add Table Metadata
**Human Action**: Add entry to `sys_table_definitions` in migration
**Claude Code Translation**:
```typescript
// Add to migration file:
// INSERT INTO sys_table_definitions (
//   table_schema, table_name, description, purpose, created_date
// ) VALUES (
//   'public', '{table_name}', 'Brief description', 'Use case', CURRENT_DATE
// );
// Add helpful COMMENT ON TABLE and COMMENT ON COLUMN statements
```
**Verification**: Table metadata is complete and helpful
**Checkpoint**:
```bash
git add supabase/migrations/{timestamp}_create_{table_name}.sql && git commit -m "metadata: add {table_name} to table definitions

Description: {brief description}
Purpose: {use case}
Comments: added to table and key columns

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 5: Test Migration Locally
**Human Action**: Run migration in safe environment and verify it works
**Claude Code Translation**:
```typescript
// Validate migration syntax
// Run migration against local database
// Verify table creation, constraints, and policies
// Test basic INSERT/SELECT operations
// Confirm RLS policies work as expected
```
**Verification**: Migration runs successfully and table works as designed
**Checkpoint**:
```bash
git add migration-test-results.md && git commit -m "test: verify {table_name} migration works

✅ Migration runs successfully
✅ Table created with correct structure
✅ RLS policies working
✅ Basic operations tested

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 6: Generate TypeScript Types
**Human Action**: Regenerate TypeScript types after successful migration
**Claude Code Translation**:
```typescript
// Run: pnpm supabase gen types typescript --project-id {project-id} > supabase/types.ts
// Verify new table types appear in generated file
// Check that relationships and constraints are properly typed
// Ensure no breaking changes to existing types
```
**Verification**: New table types available and existing types unchanged
**Checkpoint**:
```bash
git add supabase/types.ts && git commit -m "types: regenerate after {table_name} creation

Added types for {table_name}
Relationships: properly typed foreign keys
No breaking changes to existing types

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 7: Create Basic Service Methods (if needed)
**Human Action**: Add table operations to relevant shared service or create new one
**Claude Code Translation**:
```typescript
// If table relates to existing service, add CRUD methods
// If new domain, consider creating new service
// Add proper TypeScript types using generated table types
// Include error handling and validation
// Follow existing service patterns
```
**Verification**: Service methods work correctly with new table
**Checkpoint**:
```bash
git add packages/shared/services/{service}/ && git commit -m "service: add {table_name} operations

Methods: {list CRUD operations}
Types: using generated table types
Validation: {describe validation rules}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

## Post-Implementation Validation
- [ ] Migration runs: Test migration in safe environment
- [ ] Table created: Verify structure matches design
- [ ] RLS working: Test policies with different user roles
- [ ] Types generated: New table types available in TypeScript
- [ ] Basic operations: INSERT/SELECT/UPDATE work correctly
- [ ] Relationships: Foreign keys and constraints work
- [ ] Indexes: Query performance is acceptable
- [ ] Metadata: Table appears in sys_table_definitions

## 30-Day Retrospective Schedule
```bash
# Add to calendar for 30 days from now:
echo "$(date -d '+30 days'): Review {table_name} table - is it being used? Was it worth it?"
```

**Retrospective Questions**:
- Is the table actually being used by applications?
- Did it solve the intended data storage problem?
- Are the RLS policies working well in practice?
- Is the table structure holding up or does it need modifications?
- Would we design it differently knowing what we know now?
- Should this be continued/optimized/consolidated/deprecated?

## Common Issues & Solutions

**Migration Fails**:
- Check SQL syntax carefully
- Verify foreign key references exist
- Ensure table/column names follow PostgreSQL naming rules
- Test migration in isolated environment first

**RLS Policies Too Restrictive**:
- Test policies with actual user scenarios
- Use `SELECT current_user, auth.uid()` to debug policy conditions
- Check that auth.users table has necessary data

**Type Generation Fails**:
- Ensure migration completed successfully
- Check that Supabase project ID is correct
- Verify network connectivity to Supabase
- Try regenerating types manually

**Performance Issues**:
- Add indexes for frequently queried columns
- Consider composite indexes for multi-column queries
- Monitor query performance with EXPLAIN ANALYZE
- Review table design for normalization issues

**Foreign Key Constraint Violations**:
- Verify referenced tables and columns exist
- Check that referenced columns have appropriate indexes
- Ensure ON DELETE actions are correct (CASCADE vs RESTRICT)
- Test constraint behavior with sample data