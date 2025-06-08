# View Renaming Summary

## Overview
All database views have been renamed to include a `_view` suffix for better clarity and consistency.

## Views Renamed (20 total)

### ✅ Updated in Code (4 views)
1. `command_refactor_status_summary` → `command_refactor_status_summary_view`
   - Updated: `scripts/cli-pipeline/refactor_tracking/show-status.ts`
   - Updated: `apps/dhg-admin-code/src/pages/CommandRefactorStatus.tsx`

2. `commands_needing_attention` → `command_refactor_needing_attention_view`
   - Updated: `scripts/cli-pipeline/refactor_tracking/needs-work.ts`

3. `active_scripts_view` → `registry_scripts_active_view`
   - Updated: `scripts/cli-pipeline/scripts/check-active-scripts-view.ts`

### 🔄 No Code References Found (16 views)
These views were renamed but had no TypeScript/JavaScript references:

4. `command_suggestions` → `command_suggestions_view`
5. `dev_tasks_with_git` → `dev_tasks_with_git_view`
6. `doc_continuous_status` → `doc_continuous_status_view`
7. `email_with_sources` → `email_messages_with_sources_view`
8. `user_learning_progress` → `learn_user_progress_view`
9. `media_bookmarks` → `learn_media_bookmarks_view`
10. `media_playback_events` → `learn_media_playback_events_view`
11. `media_sessions` → `learn_media_sessions_view`
12. `media_topic_segments` → `learn_media_topic_segments_view`
13. `function_registry_view` → `registry_functions_view`
14. `function_history_view` → `sys_function_history_view`
15. `batch_processing_status` → `batch_processing_status_view`
16. `recent_ai_work_summaries` → `ai_work_summaries_recent_view`
17. `page_guts_view` → `sys_page_guts_view`
18. `pending_access_requests` → `auth_pending_access_requests_view`
19. `professional_profiles` → `expert_professional_profiles_view`
20. `user_details` → `auth_user_details_view`

### 📁 Backup Schema (1 view)
21. `backup.backup_inventory` → `backup.backup_inventory_view`

## Views Already Correct (3 views)
- `ai_prompt_template_associations_view` ✓
- `document_classifications_view` ✓
- `media_content_view` ✓

## Testing Checklist
- [x] Migration script created with safe rename function
- [x] All TypeScript references updated
- [x] CLAUDE.md updated with view naming convention
- [ ] Run migration in development
- [ ] Regenerate types.ts
- [ ] Test affected CLI commands
- [ ] Test dhg-admin-code app

## Notes
- The migration creates new views alongside old ones initially
- Old views are dropped only after successful creation
- All changes are tracked in sys_table_migrations
- Views now follow consistent naming pattern with primary table prefix + descriptive name + _view suffix