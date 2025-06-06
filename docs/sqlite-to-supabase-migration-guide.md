# SQLite to Supabase Migration Guide

## Issue: pgloader Connection Errors

When migrating from SQLite to Supabase using pgloader on macOS, you may encounter SSL/TLS connection errors:

```
KABOOM\!
DB-CONNECTION-ERROR: Failed to connect to pgsql at "db.jdksnfkupzywjdfefkyj.supabase.co" (port 5432) as user "postgres": 30 fell through ECASE expression. Wanted one of (2 10).
```

## Solution: Use Supabase Pooler Connection

Instead of the direct database connection, use the Supabase pooler connection which handles SSL better:

1. **Create a migration configuration file** (`sqlite-migration-minimal.load`):

```sql
LOAD DATABASE
     FROM sqlite:///absolute/path/to/your/database.db
     INTO postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres

WITH include drop, create tables, create indexes, reset sequences,
     workers = 2, concurrency = 1,
     batch rows = 1000

SET postgresql.synchronous_commit to 'off',
    work_mem to '12MB',
    maintenance_work_mem to '128MB'

CAST type datetime to timestamptz drop default drop not null,
     type date to timestamptz drop default drop not null,
     type integer to bigint drop typemod,
     type num to numeric drop typemod

;
```

2. **Key changes:**
   - Use pooler URL: `aws-0-us-west-1.pooler.supabase.com:6543` instead of `db.[PROJECT-REF].supabase.co:5432`
   - Use absolute path for SQLite file with three slashes: `sqlite:///absolute/path/`
   - Add `type num to numeric` casting for SQLite\'s num type
   - Use smaller batch sizes and fewer workers to avoid timeouts

3. **Run the migration:**
   ```bash
   pgloader sqlite-migration-minimal.load
   ```

## Connection String Format

- **Direct connection (may fail with SSL errors):**
  ```
  postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
  ```

- **Pooler connection (recommended):**
  ```
  postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
  ```

## Troubleshooting

1. **"type \'num\' does not exist"**: Add the `type num to numeric` cast directive
2. **"Could not open sqlite3 database"**: Use absolute paths with three slashes
3. **Connection timeouts**: Reduce workers and batch size
4. **SSL errors on macOS**: Always use the pooler connection

## Alternative: Using psql

If pgloader continues to fail, you can export SQLite to SQL and import using psql:

```bash
# Export SQLite to SQL
sqlite3 your-database.db .dump > export.sql

# Import to Supabase
psql "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres" < export.sql
```
EOF < /dev/null