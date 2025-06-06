# Task-Commit Integration Guide

## Overview
This system automatically links git commits to development tasks, creating a traceable history of work done for each task.

## Two Ways to Use

### 1. Using the CLI Command (Recommended)
When you have changes ready to commit and an active task:

```bash
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh commit "Your commit message here"
```

This command will:
- Find any active task in your current worktree
- Add the task ID to your commit message
- Create the commit
- Log the commit details in the `dev_task_commits` table
- Update the task's commit count

### 2. Manual Commit with Task Reference
If committing manually, include the task reference in your commit message:

```bash
git commit -m "[TASK-<task_number>] Your commit message

Task ID: <full-task-id>"
```

## Prompt Template for Claude Code

When asking Claude to commit changes, use this enhanced prompt:

```
Please commit the changes on this branch. 

First, check if there's an active task (status = 'in_progress') in this worktree by running:
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh list --status in_progress

If a task is found, use:
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh commit "Your descriptive commit message"

If no active task is found, use a regular git commit.
```

## How It Works

1. **Task Detection**: The system looks for tasks with:
   - `status = 'in_progress'`
   - `worktree_path` matching the current directory

2. **Commit Formatting**: Commits are formatted as:
   ```
   [TASK-123] Fix authentication bug
   
   Related to: Implement OAuth2 login flow
   Task ID: d4d49d84-a808-4a12-bd78-9702f4a09b8e
   ```

3. **Database Updates**:
   - Adds entry to `dev_task_commits` table with full commit details
   - Updates task's `git_commit_current` and `git_commits_count`
   - Tracks files changed, insertions, and deletions

## Benefits

- **Automatic Linking**: No need to manually track which commits belong to which tasks
- **Full History**: Every commit is logged with detailed metadata
- **UI Integration**: The task detail page shows all related commits
- **Metrics**: Track lines added/removed per task
- **Git Integration**: Works with your normal git workflow

## Database Schema

The system uses these tables:
- `dev_tasks`: Main task table with git tracking fields
- `dev_task_commits`: Individual commits linked to tasks
- `dev_task_work_sessions`: Claude Code work sessions

## Example Workflow

1. Create a task with branch:
   ```bash
   ./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh create-with-branch "Fix auth bug" "Users can't login"
   ```

2. Work on the task (Claude makes changes)

3. Commit with task linking:
   ```bash
   ./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh commit "Fix OAuth redirect URL validation"
   ```

4. View task with commit history:
   ```bash
   ./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh show <task-id>
   ```