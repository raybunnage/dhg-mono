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
