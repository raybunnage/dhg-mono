# Supabase Database Manager

The Supabase Database Manager is a sophisticated interface for managing your Supabase database. It provides tools for exploring, modifying, and maintaining your database schema, as well as tracking migrations and generating TypeScript types.

## Overview

The Supabase Manager offers a comprehensive view of your database with the following features:

- **Dashboard Overview:** Quick stats on tables, objects, and migrations
- **Table Explorer:** View table structure, columns, constraints, and data
- **Object Browser:** Browse and search all database objects (tables, views, functions, etc.)
- **SQL Editor:** Run custom SQL queries and view results
- **Migration Management:** Create, track, and manage database migrations
- **Schema & Types:** Export database schema and generate TypeScript types

## Getting Started

### Prerequisites

- Ensure your Supabase connection is correctly set up
- You need appropriate permissions to execute SQL and view schema information

### Installation

The Supabase Manager is included in the project. To use it:

1. Navigate to the Supabase Manager in your application
2. The initial dashboard will load with an overview of your database

### Database Functions

The manager relies on several custom PostgreSQL functions:

- `get_table_summaries()`: Returns statistics for all tables
- `find_schema_inconsistencies()`: Identifies potential schema issues
- `export_full_schema()`: Exports the complete database schema as SQL
- `run_sql(p_sql text)`: Executes SQL with proper permissions

## Features

### Dashboard Overview

The dashboard provides a high-level summary of your database:

- Total number of tables, views, and functions
- Migration history summary
- Quick action buttons for common tasks
- Alerts for any detected schema inconsistencies

### Tables & Views

Explore the structure of your database tables:

- View a list of all tables with row counts and sizes
- See table status and potential issues
- Inspect column definitions, data types, and constraints
- Generate CREATE TABLE statements
- Analyze table statistics

### Database Objects

Browse and search all database objects:

- Filter by object type (table, view, function, trigger, etc.)
- Search by name or definition
- View object definitions
- Generate templates for creating new objects

### SQL Editor

Execute SQL queries and view results:

- Syntax highlighting for SQL
- Run queries and see results in tabular format
- View execution errors with detailed messages
- Quick templates for common SQL operations

### Migrations

Manage database migrations:

- View migration history with execution timestamps
- Create new migrations with SQL content
- Use templates for common migration patterns
- Track migration success/failure

### Schema & Types

Export database schema and generate TypeScript types:

- Export full schema as SQL
- Generate documentation from schema
- Create or update types.ts from database schema
- Track type generation history

## Working with Migrations

Instead of traditional up/down migrations, the Supabase Manager uses a more flexible approach:

1. **Create migrations:** Write SQL in the editor or use templates
2. **Save migrations:** Store in migration_logs table with timestamps
3. **Review history:** See all migrations in the history view
4. **Track execution:** Each migration logs success/failure status

This approach makes it easier to:
- Experiment with SQL before committing
- Keep track of all changes, including those made directly in SQL Editor
- Maintain a record of what SQL actually worked
- Generate schema snapshots at any point

Example workflow:
1. Draft SQL in the SQL Editor tab
2. Test and refine until it works correctly
3. Save as a migration with descriptive name
4. Export updated schema for documentation

## Best Practices

### Maintaining Your Database

- Regularly check the Overview tab for database issues
- Address schema inconsistencies promptly
- Create indexes for foreign keys and frequently queried columns
- Document table structure with comments

### Migration Management

- Use descriptive migration names (e.g., `add_status_column_to_users`)
- Include both the action and the affected table in migration names
- Test migrations in SQL Editor before saving
- Export schema after significant changes

### SQL Safety

- Use SELECT queries to explore before making changes
- Wrap UPDATE/DELETE in transactions
- Test with LIMIT before running large operations
- Always back up important data before schema changes

## Troubleshooting

### Common Issues

- **Permission errors:** Ensure your Supabase role has appropriate permissions
- **SQL errors:** Check syntax and table/column names
- **Slow queries:** Use EXPLAIN ANALYZE to diagnose performance issues
- **Migration failures:** Review SQL for syntax errors or constraints violations

### Getting Help

If you encounter issues:

1. Check the SQL error message for specific problems
2. Review Supabase logs for more detailed information
3. Consult the Supabase documentation for SQL syntax
4. Test complex operations in smaller steps

## Reference

### SQL Templates

The manager includes templates for common operations:

- Creating tables with proper constraints
- Adding columns to existing tables
- Creating indexes and foreign keys
- Defining views and functions

### PostgreSQL Functions

Custom functions used by the manager:

- `get_table_columns_plus(p_table_name text)`: Details about table columns
- `get_table_summaries()`: Statistics for all tables
- `find_schema_inconsistencies()`: Schema design issues
- `run_sql(p_sql text)`: Execute SQL with results

### PostgreSQL Snippets

Useful snippets available in the SQL Editor:

- List all tables: `SELECT * FROM information_schema.tables WHERE table_schema = 'public'`
- Table sizes: `SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name::text)) AS size FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(table_name::text) DESC`
- Foreign keys: `SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name WHERE constraint_type = 'FOREIGN KEY'`