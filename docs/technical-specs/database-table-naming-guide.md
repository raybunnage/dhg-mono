# Database Table Naming Guide

## Quick Reference for Table Prefixes

When creating new database tables, use these established prefixes:

| Prefix | Domain | Example Tables |
|--------|--------|----------------|
| `auth_` | Authentication & Users | `auth_sessions`, `auth_tokens`, `auth_password_resets` |
| `ai_` | AI & Prompts | `ai_models`, `ai_conversations`, `ai_embeddings` |
| `google_` | Google Drive | `google_folders`, `google_permissions`, `google_file_metadata` |
| `learn_` | Learning Platform | `learn_courses`, `learn_progress`, `learn_quiz_results` |
| `media_` | Media Content | `media_thumbnails`, `media_transcripts`, `media_captions` |
| `doc_` | Documents | `doc_versions`, `doc_comments`, `doc_history` |
| `expert_` | Expert System | `expert_ratings`, `expert_specialties`, `expert_availability` |
| `email_` | Email System | `email_templates`, `email_logs`, `email_bounces` |
| `command_` | Commands/Analytics | `command_aliases`, `command_logs`, `command_metrics` |
| `filter_` | Filtering/Preferences | `filter_rules`, `filter_history`, `filter_templates` |
| `batch_` | Batch Processing | `batch_jobs`, `batch_results`, `batch_queues` |
| `scripts_` | Script Management | `scripts_versions`, `scripts_logs`, `scripts_dependencies` |
| `sys_` | System/Infrastructure | `sys_logs`, `sys_settings`, `sys_health_checks` |

## Naming Rules

1. **Format**: `prefix_entity_name` (all lowercase, underscores for spaces)
2. **Plural vs Singular**: Use plural for collections (e.g., `auth_users`), singular for single-row tables (e.g., `sys_config`)
3. **Junction Tables**: Use both entity names (e.g., `learn_user_courses` for users ↔ courses)
4. **No Double Prefixes**: Avoid redundancy (✗ `auth_auth_tokens`, ✓ `auth_tokens`)

## Process for New Tables

1. **Check Existing Prefixes**: Does your feature fit an existing domain?
2. **Propose New Prefix**: If needed, discuss before creating a new prefix category
3. **Create Migration**: Include the table creation in a proper migration file
4. **Update Types**: Run type generation to update `supabase/types.ts`
5. **Track Migration**: Ensure entry in `sys_table_migrations` table

## Examples

### ✓ Good Names
- `auth_login_attempts` - Clear domain, descriptive name
- `learn_user_achievements` - Junction table with clear purpose
- `ai_prompt_templates` - Follows established pattern

### ✗ Avoid
- `user_data` - Missing prefix, too generic
- `learning_user_progress_tracking` - Redundant prefix, too long
- `misc_stuff` - No clear domain, uninformative

## Quick Decision Tree

```
Need a new table?
├─ Authentication related? → auth_
├─ AI/ML related? → ai_
├─ Google Drive related? → google_
├─ Learning/Education? → learn_
├─ Media files? → media_
├─ Documents? → doc_
├─ Expert profiles? → expert_
├─ Email? → email_
├─ CLI/Analytics? → command_
├─ User preferences? → filter_
├─ Background jobs? → batch_
├─ Scripts? → scripts_
├─ System/Config? → sys_
└─ None of above? → Consult team before creating new prefix
```

Remember: Consistency > Perfection. Follow the pattern even if another name seems slightly better.