# Dev Task Tracking Summary - What You Need to Know

## Quick Answer to Your Requirements

You need a system that shows for each dev task:

1. **Has it been submitted to Claude?** → `has_submission` flag + worktree assignment
2. **What's the work summary result?** → Link to `ai_work_summaries` table
3. **Has validation been requested?** → `has_validation` flag + checklist progress
4. **What sub-tasks remain?** → `dev_task_subtasks` with completion tracking

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

- **Never lose track** of what's been submitted where
- **See gaps instantly** - what hasn't been validated yet
- **Track granularly** - which specific validation items failed
- **Plan next steps** - sub-tasks show what remains
- **Measure velocity** - how long from submission to completion

This gives you the complete visibility you need into the dev task lifecycle!