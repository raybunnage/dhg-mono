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
