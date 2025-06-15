#!/bin/bash

# Work Summaries CLI - Track AI assistant work
# Commands for tracking and managing AI work summaries

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Source the SimpleCLIPipeline base class
source "$SCRIPT_DIR/../base-classes/SimpleCLIPipeline.sh"

# Pipeline configuration
PIPELINE_NAME="work_summaries"
PIPELINE_DESCRIPTION="Work Summaries CLI - Track AI assistant work"
PIPELINE_VERSION="1.0.0"

# Initialize the pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Command implementations
command_add() {
    print_info "Adding new work summary..."
    npx ts-node "$SCRIPT_DIR/add-summary.ts" "$@"
}

command_auto() {
    print_info "Auto-generating work summary..."
    npx ts-node "$SCRIPT_DIR/auto-summary.ts" "$@"
}

command_import() {
    print_info "Importing summaries from claude_code_prompts.txt..."
    npx ts-node "$SCRIPT_DIR/import-from-prompts.ts" "$@"
}

command_link_tasks() {
    print_info "Linking work summaries to dev tasks using git history..."
    
    if [ -f "$SCRIPT_DIR/commands/link-dev-tasks.ts" ]; then
        npx ts-node "$SCRIPT_DIR/commands/link-dev-tasks.ts" "$@"
    else
        print_error "link-dev-tasks.ts not found"
        return 1
    fi
}

command_health_check() {
    print_info "Running health check for work summaries pipeline..."
    
    if [ -f "$SCRIPT_DIR/health-check.sh" ]; then
        "$SCRIPT_DIR/health-check.sh"
    else
        print_warning "health-check.sh not found, running basic check"
        health_check
    fi
}

# Override show_help to add work summaries-specific information
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  add          Add a new work summary (manual)"
    echo "  auto         Auto-generate a work summary (AI-friendly)"
    echo "  import       Import summaries from claude_code_prompts.txt"
    echo "  link-tasks   Link work summaries to dev tasks using git history"
    echo "  health-check Run health check for work summaries pipeline"
    echo ""
    echo "Examples:"
    echo "  $0 add --title \"Fixed bug\" --content \"Description\" --commands \"cmd1,cmd2\""
    echo "  $0 auto \"Fixed bug\" \"Description of the fix\""
    echo "  $0 import"
    echo "  $0 link-tasks"
}

# Main command routing
case "${1:-help}" in
    add)
        shift
        track_and_execute "add" command_add "$@"
        ;;
    auto)
        shift
        track_and_execute "auto" command_auto "$@"
        ;;
    import)
        shift
        track_and_execute "import" command_import "$@"
        ;;
    link-tasks)
        shift
        track_and_execute "link-tasks" command_link_tasks "$@"
        ;;
    health-check)
        shift
        track_and_execute "health-check" command_health_check "$@"
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