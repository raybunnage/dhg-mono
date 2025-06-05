# Enhanced Dev Tasks with Git Integration

## Vision

The enhanced Dev Tasks system addresses key workflow challenges in managing concurrent Claude Code sessions by introducing git branch integration, proper task lifecycle management, and automated work summaries. This creates a structured development workflow where each task is isolated in its own git branch, preventing messy commits and enabling granular tracking of changes.

## Key Problems Being Solved

1. **Task Completion Accuracy**: Tasks marked as complete aren't truly complete until tested and verified
2. **Concurrent Session Management**: Multiple Claude sessions create mixed commits with changes from different features
3. **Lack of Git Granularity**: Changes from multiple tasks get bundled into single commits
4. **Task History Tracking**: No connection between tasks and their git history

## Proposed Workflow

### 1. Task Creation with Automatic Branch
```
Create Task → Auto-create git branch → Work in isolated environment → Test → Merge when complete
```

### 2. Task Lifecycle States
- `pending` - Task created, branch created
- `in_progress` - Claude working on implementation
- `testing` - Implementation complete, testing in progress
- `revision` - Issues found, needs additional work
- `completed` - Tested and ready for merge
- `merged` - Successfully merged to main branch

### 3. Multiple Cursor Instances
- Each major task gets its own Cursor instance
- Each instance works on a dedicated feature branch
- Prevents cross-contamination of changes
- Enables parallel development of multiple features

## Database Schema Changes

### Enhanced dev_tasks table
```sql
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS git_branch VARCHAR(255);
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS git_commit_start VARCHAR(40);
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS git_commit_current VARCHAR(40);
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS git_commits_count INTEGER DEFAULT 0;
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES dev_tasks(id);
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS is_subtask BOOLEAN DEFAULT false;
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS testing_notes TEXT;
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;

-- Update status enum to include new states
ALTER TABLE dev_tasks DROP CONSTRAINT IF EXISTS dev_tasks_status_check;
ALTER TABLE dev_tasks ADD CONSTRAINT dev_tasks_status_check 
  CHECK (status IN ('pending', 'in_progress', 'testing', 'revision', 'completed', 'merged', 'cancelled'));
```

### New dev_task_commits table
```sql
CREATE TABLE IF NOT EXISTS dev_task_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  commit_hash VARCHAR(40) NOT NULL,
  commit_message TEXT,
  files_changed INTEGER,
  insertions INTEGER,
  deletions INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_task_commits_task_id ON dev_task_commits(task_id);
```

### New dev_task_work_sessions table
```sql
CREATE TABLE IF NOT EXISTS dev_task_work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  claude_session_id VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  summary TEXT,
  commands_used TEXT[],
  files_modified TEXT[]
);

CREATE INDEX idx_work_sessions_task_id ON dev_task_work_sessions(task_id);
```

## CLI Commands Enhancement

### Enhanced dev-tasks-cli.sh commands

#### Create task with branch
```bash
./dev-tasks-cli.sh create --title "Add feature X" --type "feature" --branch-prefix "feature/"
# Creates task and branch: feature/add-feature-x-abc123
```

#### Update task status with git info
```bash
./dev-tasks-cli.sh update-status <task-id> testing
# Updates status and captures current git state
```

#### Start work session
```bash
./dev-tasks-cli.sh start-session <task-id>
# Checks out branch, starts tracking session
```

#### End work session with summary
```bash
./dev-tasks-cli.sh end-session <task-id> --summary "Implemented user authentication"
# Ends session, commits changes, generates work summary
```

#### Show task with git info
```bash
./dev-tasks-cli.sh show <task-id> --git
# Shows task details including branch, commits, and session history
```

## Implementation Details

### 1. Branch Naming Convention
```
{type}/{kebab-case-title}-{short-task-id}

Examples:
- feature/user-authentication-abc123
- bug/fix-login-error-def456
- docs/api-documentation-ghi789
```

### 2. Git Integration Service
Create `packages/shared/services/git-service/git-service.ts`:

```typescript
export class GitService {
  async createBranch(taskId: string, title: string, type: string): Promise<string> {
    const branchName = this.generateBranchName(taskId, title, type);
    // Implementation
    return branchName;
  }

  async getCurrentBranch(): Promise<string> {
    // Implementation
  }

  async getCommitsSince(startCommit: string): Promise<GitCommit[]> {
    // Implementation
  }

  async switchBranch(branchName: string): Promise<void> {
    // Implementation
  }
}
```

### 3. Task Git Commands
New TypeScript files in `scripts/cli-pipeline/dev_tasks/`:

- `create-with-branch.ts` - Create task and git branch
- `start-session.ts` - Start work session on task
- `end-session.ts` - End work session with summary
- `merge-task.ts` - Merge task branch to main
- `show-git-info.ts` - Show task git details

### 4. Work Summary Integration
When ending a session, automatically:
1. Capture git diff summary
2. List modified files
3. Count commits made
4. Generate AI work summary using the existing work_summaries pipeline
5. Link work summary to task

### 5. Safety Features

#### Pre-commit Check
Before allowing branch switch or merge:
- Check for uncommitted changes
- Verify tests pass (if configured)
- Ensure no merge conflicts

#### Branch Protection
- Prevent deletion of branches with unmerged changes
- Warn before switching branches with uncommitted work
- Auto-stash changes when switching tasks

## Usage Examples

### Typical Workflow

1. **Create a new task with branch**:
```bash
./dev-tasks-cli.sh create --title "Add user profile page" --type "feature" --priority "high"
# Output: Created task abc123 with branch feature/add-user-profile-page-abc123
```

2. **Start working on the task**:
```bash
./dev-tasks-cli.sh start-session abc123
# Switches to branch, starts tracking
```

3. **Work with Claude Code**:
- Copy task details to Claude
- Implement solution
- Make commits as you work

4. **End session when taking a break**:
```bash
./dev-tasks-cli.sh end-session abc123 --summary "Implemented basic profile layout"
```

5. **Continue work later**:
```bash
./dev-tasks-cli.sh start-session abc123
# Resumes on same branch
```

6. **Mark for testing**:
```bash
./dev-tasks-cli.sh update-status abc123 testing --notes "Profile page renders correctly"
```

7. **Complete and merge**:
```bash
./dev-tasks-cli.sh merge-task abc123
# Merges to main branch, marks as merged
```

### Handling Multiple Concurrent Tasks

1. **Task A in Terminal 1**:
```bash
./dev-tasks-cli.sh start-session task-a
# Work on feature A
```

2. **Task B in Terminal 2**:
```bash
./dev-tasks-cli.sh start-session task-b
# Work on feature B in parallel
```

3. **Switch between tasks**:
```bash
./dev-tasks-cli.sh switch-task task-a
# Safely switches branches, stashing if needed
```

## Migration Steps

1. **Add new columns to dev_tasks table**
2. **Create new related tables**
3. **Update CLI commands incrementally**
4. **Test with small tasks first**
5. **Document best practices**

## Future Enhancements

1. **Automated PR Creation**: Create GitHub PRs directly from completed tasks
2. **Task Dependencies**: Link related tasks and manage merge order
3. **Code Review Integration**: Track review comments on task branches
4. **Conflict Resolution**: Automated rebase and conflict detection
5. **Task Templates**: Pre-configured task types with branch patterns

## Benefits

1. **Clean Git History**: Each feature in its own branch with clear commits
2. **Parallel Development**: Work on multiple features without conflicts
3. **Better Testing**: Clear separation between implementation and verification
4. **Audit Trail**: Complete history of what was done for each task
5. **Reduced Errors**: Prevents mixing changes from different features

## Considerations

- Not every small task needs a branch (use judgment)
- Some tasks might be exploratory and not need git tracking
- Emergency fixes might bypass the full workflow
- Documentation tasks might use a simplified flow

This enhanced system maintains the simplicity you love about the current copy-paste workflow while adding the structure needed for managing complex, concurrent development tasks.