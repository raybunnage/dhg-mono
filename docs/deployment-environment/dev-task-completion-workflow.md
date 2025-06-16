# Dev Task Completion Workflow - Clipboard Snippet

## 🔍 Post-Completion Validation & Integration Checklist

### 1. **Validate Work Completion**
```bash
# Confirm core functionality works as specified
# Run basic smoke tests on implemented features
# Verify all requirements from task description are met
```

### 2. **Database & Migration Validation**
```bash
# Run any pending migrations
./scripts/cli-pipeline/database/database-cli.sh migration run-staged

# Regenerate types after schema changes
pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts

# Validate migration success
./scripts/cli-pipeline/database/database-cli.sh migration validate
```

### 3. **Success Criteria & Gates Integration**
```bash
# Add success criteria to dev_task_success_criteria table
# Link verification steps to dev_task_verification_steps
# Update task status with completion gates passed
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh update-criteria <task-id>
```

### 4. **Test Strategy & Implementation**
```bash
# Identify test type needed: unit/component/integration/e2e
# Create tests in appropriate location (packages/shared/tests, apps/*/src/tests)
# Include edge cases: null/undefined inputs, error conditions, boundary values
# Test the tests: run with known good/bad inputs
```

### 5. **Test Execution & Results**
```bash
# Run relevant test suites
pnpm test <component-name>
pnpm test:run  # For CI-style execution

# Document any test failures or unexpected behaviors
# Investigate discrepancies between expected vs actual results
```

### 6. **Documentation Updates**
```bash
# Identify relevant living document to update
# Add learnings, gotchas, implementation notes
# Update CLAUDE.md if new patterns/conventions established
# Archive obsolete documentation if consolidating
./scripts/cli-pipeline/document_archiving/document-archiving-cli.sh list
```

### 7. **Database Tracking & Registration**
```bash
# Update sys_table_definitions for new tables/columns
# Record in command_definitions if new CLI commands created
# Add to service_dependencies if services interact
# Track in dev_task_commits for git history
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh commit
```

### 8. **Service Architecture Validation**
```bash
# Check if functionality belongs in packages/shared/services/
# Ensure singleton patterns used correctly
# Validate cross-environment compatibility (browser/CLI/server)
# Move duplicate code to shared services if identified
```

### 9. **CLI Pipeline Integration**
```bash
# Add command to appropriate pipeline (google_sync/, dev_tasks/, etc.)
# Register in command_definitions table
# Add help text and integrate with shell script wrapper
./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh populate-command-registry
```

### 10. **Database Schema Maintenance**
```bash
# Document new tables in sys_table_definitions
# Update table descriptions and purposes
# Ensure RLS policies are appropriate
# Add to sys_table_prefixes if new prefix used
```

### 11. **Additional Quality Checks**
```bash
# Run TypeScript compilation check
tsc --noEmit

# Verify no hardcoded credentials
grep -r "password\|secret\|key" --exclude-dir=node_modules .

# Check import statements use correct patterns (@shared/services vs relative)
# Ensure error handling and logging appropriate
# Validate environment variable usage
```

### 12. **Final Integration**
```bash
# Create work summary with learnings
./scripts/cli-pipeline/work_summaries/work-summaries-cli.sh auto "Title" "Description" "commands" "tags"

# Mark dev task as completed
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh complete <task-id>

# Commit changes with task ID reference
# Consider if follow-up tasks needed for discovered improvements
```

---
*Use this checklist systematically after completing any dev task to ensure proper integration, testing, documentation, and knowledge capture in the DHG development system.*