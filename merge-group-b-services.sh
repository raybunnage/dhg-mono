#!/bin/bash

# GROUP B Services Cherry-Pick Merge Script
# This script merges the 5 refactored GROUP B services into integration/bug-fixes-tweaks

set -e  # Exit on any error

echo "🚀 Starting GROUP B Services Cherry-Pick Merge"
echo "================================================="

# Define the integration worktree path
INTEGRATION_WORKTREE="/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks"

# Check if integration worktree exists
if [ ! -d "$INTEGRATION_WORKTREE" ]; then
    echo "❌ ERROR: Integration worktree not found at $INTEGRATION_WORKTREE"
    echo "Please ensure the worktree exists and the path is correct."
    exit 1
fi

echo "✅ Found integration worktree at $INTEGRATION_WORKTREE"

# Navigate to integration worktree
cd "$INTEGRATION_WORKTREE"
echo "📂 Changed to integration worktree directory"

# Ensure we're on the right branch
echo "🔄 Checking out integration/bug-fixes-tweaks branch..."
git checkout integration/bug-fixes-tweaks

# Pull latest changes
echo "⬇️  Pulling latest changes from origin..."
git pull origin integration/bug-fixes-tweaks

# Show current status
echo "📊 Current branch status:"
git status --porcelain
echo ""

# Define the GROUP B service commits (finalized commits in chronological order)
declare -a COMMITS=(
    "de43f4a0:ElementCriteriaService"
    "60cc662c:ElementCatalogService" 
    "d52df674:PromptManagementService"
    "8758c815:FileService"
    "73e087a3:MediaAnalyticsService"
)

echo "🍒 Starting cherry-pick process for ${#COMMITS[@]} services..."
echo ""

# Cherry-pick each commit
for commit_info in "${COMMITS[@]}"; do
    IFS=':' read -r commit_hash service_name <<< "$commit_info"
    
    echo "🔄 Cherry-picking $service_name ($commit_hash)..."
    
    if git cherry-pick "$commit_hash"; then
        echo "✅ Successfully cherry-picked $service_name"
    else
        echo "⚠️  Conflict detected for $service_name"
        echo "Please resolve conflicts manually:"
        echo "  1. Edit the conflicted files"
        echo "  2. Run: git add ."
        echo "  3. Run: git cherry-pick --continue"
        echo "  4. Re-run this script to continue with remaining services"
        echo ""
        echo "Current conflicts:"
        git status --porcelain | grep "^UU\|^AA\|^DD"
        exit 1
    fi
    echo ""
done

echo "🎉 All GROUP B services successfully cherry-picked!"
echo ""

# Show final status
echo "📊 Final status:"
git log --oneline -10
echo ""

# Push changes
echo "⬆️  Pushing changes to origin..."
if git push origin integration/bug-fixes-tweaks; then
    echo "✅ Successfully pushed all changes to integration/bug-fixes-tweaks"
else
    echo "⚠️  Failed to push changes. Please check for conflicts or permissions."
    exit 1
fi

echo ""
echo "🎊 GROUP B Services Merge Complete!"
echo "================================================="
echo "✅ All 5 services have been successfully merged:"
echo "   • ElementCriteriaService"
echo "   • ElementCatalogService"
echo "   • PromptManagementService (BREAKING CHANGES - see MIGRATION.md)"
echo "   • FileService (BREAKING CHANGES - see MIGRATION.md)"
echo "   • MediaAnalyticsService"
echo ""
echo "⚠️  IMPORTANT: Review breaking changes for PromptManagementService and FileService"
echo "📚 Check MIGRATION.md files in their respective service directories"
echo ""
echo "🔄 Next steps:"
echo "   1. Test the integration branch"
echo "   2. Update any dependent code for breaking changes"
echo "   3. Consider merging integration/bug-fixes-tweaks to development"