# Supabase RPC Examples

This directory contains examples for using Supabase RPC functions, with a focus on the powerful `execute_sql` function that allows executing arbitrary SQL queries through the Supabase API.

## Files

- [`supabase-rpc-example.ts`](./supabase-rpc-example.ts) - Comprehensive examples of various RPC function usage patterns
- [`execute-sql-example.ts`](./execute-sql-example.ts) - Focused examples for the `execute_sql` RPC function

## The `execute_sql` RPC Function

The `execute_sql` RPC function is a custom Supabase function that allows running arbitrary SQL queries through the API. This is extremely useful when:

1. You need to perform complex queries that can't be easily expressed using Supabase's filter API
2. You want to use SQL features like window functions, CTEs, or complex JOINs
3. You need to run dynamic queries with parameters like IN clauses with variable values

### Implementation

The function is defined in SQL as:

```sql
CREATE OR REPLACE FUNCTION public.execute_sql(sql_query text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  query_type TEXT;
  affected_rows INTEGER;
BEGIN
  -- Determine the type of query (SELECT, INSERT, UPDATE, DELETE, etc.)
  query_type := UPPER(SUBSTRING(TRIM(sql_query) FROM 1 FOR 6));
  
  -- For safety, only allow certain types of queries
  IF query_type = 'SELECT' THEN
    -- Execute the SELECT query and return the results as JSON
    EXECUTE 'SELECT JSONB_AGG(t) FROM (' || sql_query || ') t' INTO result;
    RETURN COALESCE(result, '[]'::JSONB);
  ELSIF query_type IN ('INSERT', 'UPDATE', 'DELETE') THEN
    -- For data modification queries, return the number of affected rows
    EXECUTE sql_query;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN JSONB_BUILD_OBJECT('rowCount', affected_rows, 'message', query_type || ' completed successfully');
  ELSE
    -- For other queries (like CREATE, ALTER, etc.), just execute and return success message
    EXECUTE sql_query;
    RETURN JSONB_BUILD_OBJECT('message', 'Query executed successfully');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'SQL Error: %', SQLERRM;
END;
$$;
```

## Usage Example

Here's a simple example of using the `execute_sql` RPC function:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runQuery() {
  // SQL query with an IN clause
  const categories = ['AI', 'Development', 'Integration', 'Operations'];
  const categoryList = categories.map(cat => `'${cat.replace(/'/g, "''")}'`).join(', ');
  const sql = `SELECT id, document_type, category FROM document_types WHERE category IN (${categoryList})`;
  
  // Execute the query using the execute_sql RPC function
  const { data, error } = await supabase.rpc('execute_sql', { sql });
  
  if (error) {
    console.error('Error executing query:', error);
    return;
  }
  
  console.log(`Found ${data.length} document types`);
  console.log(data);
}
```

## Running the Examples

1. Make sure your environment variables are set:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Run an example with ts-node:
   ```
   npx ts-node packages/cli/src/examples/execute-sql-example.ts
   ```

## Security Considerations

- The `execute_sql` function uses `SECURITY DEFINER`, meaning it runs with the privileges of the function creator.
- To prevent SQL injection, always properly escape user-provided values before using them in queries.
- In production systems, consider limiting the types of queries that can be executed.