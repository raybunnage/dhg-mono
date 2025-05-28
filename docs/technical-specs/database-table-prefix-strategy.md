# Database Table Prefix Strategy and Implementation Plan

## Overview

This document outlines a comprehensive strategy for implementing table prefixes across all database tables in the DHG monorepo. The prefix approach provides organizational clarity while avoiding the complexity of cross-schema queries and maintains all tables in the `public` schema.

## Table Prefix Definitions

Based on analysis of the 56 existing tables, here are the recommended prefixes for each functional group:

### 1. Authentication & User Management - `auth_`
- `auth_allowed_emails` (from `allowed_emails`)
- `auth_user_profiles` (from `user_profiles_v2`)
- `auth_audit_log` (from `auth_audit_log`)
- `auth_cli_tokens` (from `cli_auth_tokens`)

### 2. Document Management System - `doc_`
- `doc_types` (from `document_types`)
- `doc_types_original` (from `document_types_original`)
- `doc_type_aliases` (from `document_type_aliases`)
- `doc_concepts` (from `document_concepts`)
- `doc_files` (from `documentation_files`)
- `doc_files_missing_ids` (from `documentation_files_missing_doc_ids`)
- `doc_processing_queue` (from `documentation_processing_queue`)
- `doc_sections` (from `documentation_sections`)

### 3. Expert System - `expert_`
- `expert_profiles` (from `experts`)
- `expert_documents` (from `expert_documents`)
- `expert_preferences` (from `expert_preferences`)
- `expert_citation_aliases` (from `citation_expert_aliases`)

### 4. Google Drive Integration - `google_`
- `google_sources` (from `sources_google`)
- `google_sources_experts` (from `sources_google_experts`)
- `google_sync_history` (from `sync_history`)
- `google_sync_statistics` (from `sync_statistics`)
- `google_sources_legacy` (from `sources`)

### 5. Email System - `email_`
- `email_messages` (from `emails`)
- `email_addresses` (from `email_addresses`)

### 6. Media & Presentations - `media_`
- `media_presentations` (from `presentations`)
- `media_presentation_assets` (from `presentation_assets`)
- `media_sessions` (from `media_sessions`)
- `media_playback_events` (from `media_playback_events`)
- `media_topic_segments` (from `media_topic_segments`)
- `media_bookmarks` (from `media_bookmarks`)

### 7. Script Management - `script_`
- `script_registry` (from `scripts`)

### 8. Command & Analytics - `cmd_`   probably change to command
- `cmd_tracking` (from `cli_command_tracking`)   leave as is
- `cmd_categories` (from `command_categories`)
- `cmd_patterns` (from `command_patterns`)

### 9. AI & Prompt Management - `ai_`
- `ai_prompts` (from `prompts`)
- `ai_prompt_categories` (from `prompt_categories`)
- `ai_prompt_output_templates` (from `prompt_output_templates`)
- `ai_prompt_relationships` (from `prompt_relationships`)
- `ai_prompt_template_associations` (from `prompt_template_associations`)

### 10. Learning Platform - `learn_`
- `learn_topics` (from `learning_topics`)
- `learn_user_interests` (from `user_subject_interests`)
- `learn_user_scores` (from `user_content_scores`)
- `learn_user_analytics` (from `user_learning_analytics`)
- `learn_subject_classifications` (from `subject_classifications`)

### 11. Processing & Batch Operations - `batch_`
- `batch_processing` (from `processing_batches`)
- `batch_table_classifications` (from `table_classifications`)

### 12. System & Infrastructure - `sys_`
- `sys_function_registry` (from `function_registry`)
- `sys_function_relationships` (from `function_relationships`)
- `sys_sql_query_history` (from `sql_query_history`)
- `sys_domains` (from `domains`)
- `sys_app_pages` (from `app_pages`)
- `sys_asset_types` (from `asset_types`)
- `sys_mime_types` (from `mime_types`)

### 13. User Filtering & Preferences - `filter_`
- `filter_user_profiles` (from `user_filter_profiles`)
- `filter_user_profile_drives` (from `user_filter_profile_drives`)

## Implementation Strategy

### Phase 1: Foundation (Week 1)
**Priority: Critical Infrastructure**

1. **Create Migration Infrastructure**
   - Build a table renaming utility script in `scripts/cli-pipeline/database/`
   - Create rollback scripts for each rename operation
   - Set up migration tracking table: `sys_table_migrations`

2. **Update Type Generation**
   - Modify the Supabase type generation process to handle renamed tables
   - Create type aliases for backward compatibility during transition

3. **Create View-Based Compatibility Layer**
   - For each renamed table, create a view with the old name
   - This allows existing code to continue working during migration

### Phase 2: System Tables (Week 2)
**Priority: Low-impact, foundational tables**

Start with system tables that have minimal application dependencies:
- `sys_mime_types`
- `sys_asset_types`
- `sys_domains`
- `sys_app_pages`

### Phase 3: Command & Analytics (Week 3)
**Priority: Internal tooling tables**

Rename command tracking tables:
- `cmd_tracking`
- `cmd_categories`
- `cmd_patterns`

### Phase 4: AI & Batch Processing (Week 4)
**Priority: Backend processing tables**

- All `ai_` prefixed tables
- All `batch_` prefixed tables

### Phase 5: Core Business Logic (Weeks 5-8)
**Priority: High-impact, careful migration needed**

#### Week 5: Document Management
- Migrate all `doc_` prefixed tables
- Update all document-related services and CLI commands

#### Week 6: Expert System
- Migrate all `expert_` prefixed tables
- Update expert-related functionality

#### Week 7: Google Drive Integration
- Migrate all `google_` prefixed tables
- Update sync processes and CLI commands

#### Week 8: Authentication & User Management
- Migrate all `auth_` prefixed tables
- Carefully test all authentication flows

### Phase 6: Remaining Tables (Week 9)
**Priority: Complete the migration**

- Email system tables
- Media & presentation tables
- Learning platform tables
- User filtering tables
- Script management table

### Phase 7: Cleanup (Week 10)
**Priority: Remove compatibility layer**

1. Remove all compatibility views
2. Update all type aliases to direct references
3. Archive old migration scripts
4. Update all documentation

## Implementation Guidelines

### 1. Migration Script Template
```sql
-- Migration: Rename table old_name to prefix_new_name
BEGIN;

-- Step 1: Rename the table
ALTER TABLE old_name RENAME TO prefix_new_name;

-- Step 2: Create compatibility view
CREATE VIEW old_name AS SELECT * FROM prefix_new_name;

-- Step 3: Update any table-specific constraints, indexes, etc.
-- (Handle each table's specific needs)

-- Step 4: Record migration
INSERT INTO sys_table_migrations (old_name, new_name, migrated_at)
VALUES ('old_name', 'prefix_new_name', NOW());

COMMIT;
```

### 2. Rollback Script Template
```sql
-- Rollback: Restore prefix_new_name to old_name
BEGIN;

-- Step 1: Drop compatibility view
DROP VIEW IF EXISTS old_name;

-- Step 2: Rename table back
ALTER TABLE prefix_new_name RENAME TO old_name;

-- Step 3: Remove migration record
DELETE FROM sys_table_migrations WHERE new_name = 'prefix_new_name';

COMMIT;
```

### 3. Code Update Process
1. Search codebase for table references using grep/ripgrep
2. Update imports and type references
3. Test each component after updates
4. Use compatibility views to maintain functionality during transition

### 4. Testing Strategy
- Create comprehensive test suite before starting migrations
- Test each phase thoroughly before proceeding
- Monitor application logs for any issues
- Have rollback scripts ready for each phase

## Backup Strategy Based on Prefixes

Once implemented, the prefix system enables targeted backups:

### Backup Groups
1. **Core Authentication**: `auth_*` tables
2. **Document System**: `doc_*` tables
3. **Expert Data**: `expert_*` tables
4. **Google Drive Cache**: `google_*` tables
5. **User Generated Content**: `email_*`, `media_*`, `learn_*` tables
6. **System Configuration**: `sys_*` tables
7. **Analytics Data**: `cmd_*`, `batch_*` tables

### Backup Script Example
```bash
# Backup all authentication tables
pg_dump -t 'auth_*' > backup_auth_$(date +%Y%m%d).sql

# Backup all document tables
pg_dump -t 'doc_*' > backup_docs_$(date +%Y%m%d).sql
```

## Risk Mitigation

### 1. Compatibility Views
- Maintain views with old table names during migration
- Allows gradual code updates without breaking changes

### 2. Type Aliases
```typescript
// During migration, maintain both types
export type DocumentTypes = Database['public']['Tables']['document_types'];
export type DocTypes = Database['public']['Tables']['doc_types'];
```

### 3. Migration Tracking
- Track all migrations in `sys_table_migrations`
- Include rollback capability for each migration
- Document any issues encountered

### 4. Monitoring
- Set up alerts for query failures
- Monitor application logs during each phase
- Have a communication plan for any downtime

## Benefits After Implementation

1. **Improved Organization**
   - Clear visual grouping in database tools
   - Easier navigation and understanding
   - Reduced cognitive load

2. **Better Backup Management**
   - Targeted backups by functional area
   - Easier restoration of specific subsystems
   - More efficient storage usage

3. **Enhanced Development Experience**
   - Autocomplete shows related tables together
   - Easier to identify table purposes
   - Reduced chance of using wrong tables

4. **Simplified Permissions**
   - Can grant permissions using prefix patterns
   - Easier to audit access by functional area

## Long-term Maintenance

1. **Naming Convention Documentation**
   - Add to project documentation
   - Include in onboarding materials
   - Enforce in code reviews

2. **Automated Checks**
   - Add linting rules for table names in SQL
   - Validate prefixes in migration scripts
   - Include in CI/CD pipeline

3. **Regular Reviews**
   - Quarterly review of table organization
   - Identify any tables not following conventions
   - Plan migrations for any new patterns needed

## Conclusion

The prefix strategy provides the organizational benefits of schemas without the complexity of cross-schema queries. By implementing this incrementally with proper compatibility layers, we can achieve a well-organized database structure while maintaining system stability throughout the migration process.