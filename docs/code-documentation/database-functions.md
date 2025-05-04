# Supabase Database Functions Reference

This document provides detailed information about the PostgreSQL functions that power the Supabase Manager interface. These functions are installed as part of the database migration and provide the backend functionality for the management UI.

## Core Functions

### `get_table_summaries()`

Returns statistics and status information for all tables in the public schema.

**Returns**: Table with the following columns:
- `table_name` (text): Name of the table
- `row_count` (bigint): Number of rows in the table
- `size` (text): Formatted size of the table (e.g., "1.2 MB")
- `last_vacuum` (timestamp with time zone): Last vacuum or autovacuum time
- `missing_indexes` (int): Number of recommended indexes missing
- `has_primary_key` (boolean): Whether the table has a primary key
- `column_count` (int): Number of columns in the table
- `status` (text): Overall status ('good', 'warning', or 'danger')

**Example**:
```sql
SELECT * FROM get_table_summaries();
```

### `find_schema_inconsistencies()`

Identifies potential issues in the database schema design.

**Returns**: Table with the following columns:
- `table_name` (text): Name of the table with an issue
- `issue_type` (text): Type of issue (e.g., 'missing_primary_key')
- `description` (text): Human-readable description of the issue
- `suggested_fix` (text): SQL statement to fix the issue
- `severity` (text): Issue severity ('high', 'medium', or 'low')

**Example**:
```sql
SELECT * FROM find_schema_inconsistencies() WHERE severity = 'high';
```

### `export_full_schema()`

Exports the complete database schema as SQL.

**Returns**: JSON object with a 'schema' field containing SQL statements

**Example**:
```sql
SELECT schema FROM export_full_schema();
```

### `run_sql(p_sql text)`

Executes arbitrary SQL statements with proper permissions and returns results or error messages.

**Parameters**:
- `p_sql` (text): SQL statement to execute

**Returns**: 
- For SELECT statements: JSON array of results
- For other statements: JSON object with status message

**Security**: SECURITY DEFINER function that runs with elevated permissions

**Example**:
```sql
SELECT * FROM run_sql('SELECT * FROM users LIMIT 5');
```

## Table Information Functions

### `get_table_columns_plus(p_table_name text)`

Returns detailed information about columns in a table, including constraints.

**Parameters**:
- `p_table_name` (text): Name of the table to analyze

**Returns**: Table with the following columns:
- `ordinal_position` (number): Column position in table
- `column_name` (text): Name of the column
- `data_type` (text): PostgreSQL data type
- `is_nullable` (text): 'YES' or 'NO'
- `column_default` (text): Default value if any
- `is_unique` (text): 'YES' if column has a unique constraint
- `foreign_key` (text): Foreign key reference if any
- `trigger_name` (text): Related trigger if any
- `check_constraint` (text): Check constraint if any

**Example**:
```sql
SELECT * FROM get_table_columns_plus('users');
```

### `get_all_database_objects()`

Returns information about all database objects in the public schema.

**Returns**: Table with the following columns:
- `name` (text): Object name
- `type` (text): Object type (table, view, function, etc.)
- `definition` (text): SQL definition
- `schema` (text): Schema name
- `notes` (text): Additional notes if available

**Example**:
```sql
SELECT * FROM get_all_database_objects() WHERE type = 'view';
```

## Utility Functions

### `get_foreign_keys(schema_name text)`

Returns information about foreign keys in the specified schema.

**Parameters**:
- `schema_name` (text): Name of the schema to analyze

**Returns**: JSON object with foreign key information

**Example**:
```sql
SELECT * FROM get_foreign_keys('public');
```

### `get_table_metadata(p_target_table text)`

Returns comprehensive metadata about a table.

**Parameters**:
- `p_target_table` (text): Name of the table to analyze

**Returns**: JSON object with table metadata including columns, constraints, indexes, etc.

**Example**:
```sql
SELECT * FROM get_table_metadata('users');
```

### `table_exists(p_schema_name text, p_table_name text)`

Checks if a table exists in the specified schema.

**Parameters**:
- `p_schema_name` (text): Schema name
- `p_table_name` (text): Table name

**Returns**: Boolean indicating whether the table exists

**Example**:
```sql
SELECT * FROM table_exists('public', 'users');
```

## Migration System

### Migration Logs Table

The migration system uses the `migration_logs` table to track database changes:

**Columns**:
- `id` (serial): Primary key
- `name` (text): Migration name (typically timestamp_description)
- `executed_at` (timestamptz): When the migration was executed
- `success` (boolean): Whether the migration succeeded
- `error_message` (text): Error message if migration failed
- `sql_content` (text): SQL code that was executed

**Example Query**:
```sql
SELECT name, executed_at, success 
FROM migration_logs 
ORDER BY executed_at DESC 
LIMIT 10;
```

## Security Considerations

### Function Security

Most database functions are created with the `SECURITY DEFINER` attribute, which means they execute with the permissions of the function creator rather than the calling user. This allows the functions to perform operations that might otherwise be restricted by Row Level Security (RLS) policies.

### SQL Execution

The `run_sql` function has additional security checks:
- SELECT statements are allowed more freely
- Non-SELECT statements are restricted based on permissions
- Error information is returned safely

### Permission Recommendations

For production environments, consider:
1. Creating a separate role for the Supabase Manager
2. Granting only necessary permissions to this role
3. Using RLS policies to restrict access to sensitive data
4. Logging all operations performed through the manager

## Installation and Updates

### Installing Functions

The functions are installed via migration:

```sql
-- Run the migration SQL file
\i path/to/20250301000000_create_database_manager_functions.sql
```

### Updating Functions

To update the functions:

1. Create a new migration with updated function definitions
2. Run the migration
3. Verify the functions work as expected

### Removing Functions

If needed, you can remove the functions:

```sql
-- Drop functions
DROP FUNCTION IF EXISTS get_table_summaries();
DROP FUNCTION IF EXISTS find_schema_inconsistencies();
DROP FUNCTION IF EXISTS export_full_schema();
DROP FUNCTION IF EXISTS run_sql(text);

-- Drop the migration logs table (optional)
DROP TABLE IF EXISTS migration_logs;
```

## Troubleshooting

### Common Errors

1. **Permission Denied**
   
   Possible causes:
   - Function was not created with SECURITY DEFINER
   - Calling user lacks required permissions
   - RLS policy preventing access

   Solution: Check function definition and permissions

2. **Function Not Found**
   
   Possible causes:
   - Migration failed to create the function
   - Function was dropped
   - Function is in a different schema

   Solution: Verify the migration was applied correctly

3. **Query Timeout**
   
   Possible causes:
   - Function is performing a heavy operation
   - Database is under load
   - Poorly optimized query inside the function

   Solution: Review function implementation and add limits

### Debugging

To debug function behavior:

```sql
-- Enable query logging
SET log_statement = 'all';

-- Run the function
SELECT * FROM get_table_summaries();

-- Check the PostgreSQL logs for the actual queries
-- being executed by the function
```