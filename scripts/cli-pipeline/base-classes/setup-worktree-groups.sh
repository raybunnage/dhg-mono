#!/usr/bin/env bash

# Setup CLI Pipeline Refactoring Worktrees
# Creates the 3 balanced worktree groups for parallel CLI pipeline refactoring

set -e

# Colors for output  
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current directory
CURRENT_DIR=$(pwd)
PARENT_DIR=$(dirname "$CURRENT_DIR")

echo -e "${BLUE}🚀 Setting up CLI Pipeline Refactoring Worktrees${NC}"
echo ""

# Verify we're in the right directory
if [[ ! -f "scripts/cli-pipeline/base-classes/CLIPipelineBase.sh" ]]; then
    echo -e "${RED}❌ Error: Must be run from dhg-mono project root${NC}"
    echo "Current directory: $CURRENT_DIR"
    exit 1
fi

# Verify current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}📍 Current branch: $CURRENT_BRANCH${NC}"

if [[ "$CURRENT_BRANCH" != "improve-cli-pipelines" ]]; then
    echo -e "${YELLOW}⚠️  Warning: Not on improve-cli-pipelines branch${NC}"
    echo "It's recommended to run this from the improve-cli-pipelines branch"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create worktree groups
echo -e "${BLUE}🏗️  Creating worktree groups...${NC}"
echo ""

# Group Alpha - Infrastructure & System Management
echo -e "${GREEN}Creating Group Alpha (Infrastructure & System Management)...${NC}"
ALPHA_PATH="$PARENT_DIR/dhg-mono-alpha-cli-refactor"

if [[ -d "$ALPHA_PATH" ]]; then
    echo -e "${YELLOW}⚠️  Alpha worktree already exists at: $ALPHA_PATH${NC}"
    read -p "Remove and recreate? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git worktree remove "$ALPHA_PATH" 2>/dev/null || rm -rf "$ALPHA_PATH"
    else
        echo "Skipping Alpha worktree creation"
        ALPHA_SKIP=true
    fi
fi

if [[ "$ALPHA_SKIP" != "true" ]]; then
    # Create new branch for Alpha group
    ALPHA_BRANCH="cli-pipeline-alpha-refactor"
    git checkout -b "$ALPHA_BRANCH" 2>/dev/null || git checkout "$ALPHA_BRANCH"
    git worktree add "$ALPHA_PATH" "$ALPHA_BRANCH"
    git checkout "$CURRENT_BRANCH"  # Switch back to original branch
    echo -e "${GREEN}✅ Alpha worktree created: $ALPHA_PATH (branch: $ALPHA_BRANCH)${NC}"
fi

# Group Beta - Content & Data Processing  
echo -e "${GREEN}Creating Group Beta (Content & Data Processing)...${NC}"
BETA_PATH="$PARENT_DIR/dhg-mono-beta-cli-refactor"

if [[ -d "$BETA_PATH" ]]; then
    echo -e "${YELLOW}⚠️  Beta worktree already exists at: $BETA_PATH${NC}"
    read -p "Remove and recreate? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git worktree remove "$BETA_PATH" 2>/dev/null || rm -rf "$BETA_PATH"
    else
        echo "Skipping Beta worktree creation"
        BETA_SKIP=true
    fi
fi

if [[ "$BETA_SKIP" != "true" ]]; then
    git worktree add "$BETA_PATH" "$CURRENT_BRANCH"
    echo -e "${GREEN}✅ Beta worktree created: $BETA_PATH${NC}"
fi

# Group Gamma - Development & Communication
echo -e "${GREEN}Creating Group Gamma (Development & Communication)...${NC}"
GAMMA_PATH="$PARENT_DIR/dhg-mono-gamma-cli-refactor"

if [[ -d "$GAMMA_PATH" ]]; then
    echo -e "${YELLOW}⚠️  Gamma worktree already exists at: $GAMMA_PATH${NC}"
    read -p "Remove and recreate? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git worktree remove "$GAMMA_PATH" 2>/dev/null || rm -rf "$GAMMA_PATH"
    else
        echo "Skipping Gamma worktree creation"
        GAMMA_SKIP=true
    fi
fi

if [[ "$GAMMA_SKIP" != "true" ]]; then
    git worktree add "$GAMMA_PATH" "$CURRENT_BRANCH"
    echo -e "${GREEN}✅ Gamma worktree created: $GAMMA_PATH${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Initializing worktree groups...${NC}"

# Initialize each worktree group
for group in alpha beta gamma; do
    GROUP_UPPER=$(echo "$group" | tr '[:lower:]' '[:upper:]')
    GROUP_PATH_VAR="${GROUP_UPPER}_PATH"
    GROUP_SKIP_VAR="${GROUP_UPPER}_SKIP"
    
    if [[ "${!GROUP_SKIP_VAR}" == "true" ]]; then
        echo "Skipping $group initialization (already exists)"
        continue
    fi
    
    GROUP_PATH="${!GROUP_PATH_VAR}"
    
    echo -e "${GREEN}Initializing Group $GROUP_UPPER...${NC}"
    
    # Navigate to worktree and initialize
    (
        cd "$GROUP_PATH"
        
        # Create temp directories
        mkdir -p temp/{migration-plans,analysis-reports,archived-code,test-results,docs}
        
        # Initialize progress tracking
        echo "timestamp|group|pipeline|status|notes" > temp/group-progress.log
        echo "# Group $GROUP_UPPER Migration Log" > temp/group-migration-log.md
        echo "$(date): Group $GROUP_UPPER initialized" >> temp/group-migration-log.md
        
        # Source the framework and register the group
        if source scripts/cli-pipeline/base-classes/multi-worktree-framework.sh; then
            echo "Framework loaded successfully"
            
            # Register the group
            case "$group" in
                "alpha")
                    register_worktree_group "alpha" "$GROUP_PATH" "17-infrastructure-pipelines"
                    ;;
                "beta") 
                    register_worktree_group "beta" "$GROUP_PATH" "17-content-processing-pipelines"
                    ;;
                "gamma")
                    register_worktree_group "gamma" "$GROUP_PATH" "16-development-communication-pipelines"
                    ;;
            esac
            
            echo "Group $group registered successfully"
        else
            echo "Warning: Could not load framework"
        fi
    )
    
    echo -e "${GREEN}✅ Group $GROUP_UPPER initialized${NC}"
done

echo ""
echo -e "${BLUE}📋 Worktree Setup Complete!${NC}"
echo ""
echo -e "${GREEN}Created Worktrees:${NC}"

if [[ "$ALPHA_SKIP" != "true" ]]; then
    echo -e "  ${YELLOW}Alpha (Infrastructure & System):${NC} $ALPHA_PATH"
fi
if [[ "$BETA_SKIP" != "true" ]]; then
    echo -e "  ${YELLOW}Beta (Content & Data Processing):${NC} $BETA_PATH"  
fi
if [[ "$GAMMA_SKIP" != "true" ]]; then
    echo -e "  ${YELLOW}Gamma (Development & Communication):${NC} $GAMMA_PATH"
fi

echo ""
echo -e "${BLUE}📖 Next Steps:${NC}"
echo ""
echo "1. Review group assignments in:"
echo "   docs/living-docs/cli-pipeline-worktree-group-assignments.md"
echo ""
echo "2. Follow the detailed process in:"
echo "   docs/living-docs/cli-pipeline-detailed-evaluation-refactor-process.md"
echo ""
echo "3. To start working in a group:"
echo -e "   ${YELLOW}cd $PARENT_DIR/dhg-mono-[alpha|beta|gamma]-cli-refactor${NC}"
echo -e "   ${YELLOW}source scripts/cli-pipeline/base-classes/multi-worktree-framework.sh${NC}"
echo ""
echo "4. Each group should follow their assigned pipeline list:"
echo "   - Alpha: 17 infrastructure and system management pipelines"
echo "   - Beta: 17 content and data processing pipelines" 
echo "   - Gamma: 16 development and communication pipelines"
echo ""
echo -e "${GREEN}🎉 Ready for parallel CLI pipeline refactoring!${NC}"

# Show git worktree status
echo ""
echo -e "${BLUE}📊 Git Worktree Status:${NC}"
git worktree list