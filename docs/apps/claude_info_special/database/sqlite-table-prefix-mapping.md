# SQLite Table Prefix Mapping

## Overview

This document outlines the mapping of imported SQLite tables that currently lack proper prefixes. All tables without standard prefixes should be renamed with the `sqlite_` prefix to maintain consistency with the database naming conventions.

## Current Database Prefix Standards

The following prefixes are currently used in the database:
- `auth_` - Authentication & user management
- `ai_` - AI & prompt management
- `google_` - Google Drive integration
- `learn_` - Learning platform features
- `media_` - Media & presentations
- `doc_` - Document management
- `expert_` - Expert system
- `email_` - Email system
- `command_` - Command & analytics
- `filter_` - User filtering & preferences
- `batch_` - Batch operations
- `scripts_` - Script management
- `sys_` - System & infrastructure
- `dev_` - Development & task management
- `service_` - Service dependencies
- `app_` - Application registry

## Tables Requiring sqlite_ Prefix

Based on the database analysis and RLS policy creation output, the following tables appear to be from SQLite imports and require the `sqlite_` prefix:

NEW
| tag_table_records |   

concept_document_functions
document_type_aliases
expert_quote_summaries
hncs_files_names





### Confirmed Tables from sys_table_definitions (19 tables)

| Current Name | Proposed Name | Category |
|--------------|---------------|----------|
| SKIP clipboard_snippets | sqlite_clipboard_snippets | Utility |
| SKIP document_type_aliases | sqlite_document_type_aliases | Document Management |
| SKIP document_types | sqlite_document_types | Document Management |
| SKIP import_all_email_urls | sqlite_import_all_email_urls | Import/Email |
| SKIP import_attachments | sqlite_import_attachments | Import/Content |
| SKIP import_email_concepts | sqlite_import_email_concepts | Import/Email |
| SKIP import_email_contents | sqlite_import_email_contents | Import/Email |
| SKIP import_emails | sqlite_import_emails | Import/Email |
| SKIP import_important_email_addresses | sqlite_import_important_email_addresses | Import/Email |
| SKIP import_rolled_up_emails | sqlite_import_rolled_up_emails | Import/Email |
| SKIP import_urls | sqlite_import_urls | Import/Content |
| SKIP import_web_concepts | sqlite_import_web_concepts | Import/Content |
| SKIP research_urls | sqlite_research_urls | Research/Content |

### Additional Tables from RLS Policy Creation (39 tables)

These tables were identified during RLS policy creation as lacking policies, suggesting they are also imported tables:

| Current Name | Proposed Name | Category |
|--------------|---------------|----------|
| activity_logs | sqlite_activity_logs | Logging/Analytics |
| all_authors | sqlite_all_authors | User/Content |
| all_email_urls | sqlite_all_email_urls | Email/Content |
| all_references | sqlite_all_references | Content/References |
| answer_concepts | sqlite_answer_concepts | Q&A System |
| answers | sqlite_answers | Q&A System |
| attachments | sqlite_attachments | Content/Files |
| authors | sqlite_authors | User/Content |
| basic_prompts | sqlite_basic_prompts | AI/Prompts |
| blobs | sqlite_blobs | Content/Storage |
| chat_engines | sqlite_chat_engines | Communication |
| NO citation_expert_aliases | sqlite_citation_expert_aliases | Expert/Citations |
| citations | sqlite_citations | Content/References |
| concepts | sqlite_concepts | Knowledge/Content |
| dbtables | sqlite_dbtables | System/Metadata |
| discussions | sqlite_discussions | Communication |
| document_functions | sqlite_document_functions | Document/Functions |
| errors | sqlite_errors | Logging/System |
| functions | sqlite_functions | System/Functions |
| images | sqlite_images | Content/Media |
| modules | sqlite_modules | System/Code |
| pdfs | sqlite_pdfs | Content/Documents |
| questions | sqlite_questions | Q&A System |
| relationships | sqlite_relationships | System/Relations |
| sources | sqlite_sources | Content/Sources |
| tags | sqlite_tags | Content/Metadata |
| urls | sqlite_urls | Content/Links |
| users | sqlite_users | User/Auth |
| voices | sqlite_voices | Audio/Media |

## Total Tables to Rename: 58

### Breakdown by Category:
- **Import Tables**: 10 (import_*)
- **Registry Tables**: 4 (*_registry)
- **Content/Document Tables**: 15
- **System/Metadata Tables**: 9
- **User/Auth Tables**: 4
- **Communication Tables**: 3
- **Q&A System Tables**: 3
- **Logging Tables**: 2
- **AI/Prompts Tables**: 1
- **Other**: 7

## Migration Strategy

1. **Create sys_table_migrations entries** for all table renames
2. **Update all references** in code, views, and functions
3. **Rename tables** using ALTER TABLE statements
4. **Update RLS policies** to use new table names
5. **Update sys_table_definitions** with new names
6. **Test all affected functionality**

## Next Steps

1. Review and approve this mapping
2. Create a migration script to rename all tables
3. Update the codebase to use new table names
4. Document the migration in sys_table_migrations

## Notes

- All tables without standard prefixes are assumed to be SQLite imports
- The `sqlite_` prefix clearly identifies these as imported/legacy tables
- This maintains consistency with the existing prefix system
- Future imports should follow the same pattern