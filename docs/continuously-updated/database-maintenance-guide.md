# Database Maintenance and Improvement Guide

Last Updated: 2025-01-06

## Overview

This guide provides comprehensive documentation for maintaining and improving the database using the enhanced database CLI pipeline. The new audit commands help ensure database consistency, performance, and adherence to best practices.

## Quick Start

```bash
# Run a comprehensive health check
./scripts/cli-pipeline/database/database-cli.sh table-audit

# Check for unused functions
./scripts/cli-pipeline/database/database-cli.sh function-audit --generate-sql

# Check database consistency
./scripts/cli-pipeline/database/database-cli.sh consistency-check --generate-fixes
```

## New Database Audit Commands

### 1. Table Audit (`table-audit`)

Performs comprehensive evaluation of tables against best practices.

**Usage:**
```bash
# Audit all tables
./database-cli.sh table-audit

# Audit specific table
./database-cli.sh table-audit expert_profiles
```

**What it checks:**
- ✅ Naming conventions (proper prefixes, snake_case)
- ✅ Standard fields (id, created_at, updated_at)
- ✅ Primary key existence and type
- ✅ Foreign key constraints and indexes
- ✅ RLS policies
- ✅ Triggers (especially updated_at)
- ✅ Data type consistency

**Health Score:**
- 100: Perfect - no issues found
- 80-99: Good - minor improvements suggested
- 60-79: Fair - several issues to address
- Below 60: Needs attention - critical issues present

### 2. Function Audit (`function-audit`)

Analyzes database functions to identify unused ones and suggest cleanup.

**Usage:**
```bash
# Basic analysis
./database-cli.sh function-audit

# Generate removal SQL for unused functions
./database-cli.sh function-audit --generate-sql
```

**Function Categories:**
- Getter functions (`get_*`)
- Update functions (`update_*`)
- Create functions (`create_*`)
- Delete functions (`delete_*`)
- View functions (`*_view`)
- Trigger functions (`*_trigger`)
- Backup functions (`*backup*`)
- Migration functions (`*migration*`)
- RPC functions (`*_rpc`)
- Utility functions

**Usage Detection:**
- Used in views
- Used in other functions
- Used in triggers
- Can be safely removed (no references found)

### 3. Consistency Check (`consistency-check`)

Checks cross-table consistency for naming, data types, and constraints.

**Usage:**
```bash
# Basic check
./database-cli.sh consistency-check

# Generate fix SQL
./database-cli.sh consistency-check --generate-fixes
```

**What it checks:**
- 🔍 Field naming patterns across tables
- 🔍 Data type consistency for same-named fields
- 🔍 Standard field requirements
- 🔍 Foreign key type matching
- 🔍 Enum field consistency
- 🔍 Timestamp field conventions

## Database Best Practices

### Table Naming Conventions

**Required Prefixes:**
- `auth_` - Authentication & user management
- `ai_` - AI & prompt management
- `google_` - Google Drive integration
- `learn_` - Learning platform features
- `media_` - Media & presentations
- `doc_` - Document management
- `expert_` - Expert system
- `email_` - Email system
- `command_` - Command & analytics
- `filter_` - User filtering & preferences
- `batch_` - Batch operations
- `scripts_` - Script management
- `sys_` - System & infrastructure
- `dev_` - Development & task management
- `registry_` - Registry tables
- `service_` - Service dependencies
- `worktree_` - Git worktree management
- `import_` - Data import tables

### Standard Fields

Every table should have:
```sql
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### Foreign Key Best Practices

```sql
-- Always name constraints descriptively
ALTER TABLE google_expert_documents 
ADD CONSTRAINT fk_expert_documents_expert_profile 
FOREIGN KEY (expert_id) REFERENCES expert_profiles(id) ON DELETE CASCADE;

-- Always add indexes on foreign key columns
CREATE INDEX idx_google_expert_documents_expert_id ON google_expert_documents(expert_id);
```

### RLS Policy Patterns

```sql
-- Public read, authenticated write
CREATE POLICY "Enable read access for all users" ON table_name
    FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON table_name
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

## Maintenance Workflow

### 1. Regular Health Checks (Weekly)

```bash
# Overall table health
./database-cli.sh table-audit > reports/table-audit-$(date +%Y%m%d).txt

# Function usage analysis
./database-cli.sh function-audit > reports/function-audit-$(date +%Y%m%d).txt

# Consistency check
./database-cli.sh consistency-check > reports/consistency-$(date +%Y%m%d).txt
```

### 2. Before Major Changes

```bash
# Create full backup
./database-cli.sh create-backup

# Run all audits
./database-cli.sh table-audit
./database-cli.sh function-audit
./database-cli.sh consistency-check
```

### 3. Cleanup Process

```bash
# 1. Identify unused functions
./database-cli.sh function-audit --generate-sql

# 2. Review generated SQL
cat scripts/cli-pipeline/database/generated/remove_unused_functions_*.sql

# 3. Test in transaction
./database-cli.sh migration test remove_unused_functions_*.sql

# 4. Apply changes
./database-cli.sh migration run-staged remove_unused_functions_*.sql
```

### 4. Fixing Consistency Issues

```bash
# 1. Generate fixes
./database-cli.sh consistency-check --generate-fixes

# 2. Review and modify as needed
vim scripts/cli-pipeline/database/generated/consistency_fixes_*.sql

# 3. Apply fixes
./database-cli.sh migration run-staged consistency_fixes_*.sql
```

## Migration Safety

### Before Applying Any Changes

1. **Always backup first:**
   ```bash
   ./database-cli.sh create-backup
   ```

2. **Test migrations:**
   ```bash
   ./database-cli.sh migration test your-migration.sql
   ```

3. **Use staged execution:**
   ```bash
   ./database-cli.sh migration run-staged your-migration.sql
   ```

### Migration File Structure

```sql
-- Section: Create audit functions
CREATE OR REPLACE FUNCTION ...

-- Section: Update table structure
ALTER TABLE ...

-- Section: Add indexes
CREATE INDEX ...

-- Section: Update sys_table_definitions
INSERT INTO sys_table_definitions ...
```

## Troubleshooting Common Issues

### Missing Primary Keys
```sql
ALTER TABLE table_name ADD COLUMN id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
```

### Missing Timestamps
```sql
ALTER TABLE table_name 
ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add update trigger
CREATE TRIGGER update_table_name_updated_at 
BEFORE UPDATE ON table_name 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Foreign Key Type Mismatches
```sql
-- Change column type to match referenced column
ALTER TABLE source_table 
ALTER COLUMN foreign_key_column TYPE UUID;
```

### Missing Indexes on Foreign Keys
```sql
CREATE INDEX idx_table_foreign_key ON table_name(foreign_key_column);
```

## Monitoring and Reporting

### Generate Weekly Reports
```bash
#!/bin/bash
# weekly-db-report.sh
REPORT_DIR="reports/$(date +%Y-%m-%d)"
mkdir -p "$REPORT_DIR"

./database-cli.sh table-audit > "$REPORT_DIR/table-audit.txt"
./database-cli.sh function-audit > "$REPORT_DIR/function-audit.txt"
./database-cli.sh consistency-check > "$REPORT_DIR/consistency.txt"
./database-cli.sh table-records --all > "$REPORT_DIR/table-records.txt"

echo "Reports generated in $REPORT_DIR"
```

### Track Improvements Over Time
- Keep audit reports to track score improvements
- Document major cleanup efforts
- Monitor function count reduction
- Track consistency issue resolution

## Integration with dhg-admin-code

The database tab in dhg-admin-code provides a visual interface for:
- Viewing table structures
- Running queries
- Monitoring performance

The CLI tools complement this by providing:
- Automated auditing
- Bulk operations
- Migration management
- Scriptable maintenance

## Next Steps

1. **Apply the audit functions migration:**
   ```bash
   ./database-cli.sh migration run-staged supabase/migrations/20250608_database_audit_functions.sql
   ```

2. **Update command registry:**
   ```bash
   ./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh populate-command-registry
   ```

3. **Run initial audits to establish baseline**

4. **Schedule regular maintenance checks**

5. **Document any custom cleanup procedures specific to your database**

## Additional Resources

- [Database Table Naming Guide](../technical-specs/database-table-naming-guide.md)
- [Database Architecture Evaluation](../technical-specs/database-architecture-evaluation.md)
- [Supabase Connection Guide](../solution-guides/SUPABASE_CONNECTION_GUIDE.md)

---

*This document is continuously updated as new maintenance procedures are developed.*