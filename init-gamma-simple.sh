#!/usr/bin/env bash

# Initialize Gamma CLI Pipeline Refactoring
# Focus: Development & Communication Tools (git, email, continuous docs, dev tools)

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🎯 Gamma Group CLI Pipeline Setup${NC}"
echo -e "${YELLOW}Focus: Development & Communication Tools${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verify we're in the right place
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "improve-cli-pipelines" ]]; then
    echo -e "${RED}❌ Wrong branch! Expected: improve-cli-pipelines${NC}"
    echo -e "${RED}   Current: $CURRENT_BRANCH${NC}"
    exit 1
fi

# Create working directories
echo -e "${BLUE}📁 Creating working directories...${NC}"
mkdir -p temp/{migration-plans,analysis-reports,archived-code,test-results,docs}
mkdir -p temp/gamma-workspace

# Initialize tracking
echo "timestamp|group|pipeline|status|notes" > temp/group-progress.log
echo "# Group Gamma Migration Log - $(date)" > temp/group-migration-log.md

# Create Gamma pipeline assignments
cat > temp/gamma-pipelines.txt << 'EOF'
# GROUP GAMMA: Development & Communication (16 pipelines)
# Focus: Git workflows, email/communication, continuous processes, development tools

HIGH COMPLEXITY (2):
1. git-workflow-cli.sh (GIT) - Critical git operations
2. email-cli.sh (GOOGLE) - Email processing

MEDIUM COMPLEXITY (7):
3. gmail-cli.sh
4. continuous-docs-cli.sh
5. living-docs-cli.sh
6. work-summaries-cli.sh
7. ai-cli.sh
8. auth-cli.sh
9. git-cli.sh

LOW COMPLEXITY (7):
10. scripts-cli.sh
11. test-git-cli.sh
12. migrated_scripts/analysis-cli.sh
13. migrated_scripts/archive-cli.sh
14-16. Archived pipelines (validate archival)
EOF

echo -e "${GREEN}✅ Pipeline assignments created${NC}"

# Create daily workflow
cat > temp/gamma-daily-workflow.md << 'EOF'
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
EOF

echo -e "${GREEN}✅ Daily workflow guide created${NC}"

# Create example migration for a Gamma pipeline
cat > temp/example-gamma-migration.sh << 'EOF'
#!/usr/bin/env bash

# Example: Migrating git-workflow-cli.sh
# This shows the typical Gamma group migration pattern

PIPELINE="git-workflow-cli.sh"
GROUP="gamma"

# Source framework
source scripts/cli-pipeline/base-classes/multi-worktree-framework.sh

echo "🚀 Starting migration of $PIPELINE"

# 1. Backup
PIPELINE_PATH=$(find scripts/cli-pipeline -name "$PIPELINE" | head -1)
cp "$PIPELINE_PATH" "temp/archived-code/$PIPELINE.$(date +%Y%m%d)"
checkpoint "backup" "$PIPELINE" "$GROUP"

# 2. Analyze (manual step - check the pipeline)
echo "📊 Analyzing $PIPELINE..."
echo "- Heavy git operations → ServiceCLIPipeline"
echo "- Needs: GitOperationsService, WorktreeService"

# 3. Create migrated version
cat > "$PIPELINE_PATH.new" << 'MIGRATION'
#!/usr/bin/env bash

# git-workflow-cli.sh - Migrated to CLI Pipeline Framework
# Manages git operations and worktree workflows

# Source the base class
source "$(dirname "${BASH_SOURCE[0]}")/../../base-classes/ServiceCLIPipeline.sh"

# Pipeline configuration
PIPELINE_NAME="git-workflow"
PIPELINE_DESCRIPTION="Git operations and worktree management"
PIPELINE_VERSION="2.0.0"

# Initialize pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Service setup
setup_service_integrations() {
    # GitOperationsService integration
    if get_service_with_fallback "git-operations-service" "$PIPELINE_NAME" "gamma"; then
        GIT_SERVICE_AVAILABLE=true
    else
        GIT_SERVICE_AVAILABLE=false
        log_warn "Using direct git commands (GitOperationsService not available)"
    fi
}

# Command: status
command_status() {
    local description="Show git repository status"
    
    track_and_execute "git_status" "$description" \
        git status --short --branch
}

# Command: create-worktree
command_create_worktree() {
    local name="$1"
    local branch="${2:-$(git branch --show-current)}"
    local description="Create new git worktree"
    
    if [[ -z "$name" ]]; then
        log_error "Worktree name required"
        echo "Usage: $0 create-worktree <name> [branch]"
        return 1
    fi
    
    track_and_execute "create_worktree" "$description" \
        git worktree add "../dhg-mono-$name" "$branch"
}

# Main routing
route_command "$@"
MIGRATION

# 4. Replace and test
mv "$PIPELINE_PATH" "temp/archived-code/$PIPELINE.original"
mv "$PIPELINE_PATH.new" "$PIPELINE_PATH"
chmod +x "$PIPELINE_PATH"

# 5. Checkpoint migration
checkpoint "migrated" "$PIPELINE" "$GROUP" "Base class: ServiceCLIPipeline
Services: GitOperationsService with fallback"

# 6. Test
echo "🧪 Testing migrated pipeline..."
if $PIPELINE_PATH --help >/dev/null 2>&1; then
    echo "✅ Help system works"
else
    echo "❌ Help system failed"
fi

# 7. Final checkpoint
checkpoint "validated" "$PIPELINE" "$GROUP" "Tests passed"

echo "✅ Migration complete!"
EOF

chmod +x temp/example-gamma-migration.sh
echo -e "${GREEN}✅ Example migration script created${NC}"

# Create Gamma-specific helpers
cat > temp/gamma-helpers.sh << 'EOF'
#!/usr/bin/env bash

# Gamma Group Specific Helpers
# Development & Communication pipeline helpers

# Check git-related dependencies
check_git_dependencies() {
    local pipeline="$1"
    
    echo "🔍 Checking git dependencies for $pipeline..."
    grep -E "(git |worktree|branch|commit|push|pull)" "scripts/cli-pipeline/*/$pipeline" || echo "No git operations found"
}

# Check email/communication dependencies  
check_comm_dependencies() {
    local pipeline="$1"
    
    echo "📧 Checking communication dependencies for $pipeline..."
    grep -E "(email|gmail|smtp|imap|oauth)" "scripts/cli-pipeline/*/$pipeline" || echo "No email operations found"
}

# Gamma group progress summary
gamma_progress() {
    echo "📊 Gamma Group Progress:"
    echo ""
    
    local total=16
    local completed=0
    local in_progress=0
    
    if [[ -f temp/group-progress.log ]]; then
        completed=$(grep "validated" temp/group-progress.log | wc -l | tr -d ' ')
        in_progress=$(grep "migrated" temp/group-progress.log | wc -l | tr -d ' ')
    fi
    
    local remaining=$((total - completed - in_progress))
    
    echo "Total pipelines: $total"
    echo "Completed: $completed"
    echo "In progress: $in_progress"
    echo "Remaining: $remaining"
    echo ""
    
    echo "Recent activity:"
    if [[ -f temp/group-progress.log ]]; then
        tail -5 temp/group-progress.log
    else
        echo "No activity yet"
    fi
}

# Quick migration starter for Gamma pipelines
start_gamma_migration() {
    local pipeline="$1"
    
    if [[ -z "$pipeline" ]]; then
        echo "Usage: start_gamma_migration <pipeline-name>"
        return 1
    fi
    
    echo "🚀 Starting Gamma migration for: $pipeline"
    
    # Determine likely base class
    case "$pipeline" in
        *git*|*worktree*)
            echo "→ Recommended: ServiceCLIPipeline (git operations)"
            ;;
        *email*|*gmail*)
            echo "→ Recommended: ServiceCLIPipeline (email services)"
            ;;
        *continuous*|*living*)
            echo "→ Recommended: ProcessingCLIPipeline (document processing)"
            ;;
        *test*|*script*)
            echo "→ Recommended: SimpleCLIPipeline (utilities)"
            ;;
        *)
            echo "→ Analyze to determine base class"
            ;;
    esac
    
    ./simple-checkpoint-tracker.sh "$pipeline" gamma
}
EOF

chmod +x temp/gamma-helpers.sh
echo -e "${GREEN}✅ Gamma helpers created${NC}"

# Final summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Gamma Group Setup Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📋 Your assignments:${NC} temp/gamma-pipelines.txt"
echo -e "${YELLOW}📖 Daily workflow:${NC} temp/gamma-daily-workflow.md"
echo -e "${YELLOW}🔧 Example script:${NC} temp/example-gamma-migration.sh"
echo -e "${YELLOW}🛠️  Gamma helpers:${NC} temp/gamma-helpers.sh"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review your 16 assigned pipelines"
echo "2. Start with LOW complexity (scripts-cli.sh is a good first one)"
echo "3. Use: ./simple-checkpoint-tracker.sh <pipeline> gamma"
echo ""
echo -e "${GREEN}Happy refactoring! 🚀${NC}"

# Source helpers automatically
source temp/gamma-helpers.sh

# Show initial status
echo ""
gamma_progress