# Service Cleanup Git Checkpoint Workflow

## Overview

This document defines strategic git commit checkpoints throughout the service cleanup process to enable safe rollback at any stage. Each worktree follows this pattern independently, allowing 3-4 parallel cleanup efforts.

## Git Checkpoint Strategy

### Checkpoint 0: Pre-Cleanup Baseline
```bash
# Ensure clean state before starting
git status
git add -A
git commit -m "chore: checkpoint before ${SERVICE_NAME} cleanup

Capturing current state for potential rollback
Service: ${SERVICE_NAME}
Usage count: ${USAGE_COUNT}
Current location: ${CURRENT_PATH}"
```

### Checkpoint 1: Service Migration Complete
```bash
# After moving service to shared location
git add packages/shared/services/${SERVICE_NAME}
git commit -m "feat: migrate ${SERVICE_NAME} to shared services

- Moved from ${OLD_PATH} to packages/shared/services/
- Preserved all functionality
- No breaking changes yet"
```

### Checkpoint 2: Import Updates Complete
```bash
# After updating all imports
git add -A
git commit -m "refactor: update all ${SERVICE_NAME} imports

- Updated ${IMPORT_COUNT} imports to use new path
- All imports now use @shared/services/${SERVICE_NAME}
- TypeScript compilation passes"
```

### Checkpoint 3: Tests Added
```bash
# After adding integration tests
git add apps/dhg-service-test/src/components/Test${SERVICE_NAME}.tsx
git add -A
git commit -m "test: add ${SERVICE_NAME} integration tests

- Created comprehensive test suite
- Tests singleton pattern (if applicable)
- Tests all public methods
- Performance metrics included"
```

### Checkpoint 4: Validation Passed
```bash
# After all validation checks pass
git add -A
git commit -m "fix: ${SERVICE_NAME} cleanup validation complete

✅ TypeScript compilation: PASS
✅ Import validation: PASS
✅ Unit tests: PASS
✅ Integration tests: PASS
✅ Runtime validation: PASS

All validation checks passing"
```

### Checkpoint 5: Visual Confirmation
```bash
# After visual confirmation in UI
git add -A
git commit -m "docs: ${SERVICE_NAME} visual confirmation complete

- Test results visible in dhg-service-test UI
- All tests showing green status
- Performance metrics acceptable
- Screenshot: ${SCREENSHOT_PATH} (if applicable)"
```

### Checkpoint 6: Production Verified
```bash
# After production testing
git add -A
git commit -m "verify: ${SERVICE_NAME} production validation complete

- Tested in production app usage
- No regressions found
- Performance maintained or improved
- Ready for monitoring setup"
```

### Checkpoint 7: Cleanup Finalized
```bash
# Archive old files and finalize
git add scripts/cli-pipeline/shared/services/.archived_scripts/
git rm ${OLD_SERVICE_PATH}
git commit -m "chore: finalize ${SERVICE_NAME} cleanup

- Archived old service location
- Updated sys_shared_services metadata
- Configured monitoring
- Cleanup complete"
```

## Rollback Procedures

### Quick Rollback Commands
```bash
# View checkpoint history
git log --oneline | grep -E "(${SERVICE_NAME}|checkpoint)"

# Rollback to specific checkpoint
git reset --hard <commit-hash>

# Rollback to pre-cleanup state
git reset --hard $(git log --oneline | grep "checkpoint before ${SERVICE_NAME}" | head -1 | cut -d' ' -f1)
```

### Safe Rollback Process
```bash
# 1. Stash any uncommitted changes
git stash

# 2. Create rollback branch
git checkout -b rollback/${SERVICE_NAME}-$(date +%Y%m%d)

# 3. Reset to checkpoint
git reset --hard <checkpoint-commit>

# 4. Test the rollback
npm run test

# 5. If good, update main branch
git checkout main
git reset --hard rollback/${SERVICE_NAME}-$(date +%Y%m%d)
```

## Worktree-Specific Workflow

### Managing Multiple Worktrees
```bash
# Each worktree maintains its own checkpoint history
cd ~/dhg-mono-${WORKTREE_NAME}

# View worktree-specific status
git worktree list
git branch -vv

# Checkpoint with worktree context
git commit -m "chore: [${WORKTREE_NAME}] checkpoint before ${SERVICE_NAME} cleanup"
```

### Parallel Cleanup Tracking
```bash
# Track cleanup progress across worktrees
for worktree in $(git worktree list | awk '{print $1}'); do
  echo "=== $worktree ==="
  cd $worktree
  git log --oneline -5 | grep -E "(cleanup|checkpoint)"
done
```

## Integration with Cleanup Tracker

### Automatic Checkpoint Creation
```bash
# Enhanced cleanup tracker with git integration
./service-cleanup-tracker.ts checkpoint ${SERVICE_NAME} --stage "migration-complete"
```

This automatically:
1. Creates appropriate commit message
2. Stages relevant files
3. Creates commit
4. Updates tracking database

### Checkpoint Status Dashboard
The dhg-admin-code displays:
- Current checkpoint for each service
- Rollback availability
- Worktree progress comparison
- Risk assessment for each stage

## Best Practices

### 1. Atomic Commits
- Each checkpoint should be independently revertable
- Don't combine multiple services in one commit
- Keep commits focused on single stage

### 2. Descriptive Messages
- Include service name
- Include stage identifier
- Include validation results where applicable
- Use conventional commit format

### 3. Regular Pushes
```bash
# Push after each major checkpoint
git push origin ${BRANCH_NAME}

# But NOT to development until fully validated
git push origin ${BRANCH_NAME}:development  # Only after Checkpoint 6
```

### 4. Worktree Coordination
- Check other worktree progress before major changes
- Communicate checkpoint status in shared tracking
- Avoid conflicting service cleanups

## CLI Commands for Checkpoint Management

```bash
# Create checkpoint
./service-cleanup-tracker.ts checkpoint create \
  --service ${SERVICE_NAME} \
  --stage "migration-complete" \
  --message "Custom message"

# List checkpoints
./service-cleanup-tracker.ts checkpoint list --service ${SERVICE_NAME}

# Rollback to checkpoint
./service-cleanup-tracker.ts checkpoint rollback \
  --service ${SERVICE_NAME} \
  --stage "pre-cleanup"

# Compare worktree progress
./service-cleanup-tracker.ts checkpoint compare --all-worktrees
```

## Emergency Recovery

If something goes catastrophically wrong:

```bash
# 1. Stop all processes
pkill -f "node|npm|ts-node"

# 2. Assess damage
git status
git diff

# 3. Emergency rollback
git reset --hard HEAD~1  # Last commit
# OR
git reset --hard origin/development  # Last known good

# 4. Clean up
git clean -fd
rm -rf node_modules
pnpm install

# 5. Verify recovery
npm run test
```

## Checkpoint Checklist

Before moving to next stage, verify:
- [ ] Current stage tests passing
- [ ] No uncommitted changes
- [ ] Checkpoint commit created
- [ ] Commit message follows format
- [ ] Relevant files included
- [ ] Database tracking updated
- [ ] Worktree status documented

This systematic approach ensures we can always recover from any point in the cleanup process.