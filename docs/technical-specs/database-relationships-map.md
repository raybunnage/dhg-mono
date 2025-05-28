# Database Relationships Map

**Last Updated**: May 2025  
**Purpose**: This document maps all foreign key relationships in the database, especially highlighting connections to renamed tables.

## Quick Reference: Key Relationships After Table Renaming

### Tables with "source_id" Field
Despite the table rename from `sources_google` → `google_sources`, the field names remain unchanged:
- `google_expert_documents.source_id` → `google_sources.id`
- `google_sources_experts.source_id` → `google_sources.id`
- `media_presentation_assets.asset_source_id` → `google_sources.id`
- `media_presentations.video_source_id` → `google_sources.id`
- `media_presentations.high_level_folder_source_id` → `google_sources.id`

### Tables with "expert_id" Field
Following the rename from `experts` → `expert_profiles`:
- `google_sources_experts.expert_id` → `expert_profiles.id`
- `expert_profile_aliases.expert_uuid` → `expert_profiles.id`

### Tables with "user_id" Field
All user references point to the primary user table:
- `auth_user_profiles.id` → `auth_allowed_emails.id` (one-to-one)
- `learn_media_bookmarks.user_id` → `auth_allowed_emails.id`
- `learn_media_playback_events.user_id` → `auth_allowed_emails.id`
- `learn_media_sessions.user_id` → `auth_allowed_emails.id`
- `learn_user_analytics.user_id` → `auth_allowed_emails.id`
- `learn_user_scores.user_id` → `auth_allowed_emails.id`

## Complete Foreign Key Relationships by Domain

### 🔐 Authentication Domain (`auth_`)

#### auth_user_profiles
- `id` → `auth_allowed_emails.id` (one-to-one relationship)
  - FK: `user_profiles_v2_id_fkey`
  - Note: This is the extended profile data for authenticated users

### 🤖 AI & Prompts Domain (`ai_`)

#### ai_prompt_categories
- `parent_category_id` → `ai_prompt_categories.id` (self-referential)
  - FK: `prompt_categories_parent_category_id_fkey`
  - Allows hierarchical category structure

#### ai_prompt_relationships
- `document_type_id` → `document_types.id`
  - FK: `fk_prompt_relationships_document_type`
- `prompt_id` → `ai_prompts.id`
  - FK: `prompt_relationships_prompt_id_fkey`

#### ai_prompt_template_associations
- `prompt_id` → `ai_prompts.id`
  - FK: `ai_prompt_template_associations_prompt_id_fkey`
- `template_id` → `ai_prompt_output_templates.id`
  - FK: `ai_prompt_template_associations_template_id_fkey`

#### ai_prompts
- `category_id` → `ai_prompt_categories.id`
  - FK: `prompts_category_id_fkey`
- `document_type_id` → `document_types.id`
  - FK: `prompts_document_type_id_fkey`

### 📁 Google Drive Domain (`google_`)

#### google_expert_documents
- `source_id` → `google_sources.id` ⚠️ *Field not renamed despite table rename*
  - FK: `expert_documents_source_id_fkey`
  - Links to the Google Drive file metadata
- `document_type_id` → `document_types.id`
  - FK: `expert_documents_document_type_id_fkey`

#### google_sources_experts (Junction Table)
- `source_id` → `google_sources.id` ⚠️ *Field not renamed*
  - FK: `sources_google_experts_source_id_fkey`
- `expert_id` → `expert_profiles.id` ⚠️ *Table renamed but field unchanged*
  - FK: `sources_google_experts_expert_id_fkey`

### 👨‍🏫 Expert Domain (`expert_`)

#### expert_profile_aliases
- `expert_uuid` → `expert_profiles.id`
  - FK: `fk_expert_uuid`
  - Allows multiple aliases per expert

### 🎓 Learning Platform Domain (`learn_`)

#### learn_document_classifications
- `subject_classification_id` → `learn_subject_classifications.id`
  - FK: `fk_subject_classification`
  - Note: `entity_id` is polymorphic (can reference multiple tables based on `entity_type`)

#### learn_document_concepts
- `document_id` → `google_expert_documents.id`
  - FK: `document_concepts_document_id_fkey`
  - Links concepts to expert documents

#### learn_media_bookmarks
- `user_id` → `auth_allowed_emails.id`
  - FK: `media_bookmarks_user_id_fkey`
  - Note: `media_id` is flexible (no FK constraint)

#### learn_media_playback_events
- `session_id` → `learn_media_sessions.id`
  - FK: `media_playback_events_session_id_fkey`
- `user_id` → `auth_allowed_emails.id`
  - FK: `media_playback_events_user_id_fkey`

#### learn_media_sessions
- `user_id` → `auth_allowed_emails.id`
  - FK: `media_sessions_user_id_fkey`
  - Note: `media_id` is flexible (no FK constraint)

#### learn_topics
- `parent_topic_id` → `learn_topics.id` (self-referential)
  - FK: `learning_topics_parent_topic_id_fkey`
  - Allows hierarchical topic structure

#### learn_user_analytics
- `user_id` → `auth_allowed_emails.id` (one-to-one)
  - FK: `user_learning_analytics_user_id_fkey`

#### learn_user_interests
- `subject_classification_id` → `learn_subject_classifications.id`
  - FK: `user_subject_interests_subject_classification_id_fkey`

#### learn_user_scores
- `user_id` → `auth_allowed_emails.id`
  - FK: `user_content_scores_user_id_fkey`
  - Note: `media_id` is flexible (no FK constraint)

### 🎬 Media Domain (`media_`)

#### media_presentation_assets
- `presentation_id` → `media_presentations.id`
  - FK: `presentation_assets_presentation_id_fkey`
- `asset_source_id` → `google_sources.id` ⚠️ *References renamed table*
  - FK: `presentation_assets_asset_source_id_fkey`
- `asset_expert_document_id` → `google_expert_documents.id`
  - FK: `presentation_assets_asset_expert_document_id_fkey`

#### media_presentations
- `video_source_id` → `google_sources.id` ⚠️ *References renamed table*
  - FK: `presentations_video_source_id_fkey`
- `expert_document_id` → `google_expert_documents.id`
  - FK: `presentations_expert_document_id_fkey`
- `high_level_folder_source_id` → `google_sources.id` ⚠️ *References renamed table*
  - FK: `presentations_high_level_folder_source_id_fkey`

### 📄 Document Domain (`doc_`)

No foreign key relationships defined for `doc_files`, `document_types`, or `document_type_aliases`.

### 🔍 Filter Domain (`filter_`)

#### filter_user_profile_drives
- `profile_id` → `filter_user_profiles.id`
  - FK: `user_filter_profile_drives_profile_id_fkey`

### 📜 Scripts Domain (`scripts_`)

#### scripts_registry
- `document_type_id` → `document_types.id`
  - FK: `scripts_document_type_id_fkey`

## Polymorphic Relationships

### learn_document_classifications
The `entity_id` field can reference different tables based on `entity_type`:
- When `entity_type` = 'google_expert_documents' → references `google_expert_documents.id`
- When `entity_type` = 'documentation_files' → references `doc_files.id`
- When `entity_type` = 'google_sources' → references `google_sources.id`
- When `entity_type` = 'scripts' → references `scripts_registry.id`

## Views and Their Relationships

### media_content_view
This view joins multiple tables and exposes relationships:
- `expert_id` → `expert_profiles.id`
- `source_id` → `google_sources.id`
- `expert_document_id` → `google_expert_documents.id`
- `presentation_id` → `media_presentations.id`

### learn_user_progress
- `user_id` → `auth_allowed_emails.id`

## Key Insights

1. **Field Names Preserved**: Despite table renames, foreign key field names were kept unchanged to minimize code impact
2. **Primary User Table**: `auth_allowed_emails` serves as the central user identity table
3. **Document Type Central**: `document_types` is referenced by many tables across domains
4. **Google Sources Hub**: `google_sources` (formerly `sources_google`) is central to media and document relationships
5. **Flexible Media References**: Several "media_id" fields don't have FK constraints, allowing flexibility in what constitutes "media"

## Migration Notes

When the tables were renamed:
- `sources_google` → `google_sources`
- `experts` → `expert_profiles`
- `expert_documents` → `google_expert_documents`

The foreign key field names (like `source_id`, `expert_id`) were intentionally kept the same to avoid cascading changes throughout the codebase. This is a good practice that maintains backwards compatibility while improving table organization.