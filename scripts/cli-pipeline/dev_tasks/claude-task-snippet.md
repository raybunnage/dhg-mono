# Enhanced Claude Code Task Snippet with Auto-Submit

## Option 1: Simple Copy/Paste Snippet

When you have a task ID, use this format - just replace `YOUR_TASK_ID` with the actual ID:

```bash
# First, submit the task to track it (replace YOUR_TASK_ID)
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh submit YOUR_TASK_ID --text "
# Task: [Title]
ID: YOUR_TASK_ID
Type: [bug/feature/refactoring/documentation]
Priority: [low/medium/high/critical]

## Description
[Your task description here]

## Context
[Any additional context]

Created: $(date +%m/%d/%Y)
"
```

## Option 2: Two-Step Process (Recommended)

1. First, create the task and get the ID:
```bash
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh create-with-branch "Your task title" "Task description" --type feature --priority medium
```

2. Then use the task ID in the snippet below and paste to Claude:

```
# Task: [Title from step 1]
ID: [Task ID from step 1]
Type: feature
Priority: medium

## Description
[Task description from step 1]

## Context
[Add any additional context here]

Created: [Today's date]
```

## Option 3: Script-Based Workflow

Create a file `submit-to-claude.sh` in your project:

```bash
#!/bin/bash

# Usage: ./submit-to-claude.sh <task-id>

TASK_ID=$1
if [ -z "$TASK_ID" ]; then
    echo "Usage: ./submit-to-claude.sh <task-id>"
    exit 1
fi

# Get task details
TASK_CONTENT=$(./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh copy-request $TASK_ID)

# Submit to tracking
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh submit $TASK_ID --text "$TASK_CONTENT"

# Copy to clipboard (macOS)
echo "$TASK_CONTENT" | pbcopy

echo "✅ Task submitted and copied to clipboard!"
echo "📋 Now paste into Claude Code"
```

## Recovery Commands

If Claude Code times out or goes offline:

```bash
# Find interrupted tasks (default: 30 minutes inactive)
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh submit recover

# Find interrupted tasks in specific worktree
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh submit recover my-worktree

# Find tasks inactive for more than 60 minutes
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh submit recover --minutes 60

# Manually update activity (if still working)
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh submit update-activity <task-id>
```

## Best Practices

1. **Always submit before pasting to Claude** - This creates a recovery point
2. **Use the worktree option** if working in a specific worktree
3. **Check for interrupted tasks** before starting new work
4. **The `.claude-submission-*.json` files** are created locally for additional recovery options

## Example Full Workflow

```bash
# 1. Create task
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh create-with-branch "Fix auth timeout" "Users getting logged out too quickly" --type bug --priority high

# Output: Created task: 1ed0c9d6-1b03-41ee-8d04-abce8b622cca

# 2. Submit to tracking
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh submit 1ed0c9d6-1b03-41ee-8d04-abce8b622cca --text "
# Task: Fix auth timeout
ID: 1ed0c9d6-1b03-41ee-8d04-abce8b622cca
Type: bug
Priority: high

## Description
Users getting logged out too quickly

## Context
Multiple reports of users being logged out after only 5 minutes of inactivity

Created: $(date +%m/%d/%Y)
"

# 3. Copy the task format and paste to Claude Code
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh copy-request 1ed0c9d6-1b03-41ee-8d04-abce8b622cca

# 4. If Claude times out, recover:
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh submit recover
```