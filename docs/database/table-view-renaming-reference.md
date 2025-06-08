# Database Table and View Renaming Reference

This document contains the complete reference for database tables and views that have been renamed in the DHG monorepo project. This information was extracted from CLAUDE.md to reduce its size while maintaining accessibility.

## ⚠️ CRITICAL: Database Tables Have Been Renamed

Many database tables have undergone a major renaming effort. When troubleshooting issues with missing tables or outdated code references, consult the `sys_table_migrations` table or use the reference below:

| Old Table Name | New Table Name | Purpose |
|----------------|----------------|---------|
| allowed_emails | auth_allowed_emails | Authentication email allowlist |
| citation_expert_aliases | expert_citation_aliases | Expert citation aliases (intermediate) |
| cli_auth_tokens | auth_cli_tokens | CLI authentication tokens |
| cli_command_tracking | command_tracking | CLI command usage tracking |
| documentation_files | doc_files | Documentation file storage |
| document_concepts | learn_document_concepts | Document concept mapping |
| emails | email_messages | Email message storage |
| expert_citation_aliases | expert_profile_aliases | Expert profile aliases |
| expert_documents | google_expert_documents | Expert documents from Google Drive |
| experts | expert_profiles | Expert information storage |
| learning_topics | learn_topics | Learning topic definitions |
| media_bookmarks | learn_media_bookmarks | Media bookmarks |
| media_playback_events | learn_media_playback_events | Media playback tracking |
| media_sessions | learn_media_sessions | Media session tracking |
| media_topic_segments | learn_media_topic_segments | Media topic segments |
| mime_types | sys_mime_types | System MIME type registry |
| presentation_assets | media_presentation_assets | Presentation media assets |
| presentations | media_presentations | Media presentations |
| processing_batches | batch_processing | Batch processing operations |
| prompt_categories | ai_prompt_categories | Prompt categorization |
| prompt_output_templates | ai_prompt_output_templates | Prompt output templates |
| prompt_relationships | ai_prompt_relationships | Prompt relationships |
| prompts | ai_prompts | AI prompt storage |
| prompt_template_associations | ai_prompt_template_associations | Template associations |
| scripts | scripts_registry | Script management registry |
| sources_google | google_sources | Google Drive file metadata |
| sources_google_experts | google_sources_experts | Google sources expert mapping |
| subject_classifications | learn_subject_classifications | Subject classifications |
| sync_history | google_sync_history | Google Drive sync tracking |
| sync_statistics | google_sync_statistics | Sync operation statistics |
| table_classifications | learn_document_classifications | Document classification tracking |
| user_content_scores | learn_user_scores | User content scores |
| user_filter_profile_drives | filter_user_profile_drives | User drive filters |
| user_filter_profiles | filter_user_profiles | User filter profiles |
| user_learning_analytics | learn_user_analytics | Learning analytics data |
| user_profiles_v2 | auth_user_profiles | User profile information |
| user_subject_interests | learn_user_interests | User learning interests |

**Note**: This is a temporary reference while code is being updated. Always check `supabase/types.ts` for the current schema.

## ⚠️ Database Views Have Been Renamed

All database views now follow a consistent naming convention:
1. **Must end with `_view` suffix**
2. **Must use the prefix of their primary table**

| Old View Name | New View Name | Primary Table Prefix |
|---------------|---------------|---------------------|
| command_refactor_status_summary | command_refactor_status_summary_view | `command_` |
| commands_needing_attention | command_refactor_needing_attention_view | `command_` |
| dev_tasks_with_git | dev_tasks_with_git_view | `dev_` |
| doc_continuous_status | doc_continuous_status_view | `doc_` |
| learn_user_progress | learn_user_progress_view | `learn_` |
| recent_ai_work_summaries | ai_work_summaries_recent_view | `ai_` |

**Note**: Views must use their primary table's prefix so they sort together in database tools.

## Quick Reference

When you encounter a "table not found" error:
1. Check this document for the new table name
2. Verify in `supabase/types.ts` for the current schema
3. Check `sys_table_migrations` table for migration history
4. Update your code to use the new table name

## Migration Status

Most code has been updated to use the new table names, but you may still encounter:
- Old table names in archived scripts
- Legacy documentation referencing old names
- Third-party integrations that haven't been updated

When you find outdated references, update them to use the new naming convention.