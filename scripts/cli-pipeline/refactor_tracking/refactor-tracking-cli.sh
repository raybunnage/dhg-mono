#!/bin/bash

# Refactor Tracking CLI - Track google sync command refactoring progress
# This CLI helps manage the refactoring status of google sync commands
# Refactored to use SimpleCLIPipeline base class

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the base class
source "$SCRIPT_DIR/../base-classes/SimpleCLIPipeline.sh" || {
    echo "Error: Failed to source SimpleCLIPipeline.sh"
    exit 1
}

# Initialize with pipeline name
init_cli_pipeline "refactor_tracking" "Refactor Tracking CLI - Google sync command refactoring progress"

# Function to run TypeScript commands with fallback
run_ts_refactor_command() {
    local script_name="$1"
    shift
    
    local script_path="$SCRIPT_DIR/$script_name"
    if [[ -f "$script_path" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$script_path" "$@"
    else
        log_warn "$script_name not found"
        log_info "Fallback: Basic ${script_name%.ts} operation"
        case "$script_name" in
            "show-status.ts")
                log_info "Would show refactoring status overview"
                echo "Refactoring Progress Summary:"
                echo "  - Commands would be categorized by status"
                echo "  - Pipeline filtering would be applied"
                ;;
            "list-commands.ts")
                log_info "Would list commands with filtering options"
                echo "Commands List:"
                echo "  - Would show all tracked commands"
                echo "  - Type and pipeline filtering would be applied"
                ;;
            "update-status.ts")
                log_info "Would update command status: $*"
                ;;
            "mark-tested.ts")
                log_info "Would mark command as tested: $*"
                ;;
            "sign-off-command.ts")
                log_info "Would sign off on command: $*"
                ;;
            "show-command.ts")
                log_info "Would show command details: $*"
                ;;
            "needs-work.ts")
                log_info "Would list commands needing attention"
                echo "Commands Needing Work:"
                echo "  - Would show commands with status: not_started, in_progress, needs_testing"
                ;;
            "add-note.ts")
                log_info "Would add note to command: $*"
                ;;
        esac
    fi
}

# Define commands

command_help() {
    show_help
}

command_status() {
    log_info "Showing refactoring status..."
    run_ts_refactor_command "show-status.ts" "$@"
}

command_list() {
    log_info "Listing commands..."
    run_ts_refactor_command "list-commands.ts" "$@"
}

command_update() {
    local command_name="$1"
    local status="$2"
    
    if [[ -z "$command_name" ]] || [[ -z "$status" ]]; then
        log_error "Command name and status required"
        echo "Usage: ./refactor-tracking-cli.sh update <name> <status>"
        echo "Status values: not_started, in_progress, needs_testing, tested, signed_off, archived"
        return 1
    fi
    
    log_info "Updating command status: $command_name → $status"
    run_ts_refactor_command "update-status.ts" "$@"
}

command_test-complete() {
    local command_name="$1"
    
    if [[ -z "$command_name" ]]; then
        log_error "Command name required"
        echo "Usage: ./refactor-tracking-cli.sh test-complete <name>"
        return 1
    fi
    
    log_info "Marking command as tested: $command_name"
    run_ts_refactor_command "mark-tested.ts" "$@"
}

command_sign-off() {
    local command_name="$1"
    
    if [[ -z "$command_name" ]]; then
        log_error "Command name required"
        echo "Usage: ./refactor-tracking-cli.sh sign-off <name>"
        return 1
    fi
    
    log_info "Signing off on command: $command_name"
    run_ts_refactor_command "sign-off-command.ts" "$@"
}

command_show() {
    local command_name="$1"
    
    if [[ -z "$command_name" ]]; then
        log_error "Command name required"
        echo "Usage: ./refactor-tracking-cli.sh show <name>"
        return 1
    fi
    
    log_info "Showing details for command: $command_name"
    run_ts_refactor_command "show-command.ts" "$@"
}

command_needs-work() {
    log_info "Listing commands that need attention..."
    run_ts_refactor_command "needs-work.ts" "$@"
}

command_add-note() {
    local command_name="$1"
    
    if [[ -z "$command_name" ]]; then
        log_error "Command name required"
        echo "Usage: ./refactor-tracking-cli.sh add-note <name>"
        return 1
    fi
    
    log_info "Adding note to command: $command_name"
    run_ts_refactor_command "add-note.ts" "$@"
}

command_health-check() {
    log_info "🏥 Running health check for refactor_tracking pipeline..."
    
    local health_script="$SCRIPT_DIR/health-check.sh"
    if [[ -f "$health_script" ]]; then
        bash "$health_script"
    else
        log_warn "health-check.sh not found"
        log_info "Basic health check:"
        
        # Check environment variables
        if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
            log_error "Missing required environment variables"
            return 1
        else
            log_success "Environment variables configured"
        fi
        
        # Check TypeScript files
        local ts_count=$(find "$SCRIPT_DIR" -name "*.ts" | wc -l)
        log_success "Found $ts_count TypeScript command files"
        
        log_success "✅ refactor_tracking pipeline is healthy"
    fi
}

# Override help to add refactor tracking specific examples
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "This CLI helps manage the refactoring status of google sync commands"
    echo ""
    echo "USAGE:"
    echo "  ./refactor-tracking-cli.sh <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  status [--pipeline <name>] Show refactoring status (filter by pipeline)"
    echo "  list [--type <type>] [--pipeline <name>]  List commands (filter by type/pipeline)"
    echo "  update <name> <status>    Update command status"
    echo "  test-complete <name>      Mark command as tested with results"
    echo "  sign-off <name>          Sign off on a command"
    echo "  show <name>              Show details for a command"
    echo "  needs-work               List commands needing attention"
    echo "  add-note <name>          Add a note to a command"
    echo "  health-check             Run health check for refactor tracking pipeline"
    echo "  help                     Show this help message"
    echo ""
    echo "STATUS VALUES:"
    echo "  not_started              Command refactoring not yet started"
    echo "  in_progress              Currently being refactored"
    echo "  needs_testing            Refactoring complete, needs testing"
    echo "  tested                   Testing complete, ready for sign-off"
    echo "  signed_off               Approved and complete"
    echo "  archived                 Archived or deprecated"
    echo ""
    echo "EXAMPLES:"
    echo "  ./refactor-tracking-cli.sh status"
    echo "  ./refactor-tracking-cli.sh list --pipeline google_sync"
    echo "  ./refactor-tracking-cli.sh update sync-metadata in_progress"
    echo "  ./refactor-tracking-cli.sh test-complete sync-metadata"
    echo "  ./refactor-tracking-cli.sh sign-off sync-metadata"
    echo "  ./refactor-tracking-cli.sh needs-work"
}

# Main execution
route_command "$@"