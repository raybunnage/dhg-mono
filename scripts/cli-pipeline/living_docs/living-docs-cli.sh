#!/bin/bash

# Living Docs CLI - Management tool for living documentation
# This script provides commands for managing and prioritizing living documents

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source common functions
source "$PROJECT_ROOT/scripts/cli-pipeline/core/load-env.sh"

# Track command execution
track_command() {
    local pipeline="living_docs"
    local command="$1"
    shift
    
    echo "Tracking command: $command for pipeline: $pipeline"
    
    # Use the utilities CLI to track the command
    "$PROJECT_ROOT/scripts/cli-pipeline/utilities/utilities-cli.sh" track-command \
        --pipeline "$pipeline" \
        --command "$command" \
        --args "$*" 2>/dev/null || true
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
    
Options:
    -h, --help         Show this help message

Examples:
    ./living-docs-cli.sh prioritize
    ./living-docs-cli.sh check-reviews
    ./living-docs-cli.sh update-template my-doc.md

EOF
}

# Command handlers
cmd_prioritize() {
    echo "🚀 Generating living docs priority dashboard..."
    track_command "prioritize" "$@"
    ts-node "$SCRIPT_DIR/prioritize-docs.ts" "$@"
}

cmd_analyze() {
    echo "🔍 Analyzing living documents..."
    track_command "analyze" "$@"
    ts-node "$SCRIPT_DIR/analyze-docs.ts" "$@"
}

cmd_update_template() {
    echo "📝 Updating document to latest template..."
    track_command "update-template" "$@"
    ts-node "$SCRIPT_DIR/update-to-template.ts" "$@"
}

cmd_check_reviews() {
    echo "📅 Checking documents needing review..."
    track_command "check-reviews" "$@"
    ts-node "$SCRIPT_DIR/check-reviews.ts" "$@"
}

cmd_consolidate() {
    echo "🔄 Consolidating duplicate documents..."
    track_command "consolidate" "$@"
    ts-node "$SCRIPT_DIR/consolidate-duplicates.ts" "$@"
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
    -h|--help|help)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac