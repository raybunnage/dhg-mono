# Dev Task Tracking - Practical Query Guide

## Quick Reference: Finding Tasks That Need Attention

### 1. Tasks Without Claude Submission

```sql
-- Find dev tasks that haven't been submitted to Claude yet
SELECT 
  dt.id,
  dt.title,
  dt.worktree_path,
  dt.created_at,
  DATE_PART('day', CURRENT_TIMESTAMP - dt.created_at) as days_old
FROM dev_tasks dt
LEFT JOIN claude_task_submissions cts ON dt.id = cts.task_id
WHERE cts.id IS NULL
  AND dt.status != 'cancelled'
ORDER BY dt.created_at ASC;
```

### 2. Tasks Without Work Summaries

```sql
-- Find tasks that have been worked on but lack work summaries
SELECT 
  dt.id,
  dt.title,
  dt.worktree_path,
  cts.submission_timestamp,
  cts.worktree as submission_worktree
FROM dev_tasks dt
JOIN claude_task_submissions cts ON dt.id = cts.task_id
LEFT JOIN ai_work_summaries aws ON dt.id = aws.dev_task_id
WHERE aws.id IS NULL
  AND cts.status = 'completed'
ORDER BY cts.submission_timestamp ASC;
```

### 3. Tasks Without Validation

```sql
-- Find completed tasks that haven't gone through validation
SELECT 
  dt.id,
  dt.title,
  aws.created_at as work_completed_at,
  DATE_PART('day', CURRENT_TIMESTAMP - aws.created_at) as days_since_completion
FROM dev_tasks dt
JOIN ai_work_summaries aws ON dt.id = aws.dev_task_id
LEFT JOIN validation_submissions vs ON dt.id = vs.dev_task_id
WHERE vs.id IS NULL
  AND dt.status = 'completed'
ORDER BY aws.created_at ASC;
```

### 4. Tasks With Incomplete Subtasks

```sql
-- Find tasks that have subtasks but aren't fully complete
SELECT 
  dt.id,
  dt.title,
  COUNT(dts.id) as total_subtasks,
  COUNT(dts.id) FILTER (WHERE dts.status = 'completed') as completed_subtasks,
  COUNT(dts.id) FILTER (WHERE dts.status = 'in_progress') as in_progress_subtasks,
  COUNT(dts.id) FILTER (WHERE dts.status = 'pending') as pending_subtasks
FROM dev_tasks dt
JOIN dev_task_subtasks dts ON dt.id = dts.parent_task_id
GROUP BY dt.id, dt.title
HAVING COUNT(dts.id) > COUNT(dts.id) FILTER (WHERE dts.status = 'completed')
ORDER BY dt.created_at ASC;
```

## Comprehensive Task Status Report

```sql
-- Complete task tracking report showing all stages
WITH task_tracking AS (
  SELECT 
    dt.id,
    dt.title,
    dt.status as task_status,
    dt.worktree_path,
    dt.created_at,
    
    -- Submission info
    cts.id IS NOT NULL as is_submitted,
    cts.submission_timestamp,
    cts.worktree as submission_worktree,
    
    -- Work summary info
    aws.id IS NOT NULL as has_summary,
    aws.created_at as summary_created_at,
    
    -- Validation info
    vs.id IS NOT NULL as is_validated,
    vs.submission_timestamp as validation_timestamp,
    vs.status as validation_status,
    
    -- Subtask counts
    COUNT(dts.id) as total_subtasks,
    COUNT(dts.id) FILTER (WHERE dts.status = 'completed') as completed_subtasks
    
  FROM dev_tasks dt
  LEFT JOIN claude_task_submissions cts ON dt.id = cts.task_id
  LEFT JOIN ai_work_summaries aws ON dt.id = aws.dev_task_id
  LEFT JOIN validation_submissions vs ON dt.id = vs.dev_task_id
  LEFT JOIN dev_task_subtasks dts ON dt.id = dts.parent_task_id
  WHERE dt.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY dt.id, cts.id, aws.id, vs.id
)
SELECT 
  title,
  worktree_path,
  DATE_PART('day', CURRENT_TIMESTAMP - created_at)::int as age_days,
  
  -- Status indicators
  CASE WHEN is_submitted THEN '✅' ELSE '❌' END as submitted,
  CASE WHEN has_summary THEN '✅' ELSE '❌' END as summarized,
  CASE WHEN is_validated THEN '✅' ELSE '❌' END as validated,
  
  -- Subtask progress
  CASE 
    WHEN total_subtasks = 0 THEN 'N/A'
    ELSE completed_subtasks || '/' || total_subtasks
  END as subtasks,
  
  -- Overall status
  CASE
    WHEN NOT is_submitted THEN '🔴 Not Started'
    WHEN NOT has_summary THEN '🟡 In Progress'
    WHEN NOT is_validated THEN '🟠 Needs Validation'
    WHEN total_subtasks > completed_subtasks THEN '🔵 Subtasks Pending'
    ELSE '🟢 Complete'
  END as overall_status,
  
  -- Next action
  CASE
    WHEN NOT is_submitted THEN 'Submit to Claude'
    WHEN NOT has_summary THEN 'Create work summary'
    WHEN NOT is_validated THEN 'Submit for validation'
    WHEN total_subtasks > completed_subtasks THEN 'Complete subtasks'
    ELSE 'None - task complete'
  END as next_action

FROM task_tracking
ORDER BY 
  CASE 
    WHEN NOT is_submitted THEN 1
    WHEN NOT has_summary THEN 2
    WHEN NOT is_validated THEN 3
    WHEN total_subtasks > completed_subtasks THEN 4
    ELSE 5
  END,
  created_at ASC;
```

## CLI Commands for Task Tracking

### Create Tracking Dashboard Command

```typescript
// File: scripts/cli-pipeline/dev_tasks/commands/tracking-dashboard.ts

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function showTrackingDashboard() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get tasks without submissions
  const { data: unsubmitted } = await supabase
    .from('dev_tasks')
    .select(`
      id,
      title,
      worktree_path,
      created_at
    `)
    .is('claude_submission_id', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });
    
  // Get tasks without summaries
  const { data: unsummarized } = await supabase
    .from('dev_tasks')
    .select(`
      id,
      title,
      claude_task_submissions!inner(submission_timestamp, worktree)
    `)
    .is('work_summary_id', null)
    .order('claude_task_submissions.submission_timestamp', { ascending: true });
    
  // Display results
  console.log('📊 Dev Task Tracking Dashboard\n');
  
  if (unsubmitted?.length > 0) {
    console.log('🔴 Tasks Not Yet Submitted:');
    unsubmitted.forEach(task => {
      console.log(`  - ${task.title} (${task.worktree_path || 'no worktree'})`);
    });
    console.log('');
  }
  
  if (unsummarized?.length > 0) {
    console.log('🟡 Tasks Without Work Summaries:');
    unsummarized.forEach(task => {
      console.log(`  - ${task.title}`);
    });
    console.log('');
  }
}
```

### Flag Incomplete Tasks Command

```bash
# Add to dev-tasks-cli.sh
cmd_flag_incomplete() {
    local filter="$1"
    echo "🚩 Flagging incomplete tasks..."
    
    case "$filter" in
        --no-submission)
            local cmd="npx ts-node --project \"$PROJECT_ROOT/tsconfig.node.json\" \"$DEV_TASKS_DIR/flag-tasks.ts\" no-submission"
            ;;
        --no-summary)
            local cmd="npx ts-node --project \"$PROJECT_ROOT/tsconfig.node.json\" \"$DEV_TASKS_DIR/flag-tasks.ts\" no-summary"
            ;;
        --no-validation)
            local cmd="npx ts-node --project \"$PROJECT_ROOT/tsconfig.node.json\" \"$DEV_TASKS_DIR/flag-tasks.ts\" no-validation"
            ;;
        *)
            echo "Usage: flag-incomplete [--no-submission|--no-summary|--no-validation]"
            exit 1
            ;;
    esac
    
    track_command "flag-incomplete" "$cmd"
}
```

## Database Views for Easy Querying

```sql
-- Create a view that shows task completion stages
CREATE OR REPLACE VIEW dev_task_completion_stages AS
SELECT 
  dt.id,
  dt.title,
  dt.worktree_path,
  dt.created_at,
  
  -- Stage flags
  CASE WHEN cts.id IS NOT NULL THEN TRUE ELSE FALSE END as stage_1_submitted,
  CASE WHEN aws.id IS NOT NULL THEN TRUE ELSE FALSE END as stage_2_summarized,
  CASE WHEN vs.id IS NOT NULL THEN TRUE ELSE FALSE END as stage_3_validated,
  CASE 
    WHEN COUNT(dts.id) = 0 THEN TRUE
    WHEN COUNT(dts.id) = COUNT(dts.id) FILTER (WHERE dts.status = 'completed') THEN TRUE
    ELSE FALSE 
  END as stage_4_subtasks_complete,
  
  -- Timestamps
  cts.submission_timestamp,
  aws.created_at as summary_timestamp,
  vs.submission_timestamp as validation_timestamp,
  
  -- Progress percentage
  CASE
    WHEN cts.id IS NULL THEN 0
    WHEN aws.id IS NULL THEN 25
    WHEN vs.id IS NULL THEN 50
    WHEN COUNT(dts.id) > COUNT(dts.id) FILTER (WHERE dts.status = 'completed') THEN 75
    ELSE 100
  END as completion_percentage

FROM dev_tasks dt
LEFT JOIN claude_task_submissions cts ON dt.id = cts.task_id
LEFT JOIN ai_work_summaries aws ON dt.id = aws.dev_task_id
LEFT JOIN validation_submissions vs ON dt.id = vs.dev_task_id
LEFT JOIN dev_task_subtasks dts ON dt.id = dts.parent_task_id
GROUP BY dt.id, cts.id, aws.id, vs.id;

-- Simple query to use the view
SELECT 
  title,
  worktree_path,
  completion_percentage,
  CASE completion_percentage
    WHEN 0 THEN 'Not Started'
    WHEN 25 THEN 'Awaiting Summary'
    WHEN 50 THEN 'Awaiting Validation'
    WHEN 75 THEN 'Subtasks Pending'
    WHEN 100 THEN 'Complete'
  END as status
FROM dev_task_completion_stages
WHERE completion_percentage < 100
ORDER BY completion_percentage ASC, created_at ASC;
```

## Integration with Existing Tools

### Update Submit Task Command
```typescript
// When submitting a task, automatically create the submission record
async function submitTask(taskId: string) {
  // ... existing submission logic ...
  
  // Track the submission
  await supabase
    .from('claude_task_submissions')
    .insert({
      task_id: taskId,
      submission_timestamp: new Date().toISOString(),
      worktree: getCurrentWorktree(),
      status: 'submitted'
    });
    
  // Update task flags
  await supabase
    .from('dev_tasks')
    .update({ 
      claude_submission_id: submissionId,
      status: 'in_progress'
    })
    .eq('id', taskId);
}
```

### Link Work Summary Automatically
```typescript
// When creating a work summary, link it to the task
async function createWorkSummary(title: string, content: string) {
  // Check if this is related to a dev task
  const taskId = await findRelatedTask(title);
  
  const { data: summary } = await supabase
    .from('ai_work_summaries')
    .insert({
      title,
      content,
      dev_task_id: taskId,
      // ... other fields
    })
    .select()
    .single();
    
  if (taskId) {
    // Update task to indicate it has a summary
    await supabase
      .from('dev_tasks')
      .update({ has_work_summary: true })
      .eq('id', taskId);
  }
}
```

## Summary

This tracking system provides complete visibility into your dev task workflow:

1. **Always know task status** - Which stage each task is in
2. **Find gaps quickly** - Tasks missing summaries or validation
3. **Track true completion** - Not just marked done, but fully validated
4. **Actionable insights** - Always know the next required action

The queries and views provided give you immediate access to the information you need to manage your development workflow effectively.