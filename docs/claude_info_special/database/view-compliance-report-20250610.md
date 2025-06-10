# View Compliance Report - June 10, 2025

## Executive Summary

Almost all views in the database are compliant with the naming requirements specified in CLAUDE.md:
1. ✅ All views end with `_view` suffix (100% compliant)
2. ⚠️ One view lacks proper prefix: `cli_commands_ordered_view` should be `command_commands_ordered_view`

## Current State

### Total Views: 25

All 25 views in the database have the required `_view` suffix:

1. ✅ ai_work_summaries_recent_view
2. ✅ app_hierarchy_view
3. ✅ available_task_elements_view
4. ❌ cli_commands_ordered_view (should be command_commands_ordered_view)
5. ✅ command_refactor_needing_attention_view
6. ✅ command_refactor_status_summary_view
7. ✅ dev_task_elements_view
8. ✅ dev_tasks_enhanced_view
9. ✅ dev_tasks_with_continuous_docs_view
10. ✅ dev_tasks_with_git_view
11. ✅ doc_continuous_status_view
12. ✅ element_hierarchy_view
13. ✅ elements_with_criteria_view
14. ✅ learn_user_progress_view
15. ✅ media_content_view
16. ✅ registry_app_dependencies_view
17. ✅ registry_pipeline_coverage_gaps_view
18. ✅ registry_service_usage_summary_view
19. ✅ registry_unused_services_view
20. ✅ sys_app_dependencies_view
21. ✅ sys_archived_scripts_active_view
22. ✅ sys_database_objects_info_view
23. ✅ sys_pipeline_dependencies_view
24. ✅ sys_service_dependency_summary_view
25. ✅ worktree_assignments_complete_view

## Views Not in sys_table_definitions

The following 9 views were found in the database but were not tracked in `sys_table_definitions`:

1. available_task_elements_view
2. cli_commands_ordered_view
3. elements_with_criteria_view
4. dev_task_elements_view
5. dev_tasks_enhanced_view
6. dev_tasks_with_continuous_docs_view
7. app_hierarchy_view
8. element_hierarchy_view
9. worktree_assignments_complete_view

**Action Taken**: Created migration `20250610_add_missing_views_to_sys_table_definitions.sql` to add these views to the tracking table.

## Compliance Summary

| Requirement | Status | Count |
|-------------|--------|-------|
| Views with `_view` suffix | ✅ Compliant | 25/25 (100%) |
| Views with proper prefix | ⚠️ Needs Fix | 24/25 (96%) |
| Views tracked in sys_table_definitions | ⚠️ Needs Update | 16/25 (64%) |

## Recommendations

1. **Apply the migration** to add the 9 missing views to `sys_table_definitions`
2. **Apply the renaming migration** to rename `cli_commands_ordered_view` to `command_commands_ordered_view`
3. **Consider regular audits** to ensure new views are added to sys_table_definitions and follow naming conventions

## Views Requiring Rename

| Current Name | Issue | Proper Prefix | New Name | Status |
|--------------|-------|---------------|----------|--------|
| cli_commands_ordered_view | No established cli_ prefix | command_ | command_commands_ordered_view | Migration created: 20250609223615

## Historical Context

Based on the view-renaming-plan.md document, it appears that a comprehensive view renaming effort was already completed. The plan listed many views that needed the `_view` suffix added, and it appears this work was successfully completed.

## Conclusion

The database views are in excellent compliance with the naming standards, with only one view needing to be renamed. Actions needed:
1. Rename `cli_commands_ordered_view` to `command_commands_ordered_view` 
2. Update the `sys_table_definitions` table to track all existing views