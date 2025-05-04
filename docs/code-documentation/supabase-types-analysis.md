# Supabase Types Analysis

## Overview

This document provides an analysis of all Supabase types files across the project, with the goal of consolidating them into a single types file in the `supabase/types` folder for future use.

## Current Types Files

### 1. Root Types File: `/supabase/types.ts`

This is the most comprehensive types file, containing definitions for all database tables, views, and utility types.

**Tables Found (partial list - file contains many more):**
- `ai_processing_attempts`
- `app_pages`
- `asset_types`
- `audio_processing_configs`
- `audio_processing_stages`
- `audio_processor_steps`
- `audio_segments`
- `citation_expert_aliases`
- `document_type_aliases`
- `document_types`
- `domains`
- `email_addresses`
- `emails`
- `expert_documents`
- `experts`
- `page_dependencies`
- `page_function_usage`
- `page_table_usage`
- `presentation_assets`
- `presentation_collections`
- `presentation_relationships`
- `presentation_search_index`
- `presentation_tag_links`
- `presentation_tags`
- `presentation_theme_links`
- `presentation_themes`
- `presentations`
- `processing_batches`
- `processing_templates`
- `profiles`
- `sources`

### 2. App-Specific Types: `/apps/dhg-improve-experts/src/integrations/supabase/types.ts`

This file contains a subset of the tables found in the root types file, but with some differences in field definitions.

**Notable Differences:**
- Some tables include `created_by` and `updated_by` fields that are missing in the root types file
- Some tables have different field types or optional/required status

**Tables Found (partial list):**
- `citation_expert_aliases`
- `document_type_aliases`
- `domains`
- `email_addresses`
- `emails`
- `experts`
- `lionya_emails`
- `profiles`
- `sources`

### 3. App-Specific Types: `/apps/dhg-hub-lovable/src/integrations/supabase/types.ts`

Similar to the dhg-improve-experts types file, but with some differences.

**Notable Differences:**
- Includes `created_by` and `updated_by` fields consistently
- May have different table definitions compared to other types files

**Tables Found (partial list):**
- `citation_expert_aliases`
- `document_type_aliases`
- `domains`
- `email_addresses`
- `emails`
- `experts`
- `lionya_emails`
- `profiles`
- `sources`

### 4. Minimal Types File: `/supabase/types/index.ts`

This file contains a very limited subset of types, focusing only on the `sources_google` table.

**Tables Found:**
- `sources_google`

## Usage Patterns

### Import Paths

There are several different import paths used throughout the codebase:

1. **Root Types Import:**
   ```typescript
   import type { Database } from '../../../../../supabase/types';
   ```

2. **App-Specific Types Import:**
   ```typescript
   import type { Database } from '@/integrations/supabase/types';
   ```

3. **Types via Alias:**
   ```typescript
   import type { Database } from '@/types/supabase';
   ```

4. **File Types Import (non-standard):**
   ```typescript
   import type { Database } from '../../../../file_types/supabase/types';
   ```

### Usage by App

#### dhg-improve-experts

This app uses multiple import paths, including:
- `@/integrations/supabase/types`
- `@/types/supabase`
- `../types/supabase`
- `../../../../../supabase/types`
- `../../../../supabase/types`
- `../../../../file_types/supabase/types`

#### dhg-hub-lovable

This app primarily uses:
- `@/integrations/supabase/types`

## Inconsistencies and Issues

1. **Multiple Source Files:**
   - Having multiple type definition files leads to inconsistencies and maintenance challenges
   - Different apps may be using different type definitions for the same tables

2. **Inconsistent Import Paths:**
   - Various import paths make it difficult to track usage and update references
   - Some imports use relative paths, others use aliases

3. **Schema Differences:**
   - Some type files include fields like `created_by` and `updated_by` while others don't
   - This can lead to runtime errors if code expects fields that don't exist in the actual database

4. **Incomplete Types:**
   - The `/supabase/types/index.ts` file only defines a single table, making it incomplete for most use cases

## Recommendations for Consolidation

1. **Create a Single Source of Truth:**
   - Consolidate all types into `/supabase/types/index.ts`
   - Ensure it includes all tables from all existing type files
   - Include all fields from all versions (using union types where necessary)

2. **Standardize Import Path:**
   - Update all imports to use a consistent path:
   ```typescript
   import type { Database } from '../../../../../supabase/types';
   ```
   - Or use path aliases consistently:
   ```typescript
   import type { Database } from '@/supabase/types';
   ```

3. **Update Project Configuration:**
   - Ensure path aliases are properly configured in tsconfig.json
   - Add documentation about the correct import path to use

4. **Migration Strategy:**
   - Create the consolidated types file
   - Update imports in one app at a time
   - Test thoroughly after each app is migrated
   - Remove deprecated type files after all references are updated

## Usage Analysis

The following components and utilities use Supabase types:

### dhg-improve-experts

- **Pages:**
  - ExpertProfiles.tsx
  - file-explorer.tsx
  - Supabase.tsx
  - ClassifyDocument.tsx
  - Transcribe.tsx

- **Components:**
  - FileViewer.tsx
  - RegistryViewer.tsx
  - ExtractContentButton.tsx
  - FileTreeItem.tsx
  - FileTree.tsx
  - GetContentButton.tsx

- **Services:**
  - googleDriveService.ts

- **Utils:**
  - supabase.ts
  - ai-processing.ts
  - google-drive-sync.ts
  - whisper-processing.ts
  - metadata-sync.ts
  - batch-processor.ts

### dhg-hub-lovable

- **Integrations:**
  - supabase/client.ts

### Root Project

- **Supabase:**
  - client/index.ts
  - utils/schema-helper.ts

## Conclusion

Consolidating the Supabase types into a single file will improve maintainability, reduce inconsistencies, and make it easier to keep types in sync with the actual database schema. The recommended approach is to create a comprehensive types file in `/supabase/types/index.ts` and update all imports to reference this file. 