# CLI Pipeline Refactoring Git Checkpoint Policy (Simplified)

## 🎯 **Purpose**
Quick checkpoint system for CLI pipeline refactoring - practical for solo dev with Claude agents.

**Key Principle**: 3 simple checkpoints that actually matter for rollback and progress tracking.

---

## 📋 **Checkpoint Stages Overview**

Each CLI pipeline refactoring has these 3 checkpoint commits:

1. **CHECKPOINT-BEFORE**: Original pipeline backed up
2. **CHECKPOINT-MIGRATED**: Pipeline migrated to base class 
3. **CHECKPOINT-VALIDATED**: Tests pass, ready for use

---

## 🔒 **The 3 Checkpoints That Matter**

### **CHECKPOINT-BEFORE: Backup Original** 🟡
**When**: Before touching anything
**Commit Pattern**: `checkpoint: backup {pipeline-name}`

```bash
# Quick backup and commit
cp scripts/cli-pipeline/*/example-cli.sh temp/archived-code/example-cli.sh.$(date +%Y%m%d)
git add -A
git commit -m "checkpoint: backup example-cli.sh

Group: alpha
Original saved before migration"
```

**Purpose**: Can always go back to what worked

### **CHECKPOINT-MIGRATED: Base Class Working** 🟢
**When**: After migration is complete (including services, commands, everything)
**Commit Pattern**: `checkpoint: migrated {pipeline-name}`

```bash
# Commit the migrated pipeline
git add scripts/cli-pipeline/*/example-cli.sh
git commit -m "checkpoint: migrated example-cli.sh

Group: alpha
Base class: ServiceCLIPipeline
All commands migrated
Services integrated with fallbacks"
```

**Purpose**: The new version exists and should work

### **CHECKPOINT-VALIDATED: Ready for Production** ✅
**When**: After testing confirms it actually works
**Commit Pattern**: `checkpoint: validated {pipeline-name}`

```bash
# Final commit after testing
git add -A
git commit -m "checkpoint: validated example-cli.sh

Group: alpha
Tests passed
Ready for use"
```

**Purpose**: Confirmed working, safe to use

---

## 🔄 **Simple Rollback**

```bash
# If something breaks, just go back
cp temp/archived-code/example-cli.sh.20240614 scripts/cli-pipeline/*/example-cli.sh
git add -A
git commit -m "rollback: reverted example-cli.sh - [reason]"
```

That's it. No complex procedures needed.

---

## 🎯 **Why This Works**

1. **BEFORE**: You can always go back
2. **MIGRATED**: You know when the work is done
3. **VALIDATED**: You know when it's safe to use

That's all you really need. Everything else is just overhead for a solo dev setup.

---

## 📝 **Quick Tracking**

```markdown
## Pipeline: {name}
- [ ] Backed up (checkpoint: backup)
- [ ] Migrated (checkpoint: migrated)  
- [ ] Validated (checkpoint: validated)
```

---

**Simple. Practical. Gets the job done.**