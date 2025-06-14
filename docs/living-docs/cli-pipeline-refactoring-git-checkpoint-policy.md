# CLI Pipeline Refactoring Git Checkpoint Policy

## 🎯 **Purpose**
Establish mandatory git checkpoints during CLI pipeline refactoring to ensure safe progress, easy rollback, and clear audit trail across all worktree groups.

**Key Principle**: Small, atomic commits at defined stages with descriptive messages that enable precise rollback if needed.

---

## 📋 **Checkpoint Stages Overview**

Each CLI pipeline refactoring MUST have these 7 checkpoint commits:

1. **CHECKPOINT-1**: Pre-migration backup
2. **CHECKPOINT-2**: Analysis complete
3. **CHECKPOINT-3**: Base class structure created
4. **CHECKPOINT-4**: Commands migrated
5. **CHECKPOINT-5**: Services integrated
6. **CHECKPOINT-6**: Tests passing
7. **CHECKPOINT-7**: Documentation complete

---

## 🔒 **Mandatory Checkpoint Commits**

### **CHECKPOINT-1: Pre-Migration Backup** 🟡
**When**: Before ANY changes to the pipeline
**Commit Pattern**: `checkpoint(cli-pipeline): backup {pipeline-name} before migration`

```bash
# Create backup and commit
cp scripts/cli-pipeline/*/example-cli.sh temp/archived-code/example-cli.sh.backup
git add temp/archived-code/example-cli.sh.backup
git commit -m "checkpoint(cli-pipeline): backup example-cli.sh before migration

Group: alpha
Original state preserved before base class migration
Complexity: medium
Domain: infrastructure"
```

**Purpose**: Clean rollback point to original state

### **CHECKPOINT-2: Analysis Complete** 🔵
**When**: After pipeline analysis is documented
**Commit Pattern**: `checkpoint(cli-pipeline): analysis complete for {pipeline-name}`

```bash
git add temp/analysis-reports/analysis-example-cli.sh.md
git commit -m "checkpoint(cli-pipeline): analysis complete for example-cli.sh

Group: alpha
Base class selected: ServiceCLIPipeline
Services identified: 3
Commands documented: 5
Issues found: 2"
```

**Purpose**: Document understanding before changes

### **CHECKPOINT-3: Base Class Structure Created** 🟣
**When**: After new structure is in place but before migrating commands
**Commit Pattern**: `checkpoint(cli-pipeline): base structure ready for {pipeline-name}`

```bash
git add scripts/cli-pipeline/*/example-cli.sh.new
git commit -m "checkpoint(cli-pipeline): base structure ready for example-cli.sh

Group: alpha
Base class: ServiceCLIPipeline
Framework integrated
Ready for command migration"
```

**Purpose**: Validate framework integration separately from functionality

### **CHECKPOINT-4: Commands Migrated** 🟢
**When**: After all commands are migrated but before service integration
**Commit Pattern**: `checkpoint(cli-pipeline): commands migrated for {pipeline-name}`

```bash
# Archive old version, activate new version
mv scripts/cli-pipeline/*/example-cli.sh temp/archived-code/example-cli.sh.old
mv scripts/cli-pipeline/*/example-cli.sh.new scripts/cli-pipeline/*/example-cli.sh
git add scripts/cli-pipeline/*/example-cli.sh temp/archived-code/example-cli.sh.old
git commit -m "checkpoint(cli-pipeline): commands migrated for example-cli.sh

Group: alpha
Commands migrated: 5 of 5
Functionality preserved
Ready for service integration"
```

**Purpose**: Separate command migration from service integration

### **CHECKPOINT-5: Services Integrated** 🔴
**When**: After service integrations are implemented
**Commit Pattern**: `checkpoint(cli-pipeline): services integrated for {pipeline-name}`

```bash
git add scripts/cli-pipeline/*/example-cli.sh
git add docs/living-docs/cli-service-integration-issues.md  # If glitches added
git commit -m "checkpoint(cli-pipeline): services integrated for example-cli.sh

Group: alpha
Services integrated: DatabaseService, LoggerService, ConfigService
Fallbacks implemented: 3
Glitches reported: 1 (DatabaseService v2 not available)"
```

**Purpose**: Track service integration separately for debugging

### **CHECKPOINT-6: Tests Passing** ✅
**When**: After all tests are verified passing
**Commit Pattern**: `checkpoint(cli-pipeline): tests passing for {pipeline-name}`

```bash
git add temp/test-results/test-report-example-cli.sh.md
git commit -m "checkpoint(cli-pipeline): tests passing for example-cli.sh

Group: alpha
Basic tests: PASS
Command tests: PASS (5/5)
Integration tests: PASS with fallbacks
Performance: Maintained"
```

**Purpose**: Confirm functionality before finalization

### **CHECKPOINT-7: Documentation Complete** 📚
**When**: After all documentation and database updates
**Commit Pattern**: `checkpoint(cli-pipeline): migration complete for {pipeline-name}`

```bash
git add temp/docs/migrated-example-cli.sh.md
git add temp/db-update-example-cli.sh.sql
git add temp/group-migration-log.md
git commit -m "checkpoint(cli-pipeline): migration complete for example-cli.sh

Group: alpha
Migration successful
Documentation updated
Database tracking prepared
Quality gates: PASSED"
```

**Purpose**: Final state with full documentation

---

## 🔄 **Rollback Procedures**

### **Quick Rollback Commands**

```bash
# View all checkpoints for a pipeline
git log --oneline --grep="checkpoint(cli-pipeline).*example-cli.sh"

# Rollback to specific checkpoint
git checkout {commit-hash} -- scripts/cli-pipeline/*/example-cli.sh

# Or rollback to checkpoint by number
PIPELINE="example-cli.sh"
CHECKPOINT=3  # Rollback to structure creation
git checkout $(git log --oneline --grep="checkpoint(cli-pipeline).*$PIPELINE" | grep "CHECKPOINT-$CHECKPOINT" | head -1 | awk '{print $1}') -- scripts/cli-pipeline/*/$PIPELINE
```

### **Emergency Rollback**

```bash
# Full rollback to pre-migration state
cp temp/archived-code/example-cli.sh.backup scripts/cli-pipeline/*/example-cli.sh
git add scripts/cli-pipeline/*/example-cli.sh
git commit -m "rollback(cli-pipeline): reverted example-cli.sh to pre-migration state

Reason: [Critical issue description]
Group: alpha
Will retry migration after issue resolution"
```

---

## 📊 **Progress Tracking Integration**

### **Update Progress Log at Each Checkpoint**

```bash
# Function to add in multi-worktree-framework.sh
checkpoint_commit() {
    local checkpoint_num="$1"
    local pipeline_name="$2"
    local group_name="$3"
    local checkpoint_name="$4"
    local details="$5"
    
    # Update progress log
    echo "$(date -Iseconds)|$group_name|$pipeline_name|checkpoint-$checkpoint_num|$checkpoint_name completed" >> temp/group-progress.log
    
    # Commit with standard message
    git commit -m "checkpoint(cli-pipeline): $checkpoint_name for $pipeline_name

Group: $group_name
$details"
}

# Usage example
checkpoint_commit 3 "example-cli.sh" "alpha" "base structure ready" "Base class: ServiceCLIPipeline
Framework integrated
Ready for command migration"
```

---

## 🚨 **Checkpoint Violations**

### **What NOT to Do**

❌ **Large commits spanning multiple checkpoints**
```bash
# BAD: Everything in one commit
git add .
git commit -m "migrated example-cli.sh"
```

❌ **Skipping checkpoints**
```bash
# BAD: Jumping from backup to tests
# Missing structure, migration, and integration checkpoints
```

❌ **Unclear commit messages**
```bash
# BAD: No context for rollback
git commit -m "updates"
```

### **Enforcement**

- Each group's daily standup should verify checkpoint compliance
- Progress tracking should show all 7 checkpoints per pipeline
- Missing checkpoints = incomplete migration

---

## 🎯 **Benefits of This Policy**

1. **Precise Rollback**: Can revert to any stage of migration
2. **Clear Progress**: Visible progress through defined stages
3. **Debugging Aid**: Isolates where issues were introduced
4. **Audit Trail**: Complete history of migration process
5. **Group Coordination**: Standard commits across all groups
6. **Quality Assurance**: Forces verification at each stage

---

## 📝 **Checkpoint Checklist Template**

Add this to each pipeline's migration tracking:

```markdown
## Migration Checkpoints: {pipeline-name}

- [ ] CHECKPOINT-1: Pre-migration backup
  - Commit: ________
  - Time: ________
  
- [ ] CHECKPOINT-2: Analysis complete  
  - Commit: ________
  - Time: ________
  
- [ ] CHECKPOINT-3: Base class structure created
  - Commit: ________
  - Time: ________
  
- [ ] CHECKPOINT-4: Commands migrated
  - Commit: ________
  - Time: ________
  
- [ ] CHECKPOINT-5: Services integrated
  - Commit: ________
  - Time: ________
  
- [ ] CHECKPOINT-6: Tests passing
  - Commit: ________
  - Time: ________
  
- [ ] CHECKPOINT-7: Documentation complete
  - Commit: ________
  - Time: ________

**Total Migration Time**: ________
**Issues Encountered**: ________
**Final Status**: ✅ COMPLETE / ❌ FAILED / ⚠️ PARTIAL
```

---

## 🔧 **Git Hooks Integration** (Optional)

```bash
# .git/hooks/commit-msg
#!/bin/bash
# Enforce checkpoint commit format

if grep -q "checkpoint(cli-pipeline):" "$1"; then
    # Verify format
    if ! grep -E "checkpoint\(cli-pipeline\): .+ for .+-.+\.sh" "$1"; then
        echo "ERROR: Invalid checkpoint format"
        echo "Use: checkpoint(cli-pipeline): {action} for {pipeline-name}"
        exit 1
    fi
fi
```

---

**This checkpoint policy ensures safe, trackable, and reversible CLI pipeline migrations across all worktree groups.**