# Supabase Types

This directory contains the consolidated Supabase database types for the DHG monorepo.

## Overview

The `index.ts` file in this directory is the single source of truth for Supabase database types across all applications in the monorepo. It contains TypeScript type definitions for all tables, views, and utility types needed to interact with the Supabase database.

## Usage

To use these types in your code, import them as follows:

```typescript
import type { Database } from '../../../../../supabase/types';
```

The number of `../` may vary depending on your file's location in the project structure. Alternatively, you can use path aliases if configured in your tsconfig.json:

```typescript
import type { Database } from '@/supabase/types';
```

## Common Type Patterns

### Accessing Table Row Types

```typescript
import type { Database } from '../../../../../supabase/types';

// Type for a row in the experts table
type Expert = Database['public']['Tables']['experts']['Row'];

// Type for inserting a new expert
type ExpertInsert = Database['public']['Tables']['experts']['Insert'];

// Type for updating an expert
type ExpertUpdate = Database['public']['Tables']['experts']['Update'];
```

### Using with Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/types';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Now you get type checking and autocompletion
const { data, error } = await supabase
  .from('experts')
  .select('*')
  .eq('id', expertId);

// data is typed as Expert[] | null
```

## Maintenance

### Updating Types

When the database schema changes, you should update the types in this file. You can generate updated types using the Supabase CLI:

```bash
supabase gen types typescript --project-id your-project-id > supabase/types/index.ts
```

Or, if you have local access to the database:

```bash
supabase gen types typescript --db-url "postgresql://postgres:postgres@localhost:54322/postgres" > supabase/types/index.ts
```

### Consolidation Process

This consolidated types file was created by merging multiple type definition files that previously existed in different locations:

1. `/supabase/types.ts` (root types file)
2. `/apps/dhg-improve-experts/src/integrations/supabase/types.ts`
3. `/apps/dhg-hub-lovable/src/integrations/supabase/types.ts`

The consolidation process involved:

1. Analyzing all type files to identify all tables and fields
2. Creating a merged version that includes all fields from all versions
3. Updating import paths throughout the codebase
4. Adding deprecation notices to the old type files

Scripts used for this process can be found in the `/scripts` directory:

- `consolidate-supabase-types.sh`: Shell script to update imports and add deprecation notices
- `merge-supabase-types.ts`: TypeScript script to analyze and merge type definitions

## Troubleshooting

### Missing Fields

If you encounter errors about missing fields, it may be because:

1. The field exists in the database but is not reflected in the types
2. The field was recently added to the database but the types haven't been updated
3. The field exists in one environment but not another

To resolve these issues, update the types file with the missing fields or regenerate it using the Supabase CLI.

### Import Path Issues

If you encounter import path issues, ensure you're using the correct relative path to the types file. The path should point to `/supabase/types/index.ts` from your file's location.

## Additional Resources

- [Supabase TypeScript Support Documentation](https://supabase.com/docs/reference/javascript/typescript-support)
- [Type Generation with Supabase CLI](https://supabase.com/docs/reference/cli/supabase-gen-types) 