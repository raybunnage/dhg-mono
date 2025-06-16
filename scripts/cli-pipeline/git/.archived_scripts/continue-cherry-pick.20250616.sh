#!/bin/bash

# Continue Cherry-Pick Script for GROUP B Services
# This script continues the cherry-pick process after resolving conflicts

set -e

echo "🔄 Continuing GROUP B Services Cherry-Pick Process"
echo "================================================="

# Define the integration worktree path
INTEGRATION_WORKTREE="/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks"

# Navigate to integration worktree
cd "$INTEGRATION_WORKTREE"
echo "📂 Changed to integration worktree directory"

# Check current status
echo "📊 Current status:"
git status --porcelain

# Continue the cherry-pick (assuming conflicts have been resolved)
echo "🔄 Continuing cherry-pick for PromptManagementService..."
git add .
git cherry-pick --continue

echo "✅ PromptManagementService cherry-pick completed"
echo ""

# Continue with remaining services
declare -a REMAINING_COMMITS=(
    "8758c815:FileService"
    "73e087a3:MediaAnalyticsService"
)

echo "🍒 Continuing with remaining ${#REMAINING_COMMITS[@]} services..."

for commit_info in "${REMAINING_COMMITS[@]}"; do
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
        echo "  4. Re-run this script to continue"
        echo ""
        echo "Current conflicts:"
        git status --porcelain | grep "^UU\|^AA\|^DD"
        exit 1
    fi
    echo ""
done

echo "🎉 All remaining GROUP B services successfully cherry-picked!"
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
echo "🎊 GROUP B Services Cherry-Pick Complete!"
echo "================================================="
echo "✅ All 5 services have been successfully merged:"
echo "   • ElementCriteriaService ✅"
echo "   • ElementCatalogService ✅"
echo "   • PromptManagementService ✅ (conflicts resolved)"
echo "   • FileService ✅"
echo "   • MediaAnalyticsService ✅"
echo ""
echo "⚠️  IMPORTANT: Review breaking changes for PromptManagementService and FileService"
echo "📚 Check MIGRATION.md files in their respective service directories"
echo ""
echo "🔄 Next steps:"
echo "   1. Test the integration branch"
echo "   2. Update any dependent code for breaking changes"
echo "   3. Consider merging integration/bug-fixes-tweaks to development"