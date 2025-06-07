# Database View Renaming Plan

## Overview
This document outlines the plan to add `_view` suffix to all database views for better clarity and organization.

## View Mapping

### Views to Rename (Grouped by Prefix)

#### AI/Prompt Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| ai_prompt_template_associations_view | ai_prompt_template_associations_view | ✓ Already has suffix |
| recent_ai_work_summaries | ai_work_summaries_recent_view | ai_work_summaries |

#### Command Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| command_refactor_status_summary | command_refactor_status_summary_view | command_refactor_tracking |
| command_suggestions | command_suggestions_view | command_tracking |
| commands_needing_attention | command_refactor_needing_attention_view | command_refactor_tracking |

#### Development Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| dev_tasks_with_git | dev_tasks_with_git_view | dev_tasks |

#### Document Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| doc_continuous_status | doc_continuous_status_view | doc_continuous_tracking |
| document_classifications_view | document_classifications_view | ✓ Already has suffix |

#### Email Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| email_with_sources | email_messages_with_sources_view | email_messages |

#### Learning Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| user_learning_progress | learn_user_progress_view | learn_user_analytics |
| learn_user_progress | learn_user_progress_view | ✓ Already correct |

#### Media Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| media_content_view | media_content_view | ✓ Already has suffix |
| media_bookmarks | learn_media_bookmarks_view | learn_media_bookmarks |
| media_playback_events | learn_media_playback_events_view | learn_media_playback_events |
| media_sessions | learn_media_sessions_view | learn_media_sessions |
| media_topic_segments | learn_media_topic_segments_view | learn_media_topic_segments |

#### System/Registry Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| active_scripts_view | registry_scripts_active_view | registry_scripts |
| function_registry_view | registry_functions_view | function_registry |
| function_history_view | sys_function_history_view | function_registry |

#### Batch Processing Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| batch_processing_status | batch_processing_status_view | batch_processing |

#### Public Schema Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| page_guts_view | sys_page_guts_view | pages |
| pending_access_requests | auth_pending_access_requests_view | access_requests |
| professional_profiles | expert_professional_profiles_view | expert_profiles |
| user_details | auth_user_details_view | auth.users |

#### Backup Views
| Current Name | New Name | Primary Table |
|--------------|----------|---------------|
| backup.backup_inventory | backup.backup_inventory_view | information_schema.tables |

## Code References to Update

### TypeScript/JavaScript Files Using Views

1. **command_refactor_status_summary**
   - `scripts/cli-pipeline/refactor_tracking/show-status.ts`

2. **dev_tasks_with_git**
   - Check dev task management commands

3. **recent_ai_work_summaries**
   - AI work summary commands

4. **user_learning_progress**
   - Learning platform features

5. **media views**
   - Media player components
   - Learning analytics

## Migration Strategy

1. Create views with new names first (no dropping)
2. Update all code references
3. Drop old views after verification
4. Update sys_table_migrations to track changes

## Testing Checklist

- [ ] All CLI commands still function
- [ ] Views return same data as before
- [ ] No TypeScript errors after update
- [ ] Regenerated types.ts matches new names
- [ ] All apps can still query views

## Rollback Plan

The migration will create new views alongside old ones initially, allowing for easy rollback by:
1. Reverting code changes
2. Dropping new views
3. Keeping old views intact