# Supabase Connection Guide

This document outlines the correct way to connect to Supabase in the DHG-Improve-Experts application.

## The Correct Import Pattern

The proper way to import and use Supabase in this application is:

```typescript
import { supabase } from '@/integrations/supabase/client';
```

This import references the client created in `/src/integrations/supabase/client.ts`, which is correctly configured with the appropriate credentials and settings.

## Typical Supabase Usage Pattern

After importing, a typical Supabase query looks like this:

```typescript
async function loadData() {
  try {
    // Start loading state if needed
    setLoading(true);
    
    // Make the Supabase query
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .order('column_name');

    // Handle any errors
    if (error) {
      console.error('Error fetching data:', error);
      // Optionally show a user-friendly error message
      toast.error('Failed to load data');
      return;
    }
    
    // Use the data
    setItems(data || []);
  } catch (error) {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
    toast.error('An unexpected error occurred');
  } finally {
    // Clean up loading state
    setLoading(false);
  }
}
```

## Common Anti-Patterns to Avoid

1. **❌ DO NOT** import from `@/lib/supabase/client`
   ```typescript
   // WRONG - this path is now archived
   import { supabase } from '@/lib/supabase/client';
   ```

2. **❌ DO NOT** create new Supabase clients in components or services
   ```typescript
   // WRONG - don't create a new client instance
   const supabase = createClient(url, key);
   ```

3. **❌ DO NOT** forget to handle Supabase errors
   ```typescript
   // WRONG - missing error handling
   const { data } = await supabase.from('table').select('*');
   setItems(data);
   ```

## Troubleshooting Supabase Connection Issues

If you encounter a Supabase connection issue:

1. **Check the import path**: Make sure you're importing from `@/integrations/supabase/client`

2. **Check the console for errors**: Look for specific error messages that might indicate the problem

3. **Verify table existence**: Ensure the table you're querying actually exists in the database

4. **Check permissions**: Ensure the authenticated user has permissions to access the table

5. **Network issues**: Verify there are no network connectivity problems

## Working Examples

Here are working examples from the codebase:

### Example 1: ExpertList.tsx
```typescript
import { supabase } from '@/integrations/supabase/client';

async function loadExperts() {
  try {
    setLoading(true);
    const { data, error } = await supabase
      .from('experts')
      .select('*')
      .order('expert_name');

    if (error) throw error;
    setExperts(data || []);
  } catch (error) {
    console.error('Error loading experts:', error);
    toast.error('Failed to load experts');
  } finally {
    setLoading(false);
  }
}
```

### Example 2: DocsExplorer.tsx (Database Stats)
```typescript
const fetchDatabaseStats = async () => {
  try {
    // Get total files count
    const { data: filesData, error: filesError } = await supabase
      .from('documentation_files')
      .select('id, summary', { count: 'exact' });
    
    if (filesError) {
      console.error('Could not fetch documentation files:', filesError);
      return;
    }
    
    // Handle the data...
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
};
```

## Summary of Recent Fixes

- Fixed the Supabase import in DocsExplorer.tsx
- Fixed the Supabase import in process-expert-document.ts
- Fixed the Supabase import in markdownFileService.ts

All imports now point to `@/integrations/supabase/client`, ensuring consistent and correct database connections throughout the application.