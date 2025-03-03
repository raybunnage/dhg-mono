# Supabase Types Migration Plan

## Overview

This document outlines the plan to centralize and standardize Supabase type definitions across the project. We are archiving outdated type definitions and ensuring all code uses the main types file.

## Current State

We have identified three Supabase types files in the project:

1. `/supabase/types.ts` (3334 lines) - **Main source of truth**
2. `/src/integrations/supabase/types.ts` (1095 lines) - Partially updated copy
3. `/src/lib/supabase/types.ts` (16 lines) - Minimal, outdated file with only `SourceGoogle` interface

## Migration Steps

### Step 1: Fix Direct Imports from Old Locations

The following files have been updated to use the correct import source:
- ✅ `/src/api/process-expert-document.ts`: Changed from `@/lib/supabase/client` to `@/integrations/supabase/client`
- ✅ `/src/services/markdownFileService.ts`: Updated to use `@/integrations/supabase/client`

### Step 2: Archive Outdated Files

Run the following commands to archive the outdated files:

```bash
# Create archive directories if they don't exist
mkdir -p /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/src/lib/_archive
mkdir -p /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/src/integrations/_archive

# Archive the lib/supabase directory with a datestamp
mv /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/src/lib/supabase /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/src/lib/_archive/supabase.$(date +%Y-%m-%d)

# Archive the integrations/supabase/types.ts file with a datestamp
mv /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/src/integrations/supabase/types.ts /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/src/integrations/_archive/types.ts.$(date +%Y-%m-%d)
```

### Step 3: Create Symlinks to Main Types File

```bash
# Create a symlink to the main types file
ln -s /Users/raybunnage/Documents/github/dhg-mono/supabase/types.ts /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/src/integrations/supabase/types.ts
```

### Step 4: Update Documentation for Future Reference

Update the README or project documentation to note:

- The proper types file is located at `/supabase/types.ts`
- The types from `/src/lib/supabase/types.ts` and `/src/integrations/supabase/types.ts` have been archived
- All imports should use the main types file

## If Errors Occur After Migration

If you encounter errors after this migration:

1. Check if your code was importing from the archived files
2. Update imports to use the correct location (either directly from `/supabase/types.ts` or via the symlink)
3. For references to `SourceGoogle` type (which was in the minimal file), import it from:
   ```typescript
   import type { Database } from '@/integrations/supabase/types';
   type SourceGoogle = Database['public']['Tables']['sources_google']['Row'];
   ```

## Archived File Contents

### src/lib/supabase/types.ts (archived)

This file contained:
```typescript
export interface SourceGoogle {
  id: string
  drive_id: string
  name: string
  mime_type: string
  web_view_link?: string
  parent_folder_id?: string
  is_root: boolean
  path: string[]
  created_at: string
  updated_at: string
  last_indexed?: string
  metadata: any
}

export type SourceGoogleInsert = Omit<SourceGoogle, 'id' | 'created_at' | 'updated_at'>
export type SourceGoogleUpdate = Partial<SourceGoogleInsert>
```

## Verification After Migration

After completing the migration, run the development server to ensure everything works correctly:

```bash
pnpm dev
```

If you encounter any issues, consult this document for troubleshooting steps.