# Scenario: Remove Complexity

**Purpose**: Safely remove over-engineered features that aren't being used  
**Frequency**: Quarterly or when maintenance burden exceeds value  
**Time Estimate**: 2-4 hours depending on scope

## When to Use This Scenario

- Database tables with 0 records after 30+ days
- Code files with no imports/usage
- Features nobody can remember using
- Maintenance burden exceeding value
- "What does this do?" comes up repeatedly

## Phase 0: Critical Evaluation (STOP AND THINK!)

### 1. Measure Current Reality
```bash
# Check actual usage (example for database tables)
echo "Checking table usage..."

# For each suspicious table:
psql -c "SELECT COUNT(*) FROM table_name;"

# For code files:
grep -r "import.*ModuleName" --include="*.ts" --include="*.js" .
```

Document findings:
- Table X: 0 records (created 60 days ago)
- Module Y: 0 imports found
- Feature Z: No documentation of usage

### 2. Industry Sanity Check
Ask yourself:
- Would GitHub/Stripe/Basecamp keep this?
- Is this solving a real problem we have?
- Has anyone asked for this feature?
- What's the maintenance cost?

### 3. Make Go/No-Go Decision
- **GO**: If usage is 0 or near 0
- **NO-GO**: If actively used or critical dependency
- **WAIT**: If created <30 days ago

### 4. Git Checkpoint: Document Decision
```bash
git add -A && git commit -m "checkpoint: before removing [feature name]

Current state:
- Tables: [list with record counts]
- Files: [count and total lines]
- Usage: [actual metrics]
- Decision: Remove due to [specific reason]
- Rollback: Can restore from next commit"
```

## Phase 1: Safe Archival

### 1. Create Archive Structure
```bash
# Create dated archive directory
mkdir -p .archived/$(date +%Y-%m-%d)_$(feature_name)_removal/

# Create README in archive
cat > .archived/$(date +%Y-%m-%d)_$(feature_name)_removal/README.md << EOF
# Archived: [Feature Name]

**Date**: $(date +%Y-%m-%d)
**Reason**: Zero usage after X days
**Original Purpose**: [What it was supposed to do]
**Why It Failed**: [Best guess - over-engineered, solved wrong problem, etc.]

## Contents
- [List main components]

## How to Restore
1. Copy files back from this directory
2. Re-run migrations: [list if applicable]
3. Update imports in: [list affected files]

## Lessons Learned
[What we learned from this]
EOF
```

### 2. Move Files (Don't Delete!)
```bash
# Example for TypeScript files
mv src/complex-feature.ts .archived/$(date +%Y-%m-%d)_$(feature_name)_removal/

# Example for database migrations
cp migrations/create_complex_tables.sql .archived/$(date +%Y-%m-%d)_$(feature_name)_removal/
```

### 3. Git Checkpoint: Archive Complete
```bash
git add -A && git commit -m "archive: removed [feature name] complexity

- Archived to: .archived/$(date +%Y-%m-%d)_$(feature_name)_removal/
- Files moved: X files, Y lines of code
- Database impact: [tables to be dropped/archived]
- Can restore if needed"
```

## Phase 2: Clean Active Code

### 1. Remove/Update Imports
```bash
# Find and remove dead imports
grep -r "import.*RemovedModule" --include="*.ts" .

# Update files that imported removed code
```

### 2. Archive Database Tables
```sql
-- Option 1: Move to archive schema (preferred)
CREATE SCHEMA IF NOT EXISTS archived;
ALTER TABLE complex_unused_table SET SCHEMA archived;

-- Option 2: Rename with archive prefix
ALTER TABLE complex_unused_table 
RENAME TO archived_2025_06_15_complex_unused_table;

-- Option 3: Drop if truly unnecessary (last resort)
-- DROP TABLE complex_unused_table; -- NO! Archive instead
```

### 3. Update Configuration
- Remove from package.json scripts
- Remove from CI/CD pipelines  
- Update documentation
- Remove from startup scripts

### 4. Git Checkpoint: Clean State
```bash
git add -A && git commit -m "cleanup: remove references to [feature name]

- Updated imports in X files
- Archived Y database tables
- Removed Z configuration entries
- All tests passing"
```

## Phase 3: Implement Simple Alternative (If Needed)

### 1. Create Minimal Replacement
Only if the feature addressed a real need:
```typescript
// Instead of 500-line ComplexTracker
export function simpleLog(event: string, success: boolean) {
  console.log(`[${new Date().toISOString()}] ${event}: ${success ? '✓' : '✗'}`);
  // That's it. Start simple.
}
```

### 2. Document the Simple Way
```markdown
# Simple [Feature] Tracking

Instead of complex system, we now:
1. Log to console
2. Check logs if needed
3. Add complexity only if this proves insufficient
```

### 3. Git Checkpoint: Simple Alternative
```bash
git add -A && git commit -m "add: simple replacement for [feature name]

- Replaced X lines with Y lines
- Functionality: [what it does]
- Future: Add complexity only if usage proves need"
```

## Phase 4: Document Lessons

### 1. Update Project Documentation
Add to `docs/architecture/lessons-learned.md`:
```markdown
## [Date]: Removed [Feature Name]

**What We Built**: [Brief description]
**Why It Failed**: Over-engineered before proving need
**What We Learned**: Start simple, measure usage, then enhance
**Simple Alternative**: [What we're using instead]
```

### 2. Update Contributing Guidelines
If pattern detected, add principle to prevent recurrence.

### 3. Final Git Checkpoint
```bash
git add -A && git commit -m "docs: document lessons from removing [feature name]

- Added to lessons-learned.md
- Updated contributing guidelines
- Total complexity removed: X files, Y lines
- Simplification complete"
```

## Phase 5: Monitor and Validate

### 1. Set Review Reminder
```bash
# Add to project calendar/tasks
echo "Review [feature] simplification success" | at now + 30 days
```

### 2. Success Metrics
After 30 days, check:
- Is simple alternative being used?
- Any requests for old complexity?
- Time saved on maintenance?
- Developer satisfaction?

## Rollback Plan

If removal was wrong:
1. Check archive directory for date
2. Copy files back
3. Re-run any migrations
4. Update imports
5. Document why restoration was needed

## Anti-Patterns to Avoid

❌ **Deleting instead of archiving** - Always preserve history  
❌ **Removing without measuring** - Check actual usage first  
❌ **No documentation** - Future you needs to know why  
❌ **Big bang removal** - Use git checkpoints  
❌ **No simple alternative** - Consider if feature solved real need

## Success Indicators

✅ Build time decreased  
✅ Test suite runs faster  
✅ New developers understand codebase quicker  
✅ Fewer "what does this do?" questions  
✅ Maintenance burden reduced  

## Example: Continuous Deployment Simplification

```bash
# Phase 0: Evaluation
- 5 tables, 0 records each
- 14 files, ~2500 lines
- 0 imports found
- Decision: Remove

# Phase 1: Archive
.archived/2025-06-15_continuous_complexity/
├── README.md (why we removed it)
├── critical-evaluator.ts (619 lines)
├── scenario-dependencies.ts
└── [etc...]

# Phase 2: Clean
- Archived 5 database tables
- Removed complex CLI commands
- Updated imports

# Phase 3: Simple Alternative  
- 1 table (scenario_attempts)
- 3 CLI commands
- 4 markdown scenarios

# Result
- 2500 lines → 200 lines
- 5 tables → 1 table
- Actually gets used!
```

Remember: **Complexity is earned, not assumed.** Start simple, measure everything, add complexity only when data demands it.