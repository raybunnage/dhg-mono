#!/bin/bash

# Continuous Documentation CLI Pipeline
# Automates documentation monitoring and updates

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Source the ServiceCLIPipeline base class
source "$SCRIPT_DIR/../base-classes/ServiceCLIPipeline.sh"

# Define service-specific variables
PIPELINE_NAME="continuous_docs"
PIPELINE_DESCRIPTION="Continuous Documentation CLI Pipeline - Automated monitoring and updates"
SERVICE_NAME="continuous-docs-service"
SERVICE_CHECK_COMMAND="health-check"

# Continuous docs-specific commands array
declare -a CONTINUOUS_DOCS_COMMANDS=(
    "check-updates:Check for documentation that needs updating"
    "process-updates:Process and update documentation"
    "sync-status:Sync monitoring status with database"
    "schedule-checks:Set up scheduled monitoring"
    "list-monitored:List all monitored documentation"
    "add-monitor:Add documentation to monitoring"
    "remove-monitor:Remove documentation from monitoring"
    "generate-report:Generate monitoring report"
    "health-check:Check pipeline health"
)

# Initialize the pipeline
init_service_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION"

# Helper function to run TypeScript files
run_ts() {
    npx ts-node --transpile-only "$@"
}

# Command implementations
command_check_updates() {
    print_info "Checking for documentation updates..."
    
    if [ -f "$SCRIPT_DIR/commands/check-updates.ts" ]; then
        run_ts "$SCRIPT_DIR/commands/check-updates.ts" "$@"
    else
        print_error "check-updates.ts not found"
        return 1
    fi
}

command_process_updates() {
    print_info "Processing documentation updates..."
    
    if [ -f "$SCRIPT_DIR/commands/process-updates.ts" ]; then
        run_ts "$SCRIPT_DIR/commands/process-updates.ts" "$@"
    else
        print_error "process-updates.ts not found"
        return 1
    fi
}

command_sync_status() {
    print_info "Syncing monitoring status with database..."
    
    if [ -f "$SCRIPT_DIR/commands/sync-status.ts" ]; then
        run_ts "$SCRIPT_DIR/commands/sync-status.ts" "$@"
    else
        print_error "sync-status.ts not found"
        return 1
    fi
}

command_schedule_checks() {
    print_info "Setting up scheduled monitoring..."
    
    if [ -f "$SCRIPT_DIR/commands/schedule-checks.ts" ]; then
        run_ts "$SCRIPT_DIR/commands/schedule-checks.ts" "$@"
    else
        print_error "schedule-checks.ts not found"
        return 1
    fi
}

command_list_monitored() {
    print_info "Listing monitored documentation..."
    
    if [ -f "$SCRIPT_DIR/commands/list-monitored.ts" ]; then
        run_ts "$SCRIPT_DIR/commands/list-monitored.ts" "$@"
    else
        print_error "list-monitored.ts not found"
        return 1
    fi
}

command_add_monitor() {
    print_info "Adding documentation to monitoring..."
    
    if [ -f "$SCRIPT_DIR/commands/add-monitor.ts" ]; then
        run_ts "$SCRIPT_DIR/commands/add-monitor.ts" "$@"
    else
        print_error "add-monitor.ts not found"
        return 1
    fi
}

command_remove_monitor() {
    print_info "Removing documentation from monitoring..."
    
    if [ -f "$SCRIPT_DIR/commands/remove-monitor.ts" ]; then
        run_ts "$SCRIPT_DIR/commands/remove-monitor.ts" "$@"
    else
        print_error "remove-monitor.ts not found"
        return 1
    fi
}

command_generate_report() {
    print_info "Generating monitoring report..."
    
    if [ -f "$SCRIPT_DIR/commands/generate-report.ts" ]; then
        run_ts "$SCRIPT_DIR/commands/generate-report.ts" "$@"
    else
        print_error "generate-report.ts not found"
        return 1
    fi
}

command_health_check() {
    print_info "Checking pipeline health..."
    
    if [ -f "$SCRIPT_DIR/utilities/health-check.ts" ]; then
        run_ts "$SCRIPT_DIR/utilities/health-check.ts"
    else
        print_warning "health-check.ts not found, running basic check"
        health_check
    fi
}

# Override show_help to add continuous docs-specific information
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    for cmd_desc in "${CONTINUOUS_DOCS_COMMANDS[@]}"; do
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
    echo "  $0 check-updates"
    echo "  $0 add-monitor --path docs/living-docs/example.md"
    echo "  $0 generate-report --format html"
}

# Main command routing
case "${1:-help}" in
    check-updates)
        shift
        track_and_execute "check-updates" command_check_updates "$@"
        ;;
    process-updates)
        shift
        track_and_execute "process-updates" command_process_updates "$@"
        ;;
    sync-status)
        shift
        track_and_execute "sync-status" command_sync_status "$@"
        ;;
    schedule-checks)
        shift
        track_and_execute "schedule-checks" command_schedule_checks "$@"
        ;;
    list-monitored)
        shift
        track_and_execute "list-monitored" command_list_monitored "$@"
        ;;
    add-monitor)
        shift
        track_and_execute "add-monitor" command_add_monitor "$@"
        ;;
    remove-monitor)
        shift
        track_and_execute "remove-monitor" command_remove_monitor "$@"
        ;;
    generate-report)
        shift
        track_and_execute "generate-report" command_generate_report "$@"
        ;;
    health-check)
        shift
        track_and_execute "health-check" command_health_check "$@"
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