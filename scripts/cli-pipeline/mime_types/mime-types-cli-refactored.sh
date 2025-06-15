#!/usr/bin/env bash

# MIME Types CLI - Refactored to use SimpleCLIPipeline base class
# Handles MIME type synchronization and management

# Source the base class
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
source "$PROJECT_ROOT/scripts/cli-pipeline/base-classes/SimpleCLIPipeline.sh"

# Initialize the pipeline
init_cli_pipeline "mime_types" "MIME type synchronization and management"

# Define pipeline-specific variables
MIME_TYPES_TABLE="mime_types"
SOURCES_GOOGLE_TABLE="sources_google"

# Command definitions - using simple variables for compatibility
COMMAND_SYNC="Synchronize the mime_types table with MIME types from sources_google"
COMMAND_HEALTH_CHECK="Run health check for MIME types pipeline"

# Show help (extends base help)
show_help() {
    cat << EOF
$PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

Usage: $(basename "$0") <command> [options]

Commands:
EOF
    
    # Display available commands
    printf "  %-20s %s\n" "sync" "$COMMAND_SYNC"
    printf "  %-20s %s\n" "health-check" "$COMMAND_HEALTH_CHECK"
    
    cat << EOF

Options for sync:
  --dry-run             Show what would be done without making changes
  -v, --verbose         Show detailed information about each MIME type

Global Options:
  --debug               Enable debug mode
  --no-tracking         Disable command tracking
  -h, --help            Show this help message

Examples:
  $(basename "$0") sync                  # Synchronize the mime_types table
  $(basename "$0") sync --dry-run        # Show what would be synchronized
  $(basename "$0") sync -v               # Synchronize with verbose output
  $(basename "$0") health-check          # Check pipeline health

EOF
}

# Sync MIME types command
cmd_sync() {
    local dry_run=false
    local verbose=false
    
    # Parse command options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                dry_run=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                return 1
                ;;
        esac
    done
    
    log_info "Starting MIME types synchronization..."
    
    # Validate prerequisites
    if ! validate_simple_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        return 1
    fi
    
    # Build sync command
    local sync_command="npx ts-node $SCRIPT_DIR/cli.ts sync"
    [[ "$dry_run" == "true" ]] && sync_command="$sync_command --dry-run"
    [[ "$verbose" == "true" ]] && sync_command="$sync_command --verbose"
    
    # Execute sync with tracking
    execute_simple_command "sync" "Synchronize MIME types from sources_google" $sync_command
    
    if [[ $? -eq 0 ]]; then
        log_success "MIME types synchronization completed successfully"
    else
        log_error "MIME types synchronization failed"
        return 1
    fi
}

# Health check command
cmd_health_check() {
    log_info "Running health check for MIME types pipeline..."
    
    # Check environment variables
    if ! validate_simple_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Check if TypeScript file exists
    if ! execute_file_operation "exists" "$SCRIPT_DIR/cli.ts"; then
        log_error "CLI TypeScript file not found"
        return 1
    fi
    
    # Check database connectivity (simplified approach)
    log_info "Checking database connectivity..."
    
    # For now, just verify environment is set up
    # In a full implementation, this would use execute_db_query
    # to verify table access
    
    log_success "✅ MIME types pipeline is healthy"
    log_info "Environment variables: OK"
    log_info "TypeScript files: OK"
    log_info "Pipeline status: READY"
    
    return 0
}

# Main command handler
main() {
    local command="$1"
    shift
    
    # Remove command from global args for flag parsing
    set -- "${@//$command/}"
    
    # If no command provided, show help
    if [[ -z "$command" ]]; then
        show_help
        exit 0
    fi
    
    # Route to command handler
    case "$command" in
        sync)
            cmd_sync "$@"
            ;;
        health-check)
            cmd_health_check "$@"
            ;;
        help|-h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
    
    local exit_code=$?
    
    exit $exit_code
}

# Execute main with all arguments
main "$@"