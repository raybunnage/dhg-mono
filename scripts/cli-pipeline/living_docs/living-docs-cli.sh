#!/bin/bash

# Living Docs CLI - Management tool for living documentation
# This script provides commands for managing and prioritizing living documents

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Source the ServiceCLIPipeline base class
source "$SCRIPT_DIR/../base-classes/ServiceCLIPipeline.sh"

# Define service-specific variables
PIPELINE_NAME="living_docs"
PIPELINE_DESCRIPTION="Living Docs CLI - Manage and prioritize living documentation"
SERVICE_NAME="living-docs-service"
SERVICE_CHECK_COMMAND="health-check"

# Living docs-specific commands array
declare -a LIVING_DOCS_COMMANDS=(
    "prioritize:Generate priority dashboard for all living docs"
    "analyze:Analyze living docs for duplicates and issues"
    "update-template:Update a document to use the latest template"
    "check-reviews:List documents needing review"
    "consolidate:Merge duplicate documents"
    "health-check:Check health of living docs system"
    "refresh:Scan for new living docs and update database"
)

# Initialize the pipeline
init_service_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION"

# Helper function to run TypeScript files
run_ts() {
    npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$@"
}

# Command implementations
command_prioritize() {
    print_info "Generating living docs priority dashboard..."
    
    if [ -f "$SCRIPT_DIR/prioritize-docs.ts" ]; then
        run_ts "$SCRIPT_DIR/prioritize-docs.ts" "$@"
    else
        print_error "prioritize-docs.ts not found"
        return 1
    fi
}

command_analyze() {
    print_info "Analyzing living documents..."
    
    if [ -f "$SCRIPT_DIR/analyze-docs.ts" ]; then
        run_ts "$SCRIPT_DIR/analyze-docs.ts" "$@"
    else
        print_error "analyze-docs.ts not found"
        return 1
    fi
}

command_update_template() {
    print_info "Updating document to latest template..."
    
    if [ -f "$SCRIPT_DIR/update-to-template.ts" ]; then
        run_ts "$SCRIPT_DIR/update-to-template.ts" "$@"
    else
        print_error "update-to-template.ts not found"
        return 1
    fi
}

command_check_reviews() {
    print_info "Checking documents needing review..."
    
    if [ -f "$SCRIPT_DIR/check-reviews.ts" ]; then
        run_ts "$SCRIPT_DIR/check-reviews.ts" "$@"
    else
        print_error "check-reviews.ts not found"
        return 1
    fi
}

command_consolidate() {
    print_info "Consolidating duplicate documents..."
    
    if [ -f "$SCRIPT_DIR/consolidate-duplicates.ts" ]; then
        run_ts "$SCRIPT_DIR/consolidate-duplicates.ts" "$@"
    else
        print_error "consolidate-duplicates.ts not found"
        return 1
    fi
}

command_health_check() {
    print_info "Running health check..."
    
    # Check if prioritization service exists
    if [ -f "$PROJECT_ROOT/packages/shared/services/living-docs-prioritization-service.ts" ]; then
        print_success "Prioritization service found"
    else
        print_error "Prioritization service missing"
        return 1
    fi
    
    # Check if living docs directory exists
    if [ -d "$PROJECT_ROOT/docs/living-docs" ]; then
        print_success "Living docs directory found"
        DOC_COUNT=$(find "$PROJECT_ROOT/docs/living-docs" -name "*.md" | wc -l | tr -d ' ')
        print_info "Found $DOC_COUNT documents"
    else
        print_error "Living docs directory missing"
        return 1
    fi
    
    print_success "Health check passed"
}

command_refresh() {
    print_info "Refreshing living docs database..."
    
    if [ -f "$SCRIPT_DIR/refresh-docs.ts" ]; then
        run_ts "$SCRIPT_DIR/refresh-docs.ts" "$@"
    else
        print_error "refresh-docs.ts not found"
        return 1
    fi
}

# Override show_help to add living docs-specific information
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    for cmd_desc in "${LIVING_DOCS_COMMANDS[@]}"; do
        IFS=':' read -r cmd desc <<< "$cmd_desc"
        printf "  %-20s %s\n" "$cmd" "$desc"
    done
    
    # Add service commands
    echo ""
    echo "Service Commands:"
    printf "  %-20s %s\n" "service-status" "Check service health status"
    printf "  %-20s %s\n" "service-restart" "Restart the service"
    printf "  %-20s %s\n" "service-logs" "View service logs"
    
    echo ""
    echo "Examples:"
    echo "  $0 prioritize"
    echo "  $0 check-reviews"
    echo "  $0 update-template my-doc.md"
    echo "  $0 refresh"
}

# Main command routing
case "${1:-help}" in
    prioritize)
        shift
        track_and_execute "prioritize" command_prioritize "$@"
        ;;
    analyze)
        shift
        track_and_execute "analyze" command_analyze "$@"
        ;;
    update-template)
        shift
        track_and_execute "update-template" command_update_template "$@"
        ;;
    check-reviews)
        shift
        track_and_execute "check-reviews" command_check_reviews "$@"
        ;;
    consolidate)
        shift
        track_and_execute "consolidate" command_consolidate "$@"
        ;;
    health-check)
        shift
        track_and_execute "health-check" command_health_check "$@"
        ;;
    refresh)
        shift
        track_and_execute "refresh" command_refresh "$@"
        ;;
    # Service management commands
    service-status)
        shift
        track_and_execute "service-status" health_check_service "${SERVICE_NAME:-$1}" "$@"
        ;;
    service-restart)
        shift
        track_and_execute "service-restart" restart_service "${SERVICE_NAME:-$1}" "$@"
        ;;
    service-logs)
        shift
        track_and_execute "service-logs" show_service_logs "${SERVICE_NAME:-$1}" "$@"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac