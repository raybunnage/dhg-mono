#!/bin/bash

# Living Docs CLI - Management tool for living documentation
# This script provides commands for managing and prioritizing living documents

LIVING_DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$LIVING_DOCS_DIR/../../.." && pwd)"

# Source common functions
source "$PROJECT_ROOT/scripts/cli-pipeline/core/load-env.sh"

# Track command execution
track_command() {
    local pipeline="living_docs"
    local command_name="$1"
    local full_command="$2"
    
    local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
    if [ -f "$TRACKER_TS" ]; then
        echo "🔍 Tracking command: $command_name"
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline" "$command_name" "$full_command"
    else
        echo "ℹ️ Tracking not available. Running command directly."
        eval "$full_command"
    fi
}

# Display help
show_help() {
    cat << EOF
Living Docs CLI - Manage and prioritize living documentation

Usage: ./living-docs-cli.sh [command] [options]

Commands:
    prioritize          Generate priority dashboard for all living docs
    analyze             Analyze living docs for duplicates and issues
    update-template     Update a document to use the latest template
    check-reviews       List documents needing review
    consolidate         Merge duplicate documents
    health-check        Check health of living docs system
    refresh             Scan for new living docs and update database
    
Options:
    -h, --help         Show this help message

Examples:
    ./living-docs-cli.sh prioritize
    ./living-docs-cli.sh check-reviews
    ./living-docs-cli.sh update-template my-doc.md
    ./living-docs-cli.sh refresh

EOF
}

# Command handlers
cmd_prioritize() {
    echo "🚀 Generating living docs priority dashboard..."
    local cmd="npx ts-node --project \"$PROJECT_ROOT/tsconfig.node.json\" \"$LIVING_DOCS_DIR/prioritize-docs.ts\" $@"
    track_command "prioritize" "$cmd"
}

cmd_analyze() {
    echo "🔍 Analyzing living documents..."
    local cmd="npx ts-node --project \"$PROJECT_ROOT/tsconfig.node.json\" \"$LIVING_DOCS_DIR/analyze-docs.ts\" $@"
    track_command "analyze" "$cmd"
}

cmd_update_template() {
    echo "📝 Updating document to latest template..."
    local cmd="npx ts-node --project \"$PROJECT_ROOT/tsconfig.node.json\" \"$LIVING_DOCS_DIR/update-to-template.ts\" $@"
    track_command "update-template" "$cmd"
}

cmd_check_reviews() {
    echo "📅 Checking documents needing review..."
    local cmd="npx ts-node --project \"$PROJECT_ROOT/tsconfig.node.json\" \"$LIVING_DOCS_DIR/check-reviews.ts\" $@"
    track_command "check-reviews" "$cmd"
}

cmd_consolidate() {
    echo "🔄 Consolidating duplicate documents..."
    local cmd="npx ts-node --project \"$PROJECT_ROOT/tsconfig.node.json\" \"$LIVING_DOCS_DIR/consolidate-duplicates.ts\" $@"
    track_command "consolidate" "$cmd"
}

cmd_health_check() {
    echo "🏥 Running health check..."
    track_command "health-check" "$@"
    
    # Check if prioritization service exists
    if [ -f "$PROJECT_ROOT/packages/shared/services/living-docs-prioritization-service.ts" ]; then
        echo "✅ Prioritization service found"
    else
        echo "❌ Prioritization service missing"
        exit 1
    fi
    
    # Check if living docs directory exists
    if [ -d "$PROJECT_ROOT/docs/living-docs" ]; then
        echo "✅ Living docs directory found"
        DOC_COUNT=$(find "$PROJECT_ROOT/docs/living-docs" -name "*.md" | wc -l)
        echo "   Found $DOC_COUNT documents"
    else
        echo "❌ Living docs directory missing"
        exit 1
    fi
    
    echo "✅ Health check passed"
}

cmd_refresh() {
    echo "🔄 Refreshing living docs database..."
    local cmd="npx ts-node --project \"$PROJECT_ROOT/tsconfig.node.json\" \"$LIVING_DOCS_DIR/refresh-docs.ts\" $@"
    track_command "refresh" "$cmd"
}

# Main command dispatcher
case "$1" in
    prioritize)
        shift
        cmd_prioritize "$@"
        ;;
    analyze)
        shift
        cmd_analyze "$@"
        ;;
    update-template)
        shift
        cmd_update_template "$@"
        ;;
    check-reviews)
        shift
        cmd_check_reviews "$@"
        ;;
    consolidate)
        shift
        cmd_consolidate "$@"
        ;;
    health-check)
        shift
        cmd_health_check "$@"
        ;;
    refresh)
        shift
        cmd_refresh "$@"
        ;;
    -h|--help|help)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac