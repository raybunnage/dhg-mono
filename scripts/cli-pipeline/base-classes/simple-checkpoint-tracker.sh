#!/usr/bin/env bash

# Simple 3-Checkpoint Tracker for CLI Pipeline Migration
# Perfect for solo dev with Claude agents

set -e

# Source the framework
source "$(dirname "${BASH_SOURCE[0]}")/multi-worktree-framework.sh"

# Get pipeline and group
PIPELINE_NAME="${1:-}"
GROUP_NAME="${2:-}"

if [[ -z "$PIPELINE_NAME" || -z "$GROUP_NAME" ]]; then
    echo "Usage: $0 <pipeline-name> <group-name>"
    echo "Example: $0 example-cli.sh alpha"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Simple Checkpoint Tracker: $PIPELINE_NAME${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check existing checkpoints
echo -e "${YELLOW}Checking existing checkpoints...${NC}"
EXISTING=$(git log --oneline --grep="checkpoint:.*$PIPELINE_NAME" 2>/dev/null | head -3)
if [[ -n "$EXISTING" ]]; then
    echo "$EXISTING"
else
    echo "No checkpoints yet"
fi
echo ""

# Checkpoint 1: Backup
echo -e "${YELLOW}1. BACKUP - Save the original${NC}"
read -p "Ready to backup? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Create backup
    PIPELINE_PATH=$(find scripts/cli-pipeline -name "$PIPELINE_NAME" | head -1)
    if [[ -f "$PIPELINE_PATH" ]]; then
        cp "$PIPELINE_PATH" "temp/archived-code/$PIPELINE_NAME.$(date +%Y%m%d)"
        checkpoint "backup" "$PIPELINE_NAME" "$GROUP_NAME" "Original saved"
        echo -e "${GREEN}✅ Backup complete${NC}"
    else
        echo -e "${YELLOW}⚠️  Pipeline not found - skipping backup${NC}"
    fi
fi
echo ""

# Checkpoint 2: Migrated
echo -e "${YELLOW}2. MIGRATED - Base class migration done${NC}"
echo "This includes:"
echo "  - Commands converted to new pattern"
echo "  - Services integrated with fallbacks"
echo "  - Help system standardized"
echo ""
read -p "Migration complete? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Which base class? (Simple/Service/Processing/Management): " BASE_CLASS
    checkpoint "migrated" "$PIPELINE_NAME" "$GROUP_NAME" "Base class: ${BASE_CLASS}CLIPipeline"
    echo -e "${GREEN}✅ Migration checkpoint saved${NC}"
fi
echo ""

# Checkpoint 3: Validated
echo -e "${YELLOW}3. VALIDATED - Tests pass, ready to use${NC}"
read -p "All tests passing? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    checkpoint "validated" "$PIPELINE_NAME" "$GROUP_NAME" "Tests passed, ready for use"
    echo -e "${GREEN}✅ Validation complete${NC}"
    
    # Update final progress
    update_pipeline_progress "$GROUP_NAME" "$PIPELINE_NAME" "completed" "All checkpoints done"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Summary:${NC}"
list_checkpoints "$PIPELINE_NAME"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"