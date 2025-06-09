# Database Audit Command Plan

## New Commands to Implement

### 1. **table-audit** - Comprehensive table evaluation
```bash
./database-cli.sh table-audit [table_name]
```
- Check naming conventions (snake_case, proper prefixes)
- Verify standard fields (id, created_at, updated_at)
- Check for missing indexes on foreign keys
- Validate data types consistency
- Check for proper constraints
- Identify missing RLS policies
- Check trigger consistency

### 2. **function-audit** - Analyze database functions
```bash
./database-cli.sh function-audit
```
- List all functions with usage counts
- Identify unused functions (not called anywhere)
- Check for deprecated patterns
- Validate function naming conventions
- Find duplicate/similar functions
- Generate safe removal scripts

### 3. **consistency-check** - Cross-table consistency
```bash
./database-cli.sh consistency-check
```
- Check field naming patterns across tables
- Identify inconsistent date/timestamp fields
- Find mismatched foreign key data types
- Check for orphaned records
- Validate enum consistency
- Check UUID vs text id fields

### 4. **foreign-key-audit** - FK relationship analysis
```bash
./database-cli.sh foreign-key-audit
```
- List all foreign key relationships
- Check for missing ON DELETE actions
- Identify missing foreign key constraints
- Validate referential integrity
- Check for circular dependencies
- Generate constraint addition scripts

### 5. **trigger-audit** - Trigger and event analysis
```bash
./database-cli.sh trigger-audit
```
- List all triggers by table
- Check for missing updated_at triggers
- Identify duplicate triggers
- Validate trigger naming conventions
- Check trigger dependencies

### 6. **best-practices** - Overall best practices check
```bash
./database-cli.sh best-practices [table_name]
```
- Composite score for table health
- Check against all best practices
- Generate improvement recommendations
- Priority-based fix suggestions

### 7. **backup-full** - Complete database backup
```bash
./database-cli.sh backup-full
```
- Schema + data backup
- Function definitions
- Policies and permissions
- Store with timestamp
- Compression support

### 8. **cleanup-preview** - Preview cleanup operations
```bash
./database-cli.sh cleanup-preview
```
- Show unused functions
- Show empty tables
- Show deprecated objects
- Generate cleanup SQL
- Safety verification

### 9. **field-standardize** - Field standardization report
```bash
./database-cli.sh field-standardize
```
- Report on non-standard field names
- Suggest standardized names
- Generate migration scripts
- Check for consistency

## Implementation Priority
1. table-audit (core functionality)
2. function-audit (address unused functions)
3. consistency-check (find inconsistencies)
4. backup-full (safety first)
5. cleanup-preview (safe removal)
6. Others as needed

## Output Formats
- Terminal tables (default)
- JSON for automation
- SQL scripts for fixes
- Markdown reports for documentation