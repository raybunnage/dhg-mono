#!/usr/bin/env bash

# CLI Pipeline Checkpoint Tracker
# Template for tracking checkpoint commits during pipeline migration

set -e

# Source the framework
source "$(dirname "${BASH_SOURCE[0]}")/multi-worktree-framework.sh"

# Configuration
PIPELINE_NAME="${1:-}"
GROUP_NAME="${2:-}"

if [[ -z "$PIPELINE_NAME" || -z "$GROUP_NAME" ]]; then
    echo "Usage: $0 <pipeline-name> <group-name>"
    echo "Example: $0 example-cli.sh alpha"
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📍 Checkpoint Tracker for: $PIPELINE_NAME${NC}"
echo -e "${BLUE}Group: $GROUP_NAME${NC}"
echo ""

# Get current checkpoint status
LAST_CHECKPOINT=$(get_last_checkpoint "$PIPELINE_NAME")
echo -e "${YELLOW}Last checkpoint: $LAST_CHECKPOINT${NC}"
echo ""

# Function to execute and track checkpoints
execute_checkpoint() {
    local checkpoint_num="$1"
    local checkpoint_name="$2"
    local action_description="$3"
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}CHECKPOINT $checkpoint_num: $checkpoint_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Check if already completed
    if [[ $LAST_CHECKPOINT -ge $checkpoint_num ]]; then
        echo -e "${GREEN}✅ Already completed${NC}"
        list_pipeline_checkpoints "$PIPELINE_NAME" | grep "checkpoint-$checkpoint_num" | head -1
        echo ""
        return 0
    fi
    
    echo -e "Action required: $action_description"
    echo ""
    read -p "Have you completed this checkpoint? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Enter checkpoint details (press Ctrl+D when done):"
        DETAILS=$(cat)
        
        # Create the checkpoint commit
        checkpoint_commit "$checkpoint_num" "$PIPELINE_NAME" "$GROUP_NAME" "$checkpoint_name" "$DETAILS"
        
        echo -e "${GREEN}✅ Checkpoint $checkpoint_num completed!${NC}"
        LAST_CHECKPOINT=$checkpoint_num
    else
        echo -e "${RED}⏸️  Checkpoint $checkpoint_num skipped${NC}"
        echo "Stopping at incomplete checkpoint."
        exit 0
    fi
    
    echo ""
}

# Show checkpoint checklist
echo -e "${BLUE}📋 Checkpoint Checklist:${NC}"
echo ""

# Execute checkpoints in order
execute_checkpoint 1 "backup $PIPELINE_NAME before migration" \
    "Create backup of original pipeline in temp/archived-code/"

execute_checkpoint 2 "analysis complete for $PIPELINE_NAME" \
    "Complete analysis document in temp/analysis-reports/"

execute_checkpoint 3 "base structure ready for $PIPELINE_NAME" \
    "Create new pipeline structure with selected base class"

execute_checkpoint 4 "commands migrated for $PIPELINE_NAME" \
    "Migrate all commands to new structure, archive old code"

execute_checkpoint 5 "services integrated for $PIPELINE_NAME" \
    "Integrate with refactored services, implement fallbacks"

execute_checkpoint 6 "tests passing for $PIPELINE_NAME" \
    "Run all tests and verify functionality"

execute_checkpoint 7 "migration complete for $PIPELINE_NAME" \
    "Update documentation and database tracking"

# Final summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 All checkpoints completed for $PIPELINE_NAME!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Show all checkpoints
echo -e "${BLUE}📊 Complete checkpoint history:${NC}"
list_pipeline_checkpoints "$PIPELINE_NAME"

# Update final progress
update_pipeline_progress "$GROUP_NAME" "$PIPELINE_NAME" "completed" "All 7 checkpoints completed"

echo ""
echo -e "${GREEN}✅ Migration tracking complete!${NC}"