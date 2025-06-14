# Follow-up Task Tracking Migration Guide

## Overview
The follow-up task tracking system has been implemented with all UI components and services ready. The database migration needs to be applied to enable full functionality.

## Current Status
✅ **Implemented**: UI components, services, and temporary data storage  
⚠️ **Pending**: Database migration for proper follow-up tracking tables

## Manual Migration Required

The migration file is ready at: `supabase/migrations/20250611_add_follow_up_tracking.sql`

### Steps to Apply Migration

1. **Open Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/jdksnfkupzywjdfefkyj
   - Go to "SQL Editor"

2. **Execute Migration**
   - Copy the entire contents of `supabase/migrations/20250611_add_follow_up_tracking.sql`
   - Paste into the SQL Editor
   - Click "Run" to execute

3. **Verify Migration**
   - Check that `dev_follow_up_tasks` table exists
   - Verify views are created: `dev_tasks_with_follow_ups_view`, `ai_work_summaries_with_follow_ups_view`
   - Test functions: `create_follow_up_task_relationship`, `get_follow_ups`

## What the Migration Creates

### Tables
- **`dev_follow_up_tasks`**: Junction table linking original tasks/work summaries to follow-up tasks
- Proper foreign key constraints and RLS policies

### Views
- **`dev_tasks_with_follow_ups_view`**: Tasks with their follow-up information
- **`ai_work_summaries_with_follow_ups_view`**: Work summaries with their follow-up information

### Functions
- **`create_follow_up_task_relationship()`**: Create follow-up relationships
- **`get_follow_ups()`**: Query follow-up tasks for a given item

## Current Temporary Implementation

Until the migration is applied, the system uses the existing `element_target` JSON field in `dev_tasks` to store follow-up information. This ensures the feature works immediately while proper database structure is pending.

## Post-Migration Updates

Once the migration is applied:

1. **Update FollowUpTaskService**: Uncomment database-specific methods
2. **Update CreateTaskFromPhase**: Switch from element_target to proper follow-up table
3. **Update UI components**: Use proper database queries instead of element_target parsing

## Testing After Migration

1. Create a follow-up task from a living document
2. Verify it appears on the original task's detail page
3. Check that follow-up relationships are properly stored
4. Test querying follow-ups for existing tasks

## Rollback Plan

If issues occur, the migration can be rolled back by dropping the created tables and functions:

```sql
DROP VIEW IF EXISTS ai_work_summaries_with_follow_ups_view;
DROP VIEW IF EXISTS dev_tasks_with_follow_ups_view;
DROP FUNCTION IF EXISTS get_follow_ups;
DROP FUNCTION IF EXISTS create_follow_up_task_relationship;
DROP TABLE IF EXISTS dev_follow_up_tasks;
```

The system will continue to work using the temporary element_target storage.