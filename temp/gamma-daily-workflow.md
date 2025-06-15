# Gamma Group Daily Workflow

## 🌅 Morning (Start Here)
```bash
# 1. Source the framework
source scripts/cli-pipeline/base-classes/multi-worktree-framework.sh

# 2. Register group (first time only)
register_worktree_group "gamma" "$(pwd)" "16-development-communication-pipelines"

# 3. Check status
list_checkpoints "git-workflow-cli.sh"  # Example
```

## 🔧 For Each Pipeline

### Step 1: Analyze
```bash
PIPELINE="git-workflow-cli.sh"  # Change this
analyze_pipeline_complexity "scripts/cli-pipeline/*/$PIPELINE"
```

### Step 2: Backup & Start
```bash
# Create backup checkpoint
cp scripts/cli-pipeline/*/$PIPELINE temp/archived-code/$PIPELINE.$(date +%Y%m%d)
checkpoint "backup" "$PIPELINE" "gamma"
```

### Step 3: Migrate
- Choose base class based on analysis
- Migrate commands to new structure
- Integrate services with fallbacks
- Archive old code

### Step 4: Checkpoint Migration
```bash
checkpoint "migrated" "$PIPELINE" "gamma" "Base class: ServiceCLIPipeline"
```

### Step 5: Test & Validate
```bash
# Test the migrated pipeline
./scripts/cli-pipeline/*/$PIPELINE --help
./scripts/cli-pipeline/*/$PIPELINE test-command

# If all good, checkpoint
checkpoint "validated" "$PIPELINE" "gamma" "All tests pass"
```

## 🎯 Quick Commands

```bash
# Use the simple tracker
./simple-checkpoint-tracker.sh git-workflow-cli.sh gamma

# Submit issues
submit_glitch "git-workflow-cli.sh" "gamma" "service_missing" "GitOperationsService not found" "high"

# Check all pipelines
for p in $(cat temp/gamma-pipelines.txt | grep -E "\.sh" | awk '{print $2}'); do
    echo "=== $p ==="
    list_checkpoints "$p"
done
```

## 📊 End of Day
- Update group log
- Check glitch submissions
- Plan tomorrow's pipelines
