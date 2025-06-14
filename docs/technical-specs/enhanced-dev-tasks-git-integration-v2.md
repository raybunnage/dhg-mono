# Enhanced Dev Tasks Git Integration V2
*Updated: June 11, 2025*
*Previous Version: June 9, 2025*

## Changes in V2
- Integrated work summary tracking UI requirements
- Added Claude submission timestamp and worktree tracking
- Enhanced git commit linking with visual UI elements
- Added validation and test result tracking integration
- Incorporated follow-up task management

## 1. Overview

This specification enhances the dev_tasks system with comprehensive Git integration and work summary tracking, providing full visibility into the development lifecycle through an intuitive UI.

### 1.1 Core Objectives
- Link tasks to Git commits, branches, and worktrees
- Track Claude Code submissions with timestamps and context
- Visualize work progress through enhanced work summaries
- Enable validation and test result tracking
- Automate follow-up task creation and management

### 1.2 Key Features
1. **Git Integration**: Commits, branches, worktree tracking
2. **Submission Tracking**: Claude Code submission metadata
3. **Work Summary UI**: Visual indicators and progress tracking
4. **Validation Pipeline**: Track validation submissions and results
5. **Test Integration**: Link test results to tasks and summaries
6. **Follow-up Management**: Automated task creation for failed tests

## 2. Enhanced Database Schema

### 2.1 Git and Submission Tracking

```sql
-- Enhanced dev_tasks table with submission tracking
ALTER TABLE dev_tasks 
ADD COLUMN claude_submission_id UUID,
ADD COLUMN claude_submission_timestamp TIMESTAMPTZ,
ADD COLUMN claude_submission_worktree TEXT,
ADD COLUMN claude_submission_status TEXT CHECK (claude_submission_status IN ('pending', 'submitted', 'completed', 'failed')),
ADD COLUMN validation_submission_timestamp TIMESTAMPTZ,
ADD COLUMN test_submission_timestamp TIMESTAMPTZ,
ADD COLUMN documentation_submission_timestamp TIMESTAMPTZ;

-- Enhanced dev_task_commits with submission context
ALTER TABLE dev_task_commits
ADD COLUMN submission_id UUID,
ADD COLUMN submission_worktree TEXT,
ADD COLUMN submission_timestamp TIMESTAMPTZ;

-- Work summary git tracking
CREATE TABLE work_summary_git_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_summary_id UUID REFERENCES ai_work_summaries(id),
  commit_hash TEXT NOT NULL,
  commit_url TEXT,
  branch_name TEXT,
  worktree_path TEXT,
  files_changed INTEGER,
  insertions INTEGER,
  deletions INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submission tracking table
CREATE TABLE claude_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES dev_tasks(id),
  submission_type TEXT CHECK (submission_type IN ('implementation', 'validation', 'testing', 'documentation')),
  worktree_path TEXT NOT NULL,
  branch_name TEXT,
  submission_timestamp TIMESTAMPTZ DEFAULT NOW(),
  completion_timestamp TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  result JSONB,
  git_commit_before TEXT,
  git_commit_after TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Validation and Test Tracking

```sql
-- Validation submission tracking
CREATE TABLE validation_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dev_task_id UUID REFERENCES dev_tasks(id),
  work_summary_id UUID REFERENCES ai_work_summaries(id),
  submission_timestamp TIMESTAMPTZ DEFAULT NOW(),
  worktree_path TEXT,
  validation_type TEXT CHECK (validation_type IN ('code_review', 'automated', 'manual', 'ai_assisted')),
  status TEXT CHECK (status IN ('pending', 'passed', 'failed', 'issues_found')),
  validation_results JSONB,
  issues_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test submission tracking
CREATE TABLE test_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dev_task_id UUID REFERENCES dev_tasks(id),
  work_summary_id UUID REFERENCES ai_work_summaries(id),
  submission_timestamp TIMESTAMPTZ DEFAULT NOW(),
  worktree_path TEXT,
  test_command TEXT,
  test_framework TEXT,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  test_results_id UUID REFERENCES test_results(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 Comprehensive Tracking View

```sql
CREATE OR REPLACE VIEW dev_task_git_tracking_view AS
SELECT 
  dt.id,
  dt.title,
  dt.status,
  dt.worktree,
  dt.git_branch_current,
  dt.git_commits_count,
  
  -- Submission tracking
  dt.claude_submission_timestamp,
  dt.claude_submission_worktree,
  dt.claude_submission_status,
  
  -- Latest commit info
  dtc.commit_hash as latest_commit,
  dtc.commit_message as latest_commit_message,
  dtc.created_at as latest_commit_date,
  
  -- Work summary info
  ws.id as work_summary_id,
  ws.title as work_summary_title,
  ws.created_at as work_summary_date,
  
  -- Validation status
  vs.status as validation_status,
  vs.submission_timestamp as validation_timestamp,
  vs.issues_count as validation_issues,
  
  -- Test status
  tr.passed_count as tests_passed,
  tr.failed_count as tests_failed,
  tr.coverage_percentage as test_coverage,
  ts.submission_timestamp as test_timestamp,
  
  -- Follow-up tasks
  COUNT(DISTINCT dtf.follow_up_task_id) as follow_up_count,
  COUNT(DISTINCT dtf.follow_up_task_id) FILTER (WHERE ft.status = 'completed') as follow_ups_completed,
  
  -- Action indicators
  CASE
    WHEN vs.status = 'issues_found' THEN 'validation_issues'
    WHEN tr.failed_count > 0 THEN 'tests_failing'
    WHEN dt.status = 'in_progress' AND dt.updated_at < NOW() - INTERVAL '7 days' THEN 'stale'
    ELSE 'none'
  END as action_needed

FROM dev_tasks dt
LEFT JOIN LATERAL (
  SELECT * FROM dev_task_commits 
  WHERE task_id = dt.id 
  ORDER BY created_at DESC 
  LIMIT 1
) dtc ON true
LEFT JOIN LATERAL (
  SELECT * FROM ai_work_summaries 
  WHERE dev_task_id = dt.id 
  ORDER BY created_at DESC 
  LIMIT 1
) ws ON true
LEFT JOIN LATERAL (
  SELECT * FROM validation_submissions 
  WHERE dev_task_id = dt.id 
  ORDER BY submission_timestamp DESC 
  LIMIT 1
) vs ON true
LEFT JOIN LATERAL (
  SELECT * FROM test_submissions 
  WHERE dev_task_id = dt.id 
  ORDER BY submission_timestamp DESC 
  LIMIT 1
) ts ON true
LEFT JOIN test_results tr ON ts.test_results_id = tr.id
LEFT JOIN dev_task_follow_ups dtf ON dt.id = dtf.parent_task_id
LEFT JOIN dev_tasks ft ON dtf.follow_up_task_id = ft.id
GROUP BY dt.id, dtc.*, ws.id, ws.title, ws.created_at, vs.*, ts.*, tr.*;
```

## 3. Git Integration Features

### 3.1 Automatic Commit Tracking

```typescript
interface GitCommitTracker {
  // Track commits for a task
  trackCommit(taskId: string, commitInfo: CommitInfo): Promise<void>;
  
  // Link existing commits
  linkCommits(taskId: string, commitHashes: string[]): Promise<void>;
  
  // Get commit history
  getCommitHistory(taskId: string): Promise<CommitInfo[]>;
  
  // Generate commit message with task reference
  generateCommitMessage(taskId: string, message: string): string;
}

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: Date;
  branch: string;
  worktree: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  submissionId?: string;
}
```

### 3.2 Worktree Management

```typescript
interface WorktreeTracker {
  // Get active task for worktree
  getActiveTask(worktreePath: string): Promise<DevTask | null>;
  
  // Track worktree assignment
  assignTaskToWorktree(taskId: string, worktreePath: string): Promise<void>;
  
  // Get all tasks in worktree
  getWorktreeTasks(worktreePath: string): Promise<DevTask[]>;
  
  // Track submission from worktree
  trackSubmission(worktreePath: string, submissionType: string): Promise<string>;
}
```

### 3.3 Branch Tracking

```typescript
interface BranchTracker {
  // Track branch creation
  trackBranchCreation(taskId: string, branchName: string): Promise<void>;
  
  // Update current branch
  updateCurrentBranch(taskId: string, branchName: string): Promise<void>;
  
  // Track branch merges
  trackMerge(taskId: string, sourceBranch: string, targetBranch: string): Promise<void>;
  
  // Get branch history
  getBranchHistory(taskId: string): Promise<BranchEvent[]>;
}
```

## 4. Work Summary Integration

### 4.1 Enhanced Work Summary Creation

```typescript
interface WorkSummaryCreator {
  // Create summary with full tracking
  createWorkSummary(params: {
    taskId: string;
    title: string;
    content: string;
    worktree: string;
    gitCommit?: string;
    filesModified?: string[];
    commandsUsed?: string[];
  }): Promise<WorkSummary>;
  
  // Auto-detect task from content
  detectTaskReference(content: string): string | null;
  
  // Link summary to task
  linkSummaryToTask(summaryId: string, taskId: string): Promise<void>;
}
```

### 4.2 Submission Tracking Integration

```typescript
interface SubmissionTracker {
  // Track Claude submission
  trackClaudeSubmission(params: {
    taskId: string;
    worktree: string;
    submissionType: 'implementation' | 'validation' | 'testing' | 'documentation';
    timestamp?: Date;
  }): Promise<string>;
  
  // Update submission status
  updateSubmissionStatus(submissionId: string, status: string, result?: any): Promise<void>;
  
  // Get submission history
  getSubmissionHistory(taskId: string): Promise<Submission[]>;
}
```

### 4.3 Visual Status Indicators

```typescript
interface StatusIndicatorConfig {
  submission: {
    notSubmitted: { icon: '○', color: 'gray', label: 'Not submitted' },
    submitted: { icon: '◐', color: 'yellow', label: 'Submitted' },
    completed: { icon: '●', color: 'green', label: 'Completed' }
  },
  validation: {
    pending: { icon: '○', color: 'gray', label: 'Pending validation' },
    running: { icon: '◐', color: 'yellow', label: 'Validating' },
    passed: { icon: '●', color: 'green', label: 'Validation passed' },
    failed: { icon: '●', color: 'red', label: 'Validation failed' },
    issuesFound: { icon: '●', color: 'orange', label: 'Issues found' }
  },
  testing: {
    notRun: { icon: '○', color: 'gray', label: 'Tests not run' },
    running: { icon: '◐', color: 'yellow', label: 'Tests running' },
    passed: { icon: '●', color: 'green', label: 'All tests passed' },
    failed: { icon: '●', color: 'red', label: 'Tests failed' },
    partial: { icon: '●', color: 'orange', label: 'Some tests failed' }
  },
  documentation: {
    notStarted: { icon: '○', color: 'gray', label: 'Docs not updated' },
    inProgress: { icon: '◐', color: 'yellow', label: 'Docs in progress' },
    completed: { icon: '●', color: 'green', label: 'Docs updated' }
  }
}
```

## 5. CLI Commands

### 5.1 Git Integration Commands

```bash
# Track commit for task
dev-tasks-cli.sh git track-commit <task-id> <commit-hash>

# Show git history for task
dev-tasks-cli.sh git history <task-id>

# Link task to current branch
dev-tasks-cli.sh git link-branch <task-id>

# Track submission
dev-tasks-cli.sh submit <task-id> --type implementation --worktree .

# Show submission history
dev-tasks-cli.sh submissions <task-id>
```

### 5.2 Work Summary Commands

```bash
# Create work summary with task link
dev-tasks-cli.sh create-summary <task-id> \
  --title "Implement feature X" \
  --content "..." \
  --commit <hash>

# Track validation submission
dev-tasks-cli.sh track-validation <task-id> \
  --status passed \
  --issues 0

# Track test submission
dev-tasks-cli.sh track-tests <task-id> \
  --passed 45 \
  --failed 5 \
  --coverage 90
```

### 5.3 Status Commands

```bash
# Show comprehensive task status
dev-tasks-cli.sh status <task-id> --detailed

# List tasks needing action
dev-tasks-cli.sh list --needs-action

# Show worktree tasks
dev-tasks-cli.sh list --worktree .
```

## 6. Automation Hooks

### 6.1 Git Hooks

```bash
#!/bin/bash
# .git/hooks/post-commit
# Auto-track commits for dev tasks

TASK_ID=$(git log -1 --pretty=%B | grep -oP 'Task:\s*#\K[a-f0-9-]+')
if [ ! -z "$TASK_ID" ]; then
  COMMIT_HASH=$(git rev-parse HEAD)
  WORKTREE=$(pwd)
  dev-tasks-cli.sh git track-commit "$TASK_ID" "$COMMIT_HASH" --worktree "$WORKTREE"
fi
```

### 6.2 Work Summary Automation

```typescript
// Auto-create work summary on session end
async function createSessionWorkSummary(sessionData: {
  taskId: string;
  worktree: string;
  commits: string[];
  filesChanged: string[];
  duration: number;
}) {
  const summary = await generateWorkSummary(sessionData);
  
  return await workSummaryService.create({
    taskId: sessionData.taskId,
    title: `Work session on ${new Date().toLocaleDateString()}`,
    content: summary,
    worktree: sessionData.worktree,
    gitCommit: sessionData.commits[sessionData.commits.length - 1]
  });
}
```

### 6.3 Follow-up Task Automation

```typescript
// Auto-create follow-up tasks based on results
async function createFollowUpTasks(taskId: string, results: {
  validation: ValidationResult;
  tests: TestResult;
}) {
  const followUps: FollowUpTask[] = [];
  
  if (results.validation.status === 'issues_found') {
    followUps.push({
      type: 'validation',
      title: `Fix ${results.validation.issueCount} validation issues`,
      priority: 'high'
    });
  }
  
  if (results.tests.failedCount > 0) {
    followUps.push({
      type: 'testing',
      title: `Fix ${results.tests.failedCount} failing tests`,
      priority: 'high'
    });
  }
  
  return await Promise.all(
    followUps.map(fu => createFollowUpTask(taskId, fu))
  );
}
```

## 7. UI Components

### 7.1 Git Integration Panel

```typescript
interface GitIntegrationPanel {
  taskId: string;
  currentBranch: string;
  commits: CommitInfo[];
  worktree: string;
  lastSubmission?: SubmissionInfo;
  
  onTrackCommit: (hash: string) => void;
  onCreateBranch: (name: string) => void;
  onLinkWorktree: (path: string) => void;
}

// Visual layout:
// ┌─────────────────────────────────────────┐
// │ Git Integration                         │
// ├─────────────────────────────────────────┤
// │ 🌿 Branch: feature/task-123             │
// │ 📁 Worktree: ~/dhg-mono-improve-cli     │
// │ 🔗 Commits: 5                           │
// ├─────────────────────────────────────────┤
// │ Recent Commits:                         │
// │ • abc123 - Fix validation errors        │
// │ • def456 - Implement core feature       │
// │ • ghi789 - Initial task setup           │
// ├─────────────────────────────────────────┤
// │ Last Submission: 6/11 10:30 AM          │
// │ Type: Implementation                    │
// │ Status: Completed ✓                     │
// └─────────────────────────────────────────┘
```

### 7.2 Submission Timeline

```typescript
interface SubmissionTimeline {
  submissions: Array<{
    id: string;
    type: 'implementation' | 'validation' | 'testing' | 'documentation';
    timestamp: Date;
    worktree: string;
    status: string;
    result?: any;
  }>;
  
  onViewDetails: (submissionId: string) => void;
}

// Visual representation:
// ─────●─────●─────◐─────○─────
//     impl  val   test  docs
//     ✓     ✓     ...   pending
```

## 8. Integration Points

### 8.1 Claude Code Integration

```typescript
// Track Claude submissions automatically
interface ClaudeIntegration {
  beforeSubmission(task: DevTask): void {
    // Record submission start
    trackSubmission({
      taskId: task.id,
      type: 'implementation',
      worktree: getCurrentWorktree(),
      timestamp: new Date()
    });
  }
  
  afterSubmission(task: DevTask, result: any): void {
    // Update submission status
    updateSubmissionStatus(task.currentSubmissionId, 'completed', result);
    
    // Auto-create work summary if configured
    if (task.autoCreateWorkSummary) {
      createWorkSummaryFromSubmission(task, result);
    }
  }
}
```

### 8.2 CI/CD Integration

```yaml
# GitHub Actions integration
name: Track Task Progress
on:
  push:
    branches: ['**']

jobs:
  track-progress:
    runs-on: ubuntu-latest
    steps:
      - name: Extract task ID
        id: task
        run: |
          TASK_ID=$(echo "${{ github.event.head_commit.message }}" | grep -oP 'Task:\s*#\K[a-f0-9-]+')
          echo "task_id=$TASK_ID" >> $GITHUB_OUTPUT
      
      - name: Track commit
        if: steps.task.outputs.task_id != ''
        run: |
          dev-tasks-cli.sh git track-commit \
            ${{ steps.task.outputs.task_id }} \
            ${{ github.sha }} \
            --branch ${{ github.ref_name }}
```

## 9. Performance Considerations

### 9.1 Indexing Strategy

```sql
-- Optimize git tracking queries
CREATE INDEX idx_dev_tasks_git_branch ON dev_tasks(git_branch_current);
CREATE INDEX idx_dev_tasks_worktree ON dev_tasks(worktree);
CREATE INDEX idx_dev_task_commits_hash ON dev_task_commits(commit_hash);
CREATE INDEX idx_claude_submissions_task_timestamp ON claude_submissions(task_id, submission_timestamp DESC);

-- Optimize work summary lookups
CREATE INDEX idx_work_summaries_task_id ON ai_work_summaries(dev_task_id);
CREATE INDEX idx_work_summary_git_links_summary ON work_summary_git_links(work_summary_id);
```

### 9.2 Caching Strategy

```typescript
interface GitDataCache {
  // Cache commit data for 5 minutes
  commits: CacheLayer<string, CommitInfo[]>;
  
  // Cache branch info for 1 minute
  branches: CacheLayer<string, BranchInfo>;
  
  // Cache submission data for 10 minutes
  submissions: CacheLayer<string, Submission[]>;
}
```

## 10. Success Metrics

- **Git Integration**: 100% of commits linked to tasks
- **Submission Tracking**: All Claude submissions recorded
- **Work Summary Links**: 95%+ summaries linked to tasks
- **Follow-up Creation**: Automated for all failed tests/validations
- **UI Performance**: <100ms render time for tracking panels
- **Data Completeness**: Full lifecycle data for 90%+ tasks

This enhanced specification provides comprehensive Git integration with work summary tracking UI, enabling developers to have full visibility into their task lifecycle while maintaining efficient workflows.