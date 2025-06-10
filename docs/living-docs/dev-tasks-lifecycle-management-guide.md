# Dev Tasks Lifecycle Management Guide

> Living Document - Last Updated: 2025-06-09
> This document provides systematic guidance for moving development tasks through verification and testing stages

## Current Status: Implementation Gap Analysis

**Current State**: Tasks are primarily in three states:
- `pending` (28 tasks) - Created but not started
- `completed` (123 tasks) - Finished by Claude
- `testing` (1 task) - In testing phase (underutilized)

**Missing States**: The system doesn't currently use:
- `in_progress` - Active development
- `verified` - Testing complete and verified
- `review` - Code review stage
- `blocked` - Task blocked by dependencies

## Task Lifecycle Workflow

### 1. Task Creation → Pending
**Status**: `pending`
**Actions**:
```bash
# Create task with clear success criteria
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh create-with-branch \
  "Title" "Description" --type feature --priority high

# Add specific success criteria
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh success-criteria <task-id> \
  --add "Unit tests pass" \
  --add "No TypeScript errors" \
  --add "Feature works as described"
```

### 2. Development Start → In Progress
**Status**: `in_progress`
**Actions**:
```bash
# Start work session (switches to branch)
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh start-session <task-id>

# Update status
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh update <task-id> --status in_progress
```

**Claude Integration**:
- Copy task to Claude: `./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh copy-request <task-id>`
- Track commits: Task ID automatically linked via commit messages

### 3. Development Complete → Testing
**Status**: `testing`
**Actions**:
```bash
# Mark development complete, move to testing
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh update <task-id> --status testing

# Run verification checks
tsc --noEmit  # TypeScript check
pnpm test     # If tests exist
```

**Testing Checklist**:
- [ ] TypeScript compiles without errors
- [ ] Linting passes (if configured)
- [ ] Manual testing confirms feature works
- [ ] No hardcoded credentials
- [ ] Success criteria are met

### 4. Testing Complete → Verified
**Status**: `verified`
**Actions**:
```bash
# Update to verified status
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh update <task-id> --status verified

# Add testing notes
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh add-file <task-id> \
  --path "testing-results.md" --action "tested"
```

### 5. Final Completion → Completed
**Status**: `completed`
**Actions**:
```bash
# Complete with Claude's response
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh complete <task-id> \
  --response "Implementation details and final notes..."

# Task automatically marked as completed
```

## Systematic Verification Process

### Before Moving to Testing
1. **Code Quality Checks**:
   ```bash
   # TypeScript validation
   tsc --noEmit
   
   # Check for hardcoded secrets
   grep -r "SUPABASE_" --include="*.ts" --include="*.tsx" | grep -v ".env"
   ```

2. **Success Criteria Review**:
   ```bash
   # Show task with success criteria
   ./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh show <task-id>
   ```

3. **Git History Check**:
   ```bash
   # View commits for this task
   git log --oneline --grep="Task: #<task-id>"
   ```

### Testing Phase Activities
1. **Functional Testing**:
   - Run the actual feature/fix
   - Verify it solves the original problem
   - Check edge cases

2. **Integration Testing**:
   - Ensure no breaking changes
   - Test with real data
   - Verify database operations

3. **Documentation Check**:
   - Update CLAUDE.md if needed
   - Add to relevant living docs
   - Update inline comments

## Recommended Status Workflow Enhancement

### Current Simple Flow:
```
pending → completed
```

### Enhanced Systematic Flow:
```
pending → in_progress → testing → verified → completed
          ↓
        blocked (if dependencies exist)
```

### Implementation Steps:
1. **Update CLI to support new statuses**:
   - Modify `update-task.ts` to include new status values
   - Add validation for status transitions

2. **Create status transition rules**:
   - Can't go from pending → completed without in_progress
   - Must pass through testing before verified
   - Blocked tasks need unblocking reason

3. **Add automated checks**:
   - Git hooks to enforce TypeScript checks
   - Pre-commit validation of success criteria
   - Automatic status updates based on CI results

## Quick Commands Reference

```bash
# Start work on a task
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh start-session <task-id>

# Update status as you progress
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh update <task-id> --status in_progress
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh update <task-id> --status testing
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh update <task-id> --status verified

# Add success criteria
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh success-criteria <task-id> --add "Criteria description"

# Complete with notes
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh complete <task-id> --response "Final implementation notes"
```

## Next Steps for Implementation

1. **Database Schema Update**: Add the missing status values to the enum
2. **CLI Enhancement**: Update commands to support new statuses
3. **Automation**: Create git hooks for automatic status transitions
4. **Dashboard**: Build a visual task board in dhg-admin-suite
5. **Reporting**: Add metrics for time spent in each status

## Living Document Updates

This document will be continuously updated with:
- New status workflow patterns that emerge
- Automation improvements
- Testing best practices
- Integration with other systems (CI/CD, etc.)

Last verification run: 2025-06-09