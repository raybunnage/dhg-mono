#!/bin/bash

# Script to sync all worktrees with latest integration/bug-fixes-tweaks
# Can be run from any worktree directory

echo "🔄 Worktree Sync Script"
echo "======================="
echo "This script will update all worktrees with latest integration/bug-fixes-tweaks"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the root of the git repository (works from any worktree)
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Get the base name of current directory to determine main repo location
CURRENT_DIR_NAME=$(basename "$GIT_ROOT")

# Determine the main worktree directory based on current location
if [[ "$CURRENT_DIR_NAME" == "dhg-mono-integration-bug-fixes-tweaks" ]] || 
   [[ "$CURRENT_DIR_NAME" == "dhg-mono-improve-cli-pipelines" ]] || 
   [[ "$CURRENT_DIR_NAME" == "dhg-mono-improve-google" ]] || 
   [[ "$CURRENT_DIR_NAME" == "dhg-mono-improve-suite" ]]; then
    # We're in one of the worktrees
    MAIN_WORKTREE_DIR=$(dirname "$GIT_ROOT")
else
    # Fallback - assume standard structure
    MAIN_WORKTREE_DIR="/Users/raybunnage/Documents/github"
fi

# Define worktrees to update (using arrays instead of associative arrays for macOS compatibility)
WORKTREE_NAMES=("dhg-mono-improve-cli-pipelines" "dhg-mono-improve-google" "dhg-mono-improve-suite")
WORKTREE_DESCS=("CLI Pipelines work" "Google integration work" "Suite applications work")

# Integration branch name
INTEGRATION_BRANCH="integration/bug-fixes-tweaks"

# Function to sync a single worktree
sync_worktree() {
    local worktree_name=$1
    local worktree_desc=$2
    local worktree_path="$MAIN_WORKTREE_DIR/$worktree_name"
    
    echo -e "\n${BLUE}📁 Processing worktree: $worktree_name${NC}"
    echo "   Description: $worktree_desc"
    echo "   Path: $worktree_path"
    echo "   ----------------------------------------"
    
    # Check if worktree exists
    if [ ! -d "$worktree_path" ]; then
        echo -e "${YELLOW}⚠️  Worktree not found at: $worktree_path${NC}"
        echo "   Skipping..."
        return 1
    fi
    
    # Change to worktree directory
    cd "$worktree_path" || {
        echo -e "${RED}❌ Failed to change to worktree directory${NC}"
        return 1
    }
    
    # Get current branch name
    CURRENT_BRANCH=$(git branch --show-current)
    echo "   Current branch: $CURRENT_BRANCH"
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        echo -e "${YELLOW}   📝 Found uncommitted changes, creating checkpoint commit...${NC}"
        
        # Stage all changes
        git add -A
        
        # Create checkpoint commit
        COMMIT_MSG="checkpoint: auto-sync before merging $INTEGRATION_BRANCH

Auto-generated commit to preserve work before syncing with integration branch.
Created by sync-all-worktrees.sh script.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
        
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}   ✅ Created checkpoint commit${NC}"
    else
        echo "   ✓ Working tree is clean"
    fi
    
    # Fetch latest from origin
    echo "   🔄 Fetching latest from origin..."
    git fetch origin "$INTEGRATION_BRANCH" || {
        echo -e "${RED}❌ Failed to fetch from origin${NC}"
        return 1
    }
    
    # Merge integration branch
    echo "   🔀 Merging $INTEGRATION_BRANCH..."
    if git merge "origin/$INTEGRATION_BRANCH" --no-edit; then
        echo -e "${GREEN}   ✅ Successfully merged $INTEGRATION_BRANCH${NC}"
    else
        echo -e "${RED}❌ Merge conflict detected!${NC}"
        echo "   Please resolve conflicts manually in: $worktree_path"
        echo "   After resolving, run: git merge --continue"
        return 1
    fi
    
    # Push to origin
    echo "   📤 Pushing to origin..."
    if git push origin "$CURRENT_BRANCH"; then
        echo -e "${GREEN}   ✅ Successfully pushed to origin/$CURRENT_BRANCH${NC}"
    else
        echo -e "${RED}❌ Failed to push to origin${NC}"
        echo "   You may need to push manually later"
    fi
    
    # Show current status
    echo "   📊 Final status:"
    COMMITS_AHEAD=$(git rev-list --count "origin/$CURRENT_BRANCH".."$CURRENT_BRANCH" 2>/dev/null || echo "0")
    COMMITS_BEHIND=$(git rev-list --count "$CURRENT_BRANCH".."origin/$CURRENT_BRANCH" 2>/dev/null || echo "0")
    echo "   Branch is $COMMITS_AHEAD commits ahead, $COMMITS_BEHIND commits behind origin/$CURRENT_BRANCH"
    
    return 0
}

# Main execution
echo -e "${BLUE}Starting sync process at: $(date)${NC}"
echo "Integration branch: $INTEGRATION_BRANCH"
echo "Main worktree directory: $MAIN_WORKTREE_DIR"

# Keep track of results
SUCCESS_COUNT=0
FAIL_COUNT=0
FAILED_WORKTREES=()

# Process each worktree
for i in "${!WORKTREE_NAMES[@]}"; do
    if sync_worktree "${WORKTREE_NAMES[$i]}" "${WORKTREE_DESCS[$i]}"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAILED_WORKTREES+=("${WORKTREE_NAMES[$i]}")
    fi
done

# Return to original directory
cd "$GIT_ROOT" || exit 1

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}📊 SYNC SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Successfully synced: $SUCCESS_COUNT worktrees${NC}"
if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${RED}❌ Failed to sync: $FAIL_COUNT worktrees${NC}"
    echo -e "${RED}   Failed worktrees:${NC}"
    for failed in "${FAILED_WORKTREES[@]}"; do
        echo -e "${RED}   - $failed${NC}"
    done
fi

echo -e "\n${BLUE}Completed at: $(date)${NC}"

# Final Status Report
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}📋 FINAL WORKTREE STATUS REPORT${NC}"
echo -e "${BLUE}========================================${NC}"

# Check final status of each worktree
for i in "${!WORKTREE_NAMES[@]}"; do
    worktree_name="${WORKTREE_NAMES[$i]}"
    worktree_desc="${WORKTREE_DESCS[$i]}"
    worktree_path="$MAIN_WORKTREE_DIR/$worktree_name"
    
    if [ -d "$worktree_path" ]; then
        cd "$worktree_path" 2>/dev/null
        if [ $? -eq 0 ]; then
            CURRENT_BRANCH=$(git branch --show-current)
            
            # Check if up to date with integration branch
            git fetch origin "$INTEGRATION_BRANCH" >/dev/null 2>&1
            MERGE_BASE=$(git merge-base HEAD "origin/$INTEGRATION_BRANCH")
            INTEGRATION_HEAD=$(git rev-parse "origin/$INTEGRATION_BRANCH")
            
            # Check for uncommitted changes
            HAS_CHANGES=false
            if ! git diff-index --quiet HEAD -- || [ -n "$(git ls-files --others --exclude-standard)" ]; then
                HAS_CHANGES=true
            fi
            
            # Determine status
            if [ "$MERGE_BASE" = "$INTEGRATION_HEAD" ]; then
                STATUS="${GREEN}✅ READY${NC}"
                STATUS_DETAIL="Up to date with $INTEGRATION_BRANCH"
            else
                STATUS="${YELLOW}⚠️  BEHIND${NC}"
                COMMITS_BEHIND=$(git rev-list --count HEAD.."origin/$INTEGRATION_BRANCH")
                STATUS_DETAIL="$COMMITS_BEHIND commits behind $INTEGRATION_BRANCH"
            fi
            
            # Check if there were merge conflicts
            if [ -f "$worktree_path/.git/MERGE_HEAD" ]; then
                STATUS="${RED}❌ MERGE CONFLICT${NC}"
                STATUS_DETAIL="Unresolved merge conflicts - manual intervention required"
            fi
            
            # Display worktree status
            echo -e "\n${YELLOW}$worktree_name${NC} ($worktree_desc)"
            echo -e "  Branch: $CURRENT_BRANCH"
            echo -e "  Status: $STATUS"
            echo -e "  Details: $STATUS_DETAIL"
            if [ "$HAS_CHANGES" = true ]; then
                echo -e "  ${YELLOW}Note: Has uncommitted changes${NC}"
            fi
            
            # Add to failed list if not ready
            if [[ ! "$STATUS" =~ "READY" ]]; then
                if [[ ! " ${FAILED_WORKTREES[@]} " =~ " ${worktree_name} " ]]; then
                    FAILED_WORKTREES+=("$worktree_name")
                fi
            fi
        fi
    else
        echo -e "\n${YELLOW}$worktree_name${NC} ($worktree_desc)"
        echo -e "  ${RED}Status: ❌ NOT FOUND${NC}"
        echo -e "  Details: Worktree directory does not exist"
    fi
done

# Return to original directory
cd "$GIT_ROOT" || exit 1

# Overall readiness assessment
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}🎯 OVERALL READINESS${NC}"
echo -e "${BLUE}========================================${NC}"

if [ ${#FAILED_WORKTREES[@]} -eq 0 ] && [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ ALL WORKTREES ARE UP TO DATE AND READY FOR NEXT TASKS!${NC}"
    echo -e "\nYou can now safely work in any of the following worktrees:"
    for i in "${!WORKTREE_NAMES[@]}"; do
        echo -e "  • ${GREEN}${WORKTREE_NAMES[$i]}${NC}: ${WORKTREE_DESCS[$i]}"
    done
else
    echo -e "${YELLOW}⚠️  SOME WORKTREES NEED ATTENTION:${NC}"
    echo -e "\nWorktrees ready for work:"
    for i in "${!WORKTREE_NAMES[@]}"; do
        worktree_name="${WORKTREE_NAMES[$i]}"
        if [[ ! " ${FAILED_WORKTREES[@]} " =~ " ${worktree_name} " ]]; then
            echo -e "  • ${GREEN}$worktree_name${NC}: ${WORKTREE_DESCS[$i]}"
        fi
    done
    
    if [ ${#FAILED_WORKTREES[@]} -gt 0 ]; then
        echo -e "\nWorktrees needing attention:"
        for failed in "${FAILED_WORKTREES[@]}"; do
            # Find the description for this failed worktree
            for i in "${!WORKTREE_NAMES[@]}"; do
                if [[ "${WORKTREE_NAMES[$i]}" == "$failed" ]]; then
                    echo -e "  • ${RED}$failed${NC}: ${WORKTREE_DESCS[$i]}"
                    break
                fi
            done
        done
    fi
fi

# Helpful commands
echo -e "\n${YELLOW}📝 Next steps:${NC}"
echo "• Switch to a worktree: cd $MAIN_WORKTREE_DIR/<worktree-name>"
echo "• Check worktree status: git worktree list"
if [ ${#FAILED_WORKTREES[@]} -gt 0 ]; then
    echo "• Resolve conflicts: cd to worktree, then 'git status' to see issues"
    echo "• After fixing conflicts: git add . && git merge --continue"
fi

# Exit with appropriate code
if [ $FAIL_COUNT -gt 0 ] || [ ${#FAILED_WORKTREES[@]} -gt 0 ]; then
    exit 1
else
    exit 0
fi