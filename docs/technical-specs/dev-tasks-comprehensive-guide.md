# Dev Tasks Comprehensive Guide

## Overview

The Dev Tasks system provides a structured way to manage Claude Code development tasks, bridging the gap between task tracking and AI-assisted development. It consists of:

1. **Database tables** (`dev_tasks`, `dev_task_tags`, `dev_task_files`)
2. **CLI commands** for task management
3. **UI interface** in dhg-admin-code app
4. **Integration** with AI work summaries

## Database Schema

```sql
-- Main task table
dev_tasks:
  - id: UUID (primary key)
  - title: VARCHAR(255)
  - description: TEXT
  - task_type: VARCHAR(50) -- bug, feature, refactor, question
  - status: VARCHAR(50) -- pending, in_progress, completed
  - priority: VARCHAR(20) -- low, medium, high
  - claude_request: TEXT -- Formatted request for Claude
  - claude_response: TEXT -- Claude's response/summary
  - started_at: TIMESTAMP
  - completed_at: TIMESTAMP
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  - created_by: UUID (references auth.users)

-- Task tagging
dev_task_tags:
  - id: UUID (primary key)
  - task_id: UUID (references dev_tasks)
  - tag: VARCHAR(50)
  - created_at: TIMESTAMP

-- File tracking
dev_task_files:
  - id: UUID (primary key)
  - task_id: UUID (references dev_tasks)
  - file_path: TEXT
  - action: VARCHAR(20) -- created, modified, deleted
  - created_at: TIMESTAMP
```

## CLI Commands

### Installation & Access

```bash
# Navigate to the CLI
cd scripts/cli-pipeline/dev_tasks

# Make it executable (already done)
chmod +x dev-tasks-cli.sh

# View help
./dev-tasks-cli.sh help
```

### Command Reference

#### 1. Create Task
```bash
./dev-tasks-cli.sh create \
  --title "Fix authentication flow" \
  --description "Users can't log in with Google OAuth. Need to check Supabase settings." \
  --type bug \
  --priority high \
  --tags "auth,urgent"
```

Options:
- `--title` (required): Short, descriptive title
- `--description` (required): Detailed description
- `--type`: bug, feature, refactor, question (default: feature)
- `--priority`: low, medium, high (default: medium)
- `--tags`: Comma-separated tags

#### 2. List Tasks
```bash
# List all pending tasks
./dev-tasks-cli.sh list --status pending

# List high-priority bugs
./dev-tasks-cli.sh list --type bug --priority high

# List tasks with specific tag
./dev-tasks-cli.sh list --tag authentication

# Limit results
./dev-tasks-cli.sh list --limit 10
```

#### 3. Update Task
```bash
# Mark as in progress
./dev-tasks-cli.sh update <task-id> --status in_progress

# Change priority
./dev-tasks-cli.sh update <task-id> --priority high

# Add a tag
./dev-tasks-cli.sh update <task-id> --add-tag "needs-review"
```

#### 4. Show Task Details
```bash
./dev-tasks-cli.sh show <task-id>
```

Displays:
- Full task details
- Claude request/response
- Tags and files
- Next recommended actions

#### 5. Copy Request to Claude
```bash
# Display formatted request
./dev-tasks-cli.sh copy-request <task-id>

# Copy to clipboard (macOS only)
./dev-tasks-cli.sh copy-request <task-id> --clipboard
```

#### 6. Add Affected Files
```bash
# Single file
./dev-tasks-cli.sh add-file <task-id> \
  --path "apps/dhg-hub/src/auth/oauth.ts" \
  --action modified

# Multiple files
./dev-tasks-cli.sh add-file <task-id> \
  --paths "file1.ts,file2.ts,file3.ts" \
  --action created
```

Actions: created, modified, deleted

#### 7. Complete Task
```bash
# With inline response
./dev-tasks-cli.sh complete <task-id> \
  --response "Fixed OAuth by updating redirect URLs in Supabase..."

# With response file
./dev-tasks-cli.sh complete <task-id> \
  --response-file claude-response.txt
```

## Workflow Examples

### Example 1: Bug Fix Workflow

```bash
# 1. Create bug task
./dev-tasks-cli.sh create \
  --title "Fix login redirect loop" \
  --description "Users get stuck in redirect loop after Google OAuth" \
  --type bug \
  --priority high \
  --tags "auth,production"

# Output: Task created: abc-123-def

# 2. Copy request to Claude
./dev-tasks-cli.sh copy-request abc-123-def

# 3. Update status while working
./dev-tasks-cli.sh update abc-123-def --status in_progress

# 4. Track affected files as you work
./dev-tasks-cli.sh add-file abc-123-def \
  --path "apps/dhg-hub/src/auth/callback.tsx" \
  --action modified

# 5. Complete with Claude's summary
./dev-tasks-cli.sh complete abc-123-def \
  --response "Fixed redirect loop by correcting callback URL handling..."
```

### Example 2: Feature Development

```bash
# 1. Create feature task
./dev-tasks-cli.sh create \
  --title "Add export to CSV functionality" \
  --description "Users need to export search results to CSV format" \
  --type feature \
  --priority medium \
  --tags "export,ui"

# 2. Show task details
./dev-tasks-cli.sh show feature-id-here

# 3. Work with Claude (copy request)
./dev-tasks-cli.sh copy-request feature-id-here

# 4. Track multiple new files
./dev-tasks-cli.sh add-file feature-id-here \
  --paths "utils/csv-export.ts,components/ExportButton.tsx" \
  --action created

# 5. Complete task
./dev-tasks-cli.sh complete feature-id-here \
  --response "Implemented CSV export with proper data formatting..."
```

## Integration with dhg-admin-suite

### Proposed Dashboard Components

#### 1. Task Overview Widget
```typescript
// Shows task statistics
- Total tasks by status
- Tasks by priority
- Recent completions
- Average completion time
```

#### 2. Active Tasks List
```typescript
// Quick access to in-progress work
- Sortable by priority/created date
- Quick status updates
- Copy request button
- Direct complete button
```

#### 3. Task Analytics
```typescript
// Insights into development patterns
- Tasks completed per week
- Common task types
- Most used tags
- File change patterns
```

#### 4. Quick Create Form
```typescript
// Streamlined task creation
- Template selection
- Auto-tag suggestions
- Priority recommendations
- Recent similar tasks
```

### Implementation in dhg-admin-suite

Add to `apps/dhg-admin-suite/src/pages/DashboardPage.tsx`:

```typescript
import { DevTasksWidget } from '../components/DevTasksWidget';
import { TaskQuickCreate } from '../components/TaskQuickCreate';

// In the dashboard grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <DevTasksWidget />
  <TaskQuickCreate />
</div>
```

## Best Practices

### 1. Task Creation
- Use clear, searchable titles
- Include context in descriptions
- Choose appropriate type and priority
- Add relevant tags for filtering

### 2. Working with Claude
- Always copy the formatted request
- Update status to in_progress
- Track files as you modify them
- Save Claude's final summary

### 3. Task Completion
- Include comprehensive summary
- List all affected files
- Auto-creates work summary for reporting

### 4. Tag Conventions
Common tags to use:
- `auth` - Authentication related
- `ui` - User interface changes
- `database` - Schema or query changes
- `cli` - Command line tools
- `refactor` - Code reorganization
- `performance` - Optimization work
- `urgent` - High priority items
- `research` - Investigation tasks

## Advanced Features

### 1. Batch Operations
```bash
# Complete multiple tasks (coming soon)
./dev-tasks-cli.sh batch-complete --ids "id1,id2,id3"
```

### 2. Export Tasks
```bash
# Export to markdown (coming soon)
./dev-tasks-cli.sh export --format markdown --status completed
```

### 3. Task Templates
```bash
# Create from template (coming soon)
./dev-tasks-cli.sh create --template bug-fix
```

## Integration with Work Summaries

When completing tasks, the system automatically:
1. Creates an entry in `ai_work_summaries`
2. Extracts key information from Claude's response
3. Links the summary to the original task
4. Maintains searchable history

This provides:
- Unified reporting across all AI work
- Searchable knowledge base
- Pattern recognition for similar issues

## Command Tracking

All CLI commands are automatically tracked:
- Command usage statistics
- User patterns
- Performance metrics
- Error tracking

View statistics:
```bash
./scripts/cli-pipeline/database/database-cli.sh command-stats
```

## Troubleshooting

### Common Issues

1. **Task not found**
   - Verify task ID with `list` command
   - Check if task was deleted

2. **Cannot update completed task**
   - Completed tasks are immutable
   - Create new task for follow-up work

3. **File tracking duplicates**
   - System prevents duplicate file entries
   - Warning shown but operation continues

### Database Queries

```sql
-- Find tasks by partial title
SELECT * FROM dev_tasks 
WHERE title ILIKE '%auth%' 
ORDER BY created_at DESC;

-- Tasks with specific tag
SELECT t.*, array_agg(tt.tag) as tags
FROM dev_tasks t
LEFT JOIN dev_task_tags tt ON t.id = tt.task_id
GROUP BY t.id
HAVING 'urgent' = ANY(array_agg(tt.tag));

-- Task completion metrics
SELECT 
  task_type,
  COUNT(*) as total,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::int as avg_hours
FROM dev_tasks
WHERE status = 'completed'
GROUP BY task_type;
```

## Future Enhancements

### Phase 2 (Planned)
- Git branch integration
- Automatic file detection from git diff
- Claude conversation threading
- Time tracking
- Task dependencies

### Phase 3 (Conceptual)
- AI-suggested solutions from similar tasks
- Automatic PR description generation
- Integration with GitHub issues
- Team collaboration features

## Summary

The Dev Tasks system provides a lightweight but powerful way to:
1. Track all Claude Code development work
2. Maintain structured communication with AI
3. Build a searchable knowledge base
4. Generate work summaries automatically
5. Analyze development patterns

Use it consistently to maximize the value of your AI-assisted development workflow!