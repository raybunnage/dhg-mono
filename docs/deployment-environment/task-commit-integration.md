# Task-Commit Integration

## Overview

The task-commit integration automatically links git commits to development tasks, making it easy to track which commits solved which tasks. This is especially useful when working across multiple worktrees.

## How It Works

1. **Task Creation**: When you create a task, it's associated with a specific worktree path
2. **Commit Time**: When committing, the CLI checks for active tasks in the current worktree
3. **Task Selection**: You select which task the commit relates to (or none)
4. **Commit Message**: The task ID is included in the commit message
5. **Task Update**: The task notes are updated with the commit SHA

## Usage

### Creating a Commit with Task Tracking

```bash
# Instead of regular git commit, use:
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh commit
```

The CLI will:
1. Show all active tasks in your current worktree
2. Let you select the relevant task
3. Display the task ID to include in your commit message
4. After committing, update the task with the commit SHA

### Example Workflow

```bash
# 1. Create a task (already done via UI)
# Task ID: 07832f16-301d-4a77-8c97-67f84725fe37

# 2. Make your changes
vim apps/dhg-admin-code/src/pages/CreateTaskPage.tsx

# 3. Stage changes
git add -A

# 4. Use task-aware commit
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh commit

# Output:
# 🌳 Current worktree: /Users/raybunnage/Documents/github/dhg-mono-admin-code
# 
# 📋 Found 1 active task in this worktree:
#    Fix worktree dropdown in CreateTaskPage (feature)
# 
# Use this task for the commit? (Y/n): y
# 
# ✅ Selected task: Fix worktree dropdown in CreateTaskPage
#    ID: 07832f16-301d-4a77-8c97-67f84725fe37
# 
# 📝 Add this to your commit message:
# Task: #07832f16-301d-4a77-8c97-67f84725fe37

# 5. Create your commit with the task ID
git commit -m "fix: replace worktree hook with direct data fetching

Task: #07832f16-301d-4a77-8c97-67f84725fe37

- Remove problematic useWorktreeMappings hook
- Implement direct Supabase data fetching
- Fix TypeScript errors

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 6. Confirm to update task
# Have you made the commit? (y/N): y
# ✅ Task updated with commit reference
```

## Commit Message Format

Always include the task ID on its own line:

```
<type>: <subject>

Task: #<task-id>

<body>

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Benefits

1. **Traceability**: Easy to find which commits solved which tasks
2. **History**: Task notes contain commit SHAs for reference
3. **Worktree-Aware**: Automatically filters tasks by current worktree
4. **Optional**: Can skip task linking for unrelated commits

## Database Schema

Tasks are linked to commits through:
- `dev_tasks.worktree_path` - Associates task with worktree
- `dev_tasks.notes` - Stores commit SHA references
- Task ID in commit message - Links commit back to task

## Future Enhancements

- Automatic task status updates (pending → in_progress → completed)
- Multiple commit tracking per task
- Commit statistics (files changed, insertions, deletions)
- Integration with git hooks for automatic tracking