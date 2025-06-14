# Dev Task Tracking System - Executive Summary

## Overview

This specification defines a comprehensive tracking system that creates tight coupling between development tasks, Claude AI submissions, work summaries, validation processes, and follow-up subtasks. The system ensures no task falls through the cracks and provides clear visibility into what stage each task is in.

## Quick Answer to Your Requirements

You need a system that shows for each dev task:

1. **Has it been submitted to Claude?** → `has_submission` flag + worktree assignment
2. **What's the work summary result?** → Link to `ai_work_summaries` table
3. **Has validation been requested?** → `has_validation` flag + checklist progress
4. **What sub-tasks remain?** → `dev_task_subtasks` with completion tracking

## Core Components

### 1. **Submission Tracking**
- Records when a task is submitted to Claude
- Tracks which worktree the work is being done in
- Links the submission to the dev task

### 2. **Work Summary Linkage**
- Automatically connects work summaries to their originating tasks
- Tracks files modified and commands used
- Provides traceability from task to implementation

### 3. **Validation Tracking**
- Records when follow-up validation is requested
- Links to clipboard snippets used for validation
- Tracks validation results and issues found

### 4. **Subtask Management**
- Creates subtasks from validation results
- Tracks dependencies between subtasks
- Monitors overall completion status

## The Missing Pieces in Current System

### What We Have Now:
- ✅ Dev tasks table
- ✅ Work summaries table
- ✅ Worktree definitions
- ✅ Clipboard snippets
- ✅ Commit tracking

### What We Need to Add:
- ❌ **Submission tracking** - When/how task was given to Claude
- ❌ **Validation tracking** - Follow-up checklist execution
- ❌ **Sub-task management** - Granular completion tracking
- ❌ **Lifecycle visibility** - Single view of entire process

## Simple Implementation Plan

### Step 1: Add Tracking Flags to dev_tasks
```sql
ALTER TABLE dev_tasks ADD COLUMN has_submission BOOLEAN DEFAULT false;
ALTER TABLE dev_tasks ADD COLUMN has_work_summary BOOLEAN DEFAULT false;
ALTER TABLE dev_tasks ADD COLUMN has_validation BOOLEAN DEFAULT false;
ALTER TABLE dev_tasks ADD COLUMN is_fully_complete BOOLEAN DEFAULT false;
ALTER TABLE dev_tasks ADD COLUMN submission_worktree_id UUID;
```

### Step 2: Create Submission Tracking
```sql
CREATE TABLE dev_task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES dev_tasks(id),
  worktree_id UUID REFERENCES worktree_definitions(id),
  clipboard_snippet_id UUID REFERENCES clipboard_snippets(id),
  submission_content TEXT,
  submission_status TEXT CHECK (submission_status IN ('submitted', 'in_progress', 'completed')),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
```

### Step 3: Create Validation Tracking
```sql
CREATE TABLE dev_task_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES dev_tasks(id),
  clipboard_snippet_id UUID REFERENCES clipboard_snippets(id),
  validation_status TEXT CHECK (validation_status IN ('requested', 'in_progress', 'completed')),
  items_completed INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 0,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dev_task_validation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id UUID REFERENCES dev_task_validations(id),
  item_description TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  result TEXT,
  completed_at TIMESTAMP
);
```

### Step 4: Create Sub-task Tracking
```sql
CREATE TABLE dev_task_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_task_id UUID REFERENCES dev_tasks(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  category TEXT,
  is_blocking BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
```

## What You'll See in the UI

### Task List View
```
┌─────────────────────────────────────────────────────┐
│ Task: Add search to living docs                     │
│                                                     │
│ 📝 Submitted? ✅ (feature/search-docs)             │
│ 📊 Work Summary? ✅ (Created 2 hours ago)          │
│ 🔍 Validated? 🔄 (7/10 items complete)            │
│ 📋 Sub-tasks? 3/5 done (2 blocking)               │
│                                                     │
│ Overall: ████████░░ 80% Complete                   │
└─────────────────────────────────────────────────────┘
```

### CLI Commands You'll Use
```bash
# Submit a task
./dev-tasks-cli.sh submit <task-id> --worktree feature/my-feature

# Check lifecycle status
./dev-tasks-cli.sh lifecycle <task-id>

# Request validation
./dev-tasks-cli.sh validate <task-id> --clipboard "completion-checklist"

# View tasks needing attention
./dev-tasks-cli.sh list --needs-validation
./dev-tasks-cli.sh list --no-work-summary
./dev-tasks-cli.sh list --incomplete-subtasks
```

## The Complete Flow

1. **Create Task** → Record in `dev_tasks`
2. **Submit to Claude** → Create `dev_task_submission` + set worktree
3. **Claude Works** → Creates commits and work summary
4. **Link Summary** → Set `has_work_summary = true`
5. **Request Validation** → Create `dev_task_validation` with checklist
6. **Execute Checklist** → Update `validation_items` as completed
7. **Identify Gaps** → Create `dev_task_subtasks` for remaining work
8. **Complete All** → Set `is_fully_complete = true`

## Key Benefits

### For Task Management
- **Clear Status**: Always know if a task has been submitted, worked on, documented, and validated
- **No Lost Work**: Every piece of work is linked back to its originating task
- **True Completion**: Tasks aren't "done" until all validation and subtasks are complete

### For Workflow Efficiency
- **Next Action Always Clear**: System tells you exactly what needs to be done next
- **Bulk Operations**: Flag all tasks missing summaries or validation at once
- **Progress Tracking**: See completion percentage across all stages

### For Quality Assurance
- **Validation Required**: Tasks can't be fully closed without validation
- **Subtask Tracking**: Complex tasks broken down and tracked individually
- **Audit Trail**: Complete history of submissions, work, and validation

## Implementation Approach

### Phase 1: Core Tracking (Immediate)
- Add tracking fields to existing tables
- Create submission and validation tables
- Implement basic CLI commands

### Phase 2: Automation (Week 1-2)
- Auto-link work summaries to tasks
- Create tracking dashboard
- Add UI indicators

### Phase 3: Advanced Features (Week 3+)
- Subtask dependency management
- Automated validation triggers
- Analytics and reporting

## Key Queries You'll Use Daily

### "What tasks need attention?"
```sql
SELECT title, 
  CASE
    WHEN NOT is_submitted THEN 'Need to submit'
    WHEN NOT has_summary THEN 'Need work summary'
    WHEN NOT is_validated THEN 'Need validation'
    ELSE 'Check subtasks'
  END as action_needed
FROM dev_task_tracking_view
WHERE completion_percentage < 100;
```

### "Show me my pipeline"
```
Not Submitted (3) → In Progress (5) → Need Summary (2) → Need Validation (4) → Done (15)
```

### "What's blocking completion?"
- 3 tasks never submitted to Claude
- 5 tasks worked on but no summary created
- 4 tasks completed but never validated
- 2 tasks with incomplete subtasks

## Success Metrics

1. **Submission Rate**: 100% of tasks have submission records
2. **Documentation Rate**: 100% of completed work has summaries
3. **Validation Rate**: 100% of summaries go through validation
4. **True Completion**: Clear distinction between "marked done" and "actually done"

## Next Steps

1. Review and approve the specification
2. Create database migration for new fields/tables
3. Implement core CLI commands
4. Add UI components to dev tasks page
5. Begin tracking existing tasks

This system transforms dev task management from a simple todo list into a comprehensive workflow tracking system that ensures quality and completeness at every stage.