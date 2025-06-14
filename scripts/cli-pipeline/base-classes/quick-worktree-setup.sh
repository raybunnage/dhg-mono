#!/usr/bin/env bash

# Quick setup script for existing worktrees
# Run this from each worktree to initialize it with the framework

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Quick Worktree Setup for CLI Pipeline Refactoring${NC}"
echo ""

# Detect which group based on directory name
CURRENT_DIR=$(basename "$(pwd)")
GROUP_NAME=""
PIPELINE_COUNT=""

case "$CURRENT_DIR" in
    *alpha*)
        GROUP_NAME="alpha"
        PIPELINE_COUNT="17"
        echo -e "${GREEN}Detected Group Alpha - Infrastructure & System Management${NC}"
        ;;
    *beta*)
        GROUP_NAME="beta" 
        PIPELINE_COUNT="17"
        echo -e "${GREEN}Detected Group Beta - Content & Data Processing${NC}"
        ;;
    *gamma*)
        GROUP_NAME="gamma"
        PIPELINE_COUNT="16"
        echo -e "${GREEN}Detected Group Gamma - Development & Communication${NC}"
        ;;
    *)
        echo -e "${YELLOW}⚠️  Cannot auto-detect group from directory name${NC}"
        echo "Please specify group (alpha/beta/gamma):"
        read -r GROUP_NAME
        echo "Please specify pipeline count:"
        read -r PIPELINE_COUNT
        ;;
esac

# Create working directories
echo -e "${BLUE}📁 Creating working directories...${NC}"
mkdir -p temp/{migration-plans,analysis-reports,archived-code,test-results,docs}

# Initialize tracking
echo "timestamp|group|pipeline|status|notes" > temp/group-progress.log
echo "# Group ${GROUP_NAME^} Migration Log" > temp/group-migration-log.md
echo "$(date): Group ${GROUP_NAME^} initialized" >> temp/group-migration-log.md

# Create quick reference files
echo -e "${BLUE}📋 Creating quick reference files...${NC}"

# Create pipeline assignment file for this group
cat > temp/my-pipeline-assignments.txt << EOF
# Group ${GROUP_NAME^} Pipeline Assignments
# Total: $PIPELINE_COUNT pipelines

EOF

# Add specific assignments based on group
case "$GROUP_NAME" in
    "alpha")
        cat >> temp/my-pipeline-assignments.txt << 'EOF'
HIGH COMPLEXITY (3):
1. all-pipelines-cli.sh (SYSTEM) - Complete last
2. deployment-cli.sh (INFRASTRUCTURE)
3. database-cli.sh (DATA)

MEDIUM COMPLEXITY (7):
4. proxy-cli.sh
5. servers-cli.sh
6. monitoring-cli.sh
7. shared-services-cli.sh
8. service-dependencies-cli.sh
9. refactor-tracking-cli.sh
10. deprecation-cli.sh

LOW COMPLEXITY (7):
11. utilities-cli.sh
12. system-cli.sh
13. registry-cli.sh
14. tracking-cli.sh
15. maintenance-cli.sh
16. continuous-cli.sh
17. testing-cli.sh
EOF
        ;;
    "beta")
        cat >> temp/my-pipeline-assignments.txt << 'EOF'
HIGH COMPLEXITY (3):
1. google-sync-cli.sh (GOOGLE)
2. dev-tasks-cli.sh (DEVELOPMENT)
3. media-processing-cli.sh (MEDIA)

MEDIUM COMPLEXITY (8):
4. media-analytics-cli.sh
5. classify-cli.sh
6. document-types-cli.sh
7. experts-cli.sh
8. presentations-cli.sh
9. prompt-service-cli.sh
10. element-criteria-cli.sh
11. document-archiving-cli.sh

LOW COMPLEXITY (6):
12. docs-cli.sh
13. document-pipeline-service-cli.sh
14. drive-filter-cli.sh
15. mime-types-cli.sh
16. doc-cli.sh
17. viewers/raycast-scripts/cursor-7-cli.sh
EOF
        ;;
    "gamma")
        cat >> temp/my-pipeline-assignments.txt << 'EOF'
HIGH COMPLEXITY (2):
1. git-workflow-cli.sh (GIT)
2. email-cli.sh (GOOGLE)

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
14-16. Archived pipelines (validate archival status)
EOF
        ;;
esac

echo -e "${GREEN}✅ Assignment file created: temp/my-pipeline-assignments.txt${NC}"

# Create daily checklist
cat > temp/daily-checklist.md << EOF
# Daily Checklist for Group ${GROUP_NAME^}

## Morning Sync
- [ ] Check group progress log
- [ ] Review glitch log for new issues
- [ ] Coordinate with other groups on dependencies

## For Each Pipeline
- [ ] Run Phase 2: Analysis (15-30 min)
- [ ] Run Phase 3: Migration (45-90 min)
- [ ] Run Phase 4: Testing (20-30 min)
- [ ] Run Phase 5: Documentation (15-20 min)
- [ ] Run Phase 6: Quality Gates (10 min)

## 🔒 Simple 3-Checkpoint System
1. **BACKUP**: Save original before changes
2. **MIGRATED**: Base class migration complete  
3. **VALIDATED**: Tests pass, ready to use

## End of Day
- [ ] Update group progress log
- [ ] Submit any new glitches
- [ ] Coordinate with other groups
- [ ] Plan next day's work

## Quick Commands
\`\`\`bash
# Source the framework
source scripts/cli-pipeline/base-classes/multi-worktree-framework.sh

# Register this worktree
register_worktree_group "$GROUP_NAME" "\$(pwd)" "$PIPELINE_COUNT-pipelines"

# Update progress
update_pipeline_progress "$GROUP_NAME" "pipeline-name" "status" "notes"

# Submit a glitch
submit_glitch "pipeline-name" "$GROUP_NAME" "issue-type" "description" "priority"

# Check for conflicts
check_pipeline_conflicts "pipeline-name" "$GROUP_NAME"

# Simple checkpoint commands
checkpoint "backup" "example-cli.sh" "$GROUP_NAME"
checkpoint "migrated" "example-cli.sh" "$GROUP_NAME" "Base class: ServiceCLIPipeline"
checkpoint "validated" "example-cli.sh" "$GROUP_NAME" "Tests passed"

# List checkpoints
list_checkpoints "example-cli.sh"

# Rollback if needed
rollback_pipeline "example-cli.sh"
\`\`\`
EOF

echo -e "${GREEN}✅ Daily checklist created: temp/daily-checklist.md${NC}"

# Create example migration script
cat > temp/example-migration.sh << 'EOF'
#!/usr/bin/env bash

# Example migration script for a single pipeline
# Customize this for each pipeline you migrate

PIPELINE_NAME="example-cli.sh"
GROUP_NAME="'$GROUP_NAME'"
BASE_CLASS="SimpleCLIPipeline"  # Change based on analysis

# Source the framework
source scripts/cli-pipeline/base-classes/multi-worktree-framework.sh

# Phase 1: Analysis
echo "🔍 Analyzing $PIPELINE_NAME..."
PIPELINE_PATH=$(find scripts/cli-pipeline -name "$PIPELINE_NAME" | head -1)

# Phase 2: Backup
BACKUP_FILE="temp/archived-code/$(basename $PIPELINE_PATH .sh).$(date +%Y%m%d_%H%M%S).sh"
cp "$PIPELINE_PATH" "$BACKUP_FILE"

# Phase 3: Migration
# [Add migration steps here]

# Phase 4: Testing
$PIPELINE_PATH --help

# Phase 5: Documentation
update_pipeline_progress "$GROUP_NAME" "$PIPELINE_NAME" "completed" "Migration successful"

echo "✅ Migration complete!"
EOF

chmod +x temp/example-migration.sh
echo -e "${GREEN}✅ Example migration script created: temp/example-migration.sh${NC}"

echo ""
echo -e "${BLUE}📊 Setup Complete!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Review your assignments in: temp/my-pipeline-assignments.txt"
echo "2. Read the detailed process: docs/living-docs/cli-pipeline-detailed-evaluation-refactor-process.md"
echo "3. Start with your first pipeline:"
echo "   - Low complexity pipelines are good starting points"
echo "   - Save high complexity for after gaining experience"
echo ""
echo "4. To begin work:"
echo -e "   ${GREEN}source scripts/cli-pipeline/base-classes/multi-worktree-framework.sh${NC}"
echo -e "   ${GREEN}register_worktree_group \"$GROUP_NAME\" \"\$(pwd)\" \"$PIPELINE_COUNT-pipelines\"${NC}"
echo ""
echo -e "${GREEN}🎉 Group ${GROUP_NAME^} is ready to start CLI pipeline refactoring!${NC}"