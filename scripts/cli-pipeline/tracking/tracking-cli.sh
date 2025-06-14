#!/usr/bin/env bash

# Command Tracking CLI Pipeline - Refactored Version
# Tracks and manages CLI pipeline command executions using SimpleCLIPipeline base class

# Source base class
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BASE_CLASSES_DIR="$PROJECT_ROOT/scripts/cli-pipeline/base-classes"

# Source the base class
if [[ -f "$BASE_CLASSES_DIR/SimpleCLIPipeline.sh" ]]; then
    source "$BASE_CLASSES_DIR/SimpleCLIPipeline.sh"
else
    echo "Error: Cannot find SimpleCLIPipeline.sh at $BASE_CLASSES_DIR"
    exit 1
fi

# Pipeline configuration
PIPELINE_NAME="tracking"
PIPELINE_DESCRIPTION="Command tracking and execution statistics management"
PIPELINE_VERSION="2.0.0"

# Note: For the tracking pipeline itself, we disable tracking to avoid infinite loops
DISABLE_TRACKING=true

# Initialize the pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Command implementations

command_list() {
    log_info "Listing recent command executions..."
    
    # Execute through TypeScript CLI
    if [[ -f "$SCRIPT_DIR/cli.ts" ]]; then
        NODE_PATH="$PROJECT_ROOT/node_modules" npx ts-node -P "$PROJECT_ROOT/tsconfig.json" "$SCRIPT_DIR/cli.ts" list "$@"
    else
        log_warn "TypeScript CLI not found, using database query"
        execute_db_query "list_recent_commands" \
            "SELECT created_at, pipeline_name, command_name, execution_time_ms, success FROM command_history ORDER BY created_at DESC LIMIT 20"
    fi
}

command_stats() {
    log_info "Showing command execution statistics..."
    
    if [[ -f "$SCRIPT_DIR/cli.ts" ]]; then
        NODE_PATH="$PROJECT_ROOT/node_modules" npx ts-node -P "$PROJECT_ROOT/tsconfig.json" "$SCRIPT_DIR/cli.ts" stats "$@"
    else
        log_warn "TypeScript CLI not found, using database query"
        execute_db_query "command_stats" \
            "SELECT pipeline_name, command_name, COUNT(*) as count, AVG(execution_time_ms) as avg_time_ms, SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count FROM command_history GROUP BY pipeline_name, command_name ORDER BY count DESC LIMIT 20"
    fi
}

command_init() {
    log_info "Initializing command_history table in database..."
    
    if [[ -f "$SCRIPT_DIR/cli.ts" ]]; then
        NODE_PATH="$PROJECT_ROOT/node_modules" npx ts-node -P "$PROJECT_ROOT/tsconfig.json" "$SCRIPT_DIR/cli.ts" init "$@"
    else
        log_error "TypeScript CLI required for table initialization"
        return 1
    fi
}

command_test() {
    log_info "Adding test record to command_history table..."
    
    if [[ -f "$SCRIPT_DIR/cli.ts" ]]; then
        NODE_PATH="$PROJECT_ROOT/node_modules" npx ts-node -P "$PROJECT_ROOT/tsconfig.json" "$SCRIPT_DIR/cli.ts" test "$@"
    else
        log_warn "TypeScript CLI not found, using direct insert"
        execute_db_query "insert_test_record" \
            "INSERT INTO command_history (pipeline_name, command_name, full_command, execution_time_ms, success) VALUES ('tracking', 'test', 'tracking-cli.sh test', 100, true)"
    fi
}

command_exec-sql() {
    local sql_file="${1:-}"
    
    if [[ -z "$sql_file" ]]; then
        log_error "SQL file required"
        log_info "Usage: $SCRIPT_NAME exec-sql <sql-file>"
        return 1
    fi
    
    log_info "Executing SQL file: $sql_file"
    
    if [[ -f "$SCRIPT_DIR/exec-sql.sh" ]]; then
        "$SCRIPT_DIR/exec-sql.sh" "$sql_file"
    elif [[ -f "$SCRIPT_DIR/exec-sql.ts" ]]; then
        NODE_PATH="$PROJECT_ROOT/node_modules" npx ts-node -P "$PROJECT_ROOT/tsconfig.json" "$SCRIPT_DIR/exec-sql.ts" "$sql_file"
    else
        log_error "exec-sql script not found"
        return 1
    fi
}

command_clear() {
    log_warn "Clearing command history data..."
    
    # Add confirmation prompt
    read -p "Are you sure you want to clear all command history? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Clear operation cancelled"
        return 0
    fi
    
    if [[ -f "$SCRIPT_DIR/cli.ts" ]]; then
        NODE_PATH="$PROJECT_ROOT/node_modules" npx ts-node -P "$PROJECT_ROOT/tsconfig.json" "$SCRIPT_DIR/cli.ts" clear "$@"
    else
        log_warn "TypeScript CLI not found, using direct delete"
        execute_db_query "clear_history" "DELETE FROM command_history"
    fi
}

command_health-check() {
    log_info "Checking command tracking service health..."
    
    # Run base health check
    health_check || return 1
    
    # Additional tracking-specific checks
    local health_status="healthy"
    local issues=()
    
    # Check for key tracking components
    if [[ ! -f "$SCRIPT_DIR/cli.ts" ]]; then
        health_status="degraded"
        issues+=("cli.ts not found")
    fi
    
    if [[ ! -f "$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts" ]]; then
        health_status="degraded"
        issues+=("shell-command-tracker.ts not found")
    fi
    
    # Check for service availability
    if ! check_service_available "TrackingService"; then
        health_status="degraded"
        issues+=("TrackingService not available")
    fi
    
    # Check database connectivity
    if ! execute_db_query "test_tracking" "SELECT COUNT(*) FROM command_history" >/dev/null 2>&1; then
        health_status="critical"
        issues+=("Cannot access command_history table")
    fi
    
    # Try the health-check script if available
    if [[ -f "$SCRIPT_DIR/health-check.sh" ]]; then
        "$SCRIPT_DIR/health-check.sh"
    else
        log_info "Tracking Health Status: $health_status"
        if [[ ${#issues[@]} -gt 0 ]]; then
            log_warn "Issues found:"
            for issue in "${issues[@]}"; do
                echo "  - $issue"
            done
        else
            log_success "All tracking checks passed"
        fi
    fi
}

# Override the base show_help to add tracking-specific information
show_help() {
    cat << EOF
$PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

USAGE:
  $SCRIPT_NAME <command> [options]

COMMANDS:
  list          List recent command executions
  stats         Show command execution statistics
  init          Initialize the command_history table in database
  test          Add a test record to command_history table
  exec-sql      Execute a SQL file against the database
  clear         Clear all command history (requires confirmation)
  health-check  Check the health of command tracking service
  help          Show this help message

EXAMPLES:
  # List recent commands
  $SCRIPT_NAME list
  
  # Show statistics
  $SCRIPT_NAME stats
  
  # Initialize database table
  $SCRIPT_NAME init
  
  # Test tracking
  $SCRIPT_NAME test
  
  # Execute SQL file
  $SCRIPT_NAME exec-sql my-query.sql

DEBUG MODE:
  DEBUG=1 $SCRIPT_NAME <command>  # Enable debug output

NOTES:
  - Command tracking is disabled for this pipeline to avoid infinite loops
  - Requires database connectivity for most operations
  - Falls back to direct SQL queries when TypeScript CLI is unavailable

EOF
}

# Main command routing
case "$1" in
    "")
        log_error "No command specified"
        show_help
        exit 1
        ;;
    "help"|"--help"|"-h")
        show_help
        exit 0
        ;;
    *)
        route_command "$@"
        ;;
esac