#!/bin/zsh

# Helper functions for Group ALPHA refactoring

# Update progress for a pipeline
update_progress() {
    local pipeline=$1
    local status=$2
    local notes=$3
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') | $pipeline | $status | $notes" >> temp/cli-refactor-alpha/progress.log
    echo "✅ Updated: $pipeline -> $status"
}

# Check for shared issues
check_issues() {
    local pipeline=$1
    echo "🔍 Checking issues for $pipeline..."
    grep -i "$pipeline" docs/living-docs/cli-service-integration-issues.md || echo "No documented issues found"
}

# Create checkpoint
checkpoint() {
    local pipeline=$1
    local stage=$2
    
    git add -A
    git commit -m "checkpoint: $stage - $pipeline refactoring" || true
    echo "✅ Checkpoint created: $stage - $pipeline"
}

# Quick status check
status() {
    echo "📊 Group ALPHA Progress:"
    echo "======================="
    if [[ -f temp/cli-refactor-alpha/progress.log ]]; then
        tail -10 temp/cli-refactor-alpha/progress.log
    else
        echo "No progress logged yet"
    fi
}

echo "✅ Helper functions loaded. Available commands:"
echo "  - update_progress <pipeline> <status> <notes>"
echo "  - check_issues <pipeline>"
echo "  - checkpoint <pipeline> <stage>"
echo "  - status"
