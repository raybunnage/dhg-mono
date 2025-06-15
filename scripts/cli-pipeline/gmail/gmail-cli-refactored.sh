#!/bin/bash

# Gmail CLI Pipeline - Refactored
# Provides a command-line interface for Gmail operations

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="gmail"
PIPELINE_DESCRIPTION="Gmail synchronization and processing"
PIPELINE_VERSION="1.0.0"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [[ -f "$ENV_DEV_FILE" ]]; then
    echo "ℹ️  INFO [$PIPELINE_NAME] Loading environment variables from .env.development..."
    export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY" "$ENV_DEV_FILE" | grep -v '^#' | xargs)
fi

# Logging functions
log_info() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  INFO [$PIPELINE_NAME] $*"
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ ERROR [$PIPELINE_NAME] $*" >&2
}

log_success() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ SUCCESS [$PIPELINE_NAME] $*"
}

log_warning() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  WARNING [$PIPELINE_NAME] $*"
}

# Command tracking wrapper
track_command() {
    local command_name="$1"
    shift
    local full_command="$@"
    
    # Log command execution
    log_info "Executing: $command_name"
    
    # Try to use tracking service if available
    local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
    if [[ -f "$TRACKER_TS" ]]; then
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$PIPELINE_NAME" "$command_name" "$full_command" 2>&1
    else
        eval "$full_command"
    fi
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    # Check for Python
    if ! command -v python3 &> /dev/null; then
        missing_deps+=("python3")
    fi
    
    # Check for ts-node
    if ! command -v npx &> /dev/null; then
        missing_deps+=("npx")
    fi
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_warning "Please install the missing dependencies and try again."
        return 1
    fi
    
    return 0
}

# Execute TypeScript command
execute_ts_command() {
    local command_name="$1"
    local ts_file="$2"
    shift 2
    
    if [[ ! -f "$ts_file" ]]; then
        log_error "Command implementation not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "npx ts-node '$ts_file' $@"
}

# Execute JavaScript command
execute_js_command() {
    local command_name="$1"
    local js_file="$2"
    shift 2
    
    if [[ ! -f "$js_file" ]]; then
        log_error "Command implementation not found: $js_file"
        return 1
    fi
    
    track_command "$command_name" "node '$js_file' $@"
}

# Help command
cmd_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  sync-emails         Sync emails from Gmail"
    echo "    --days=N          Number of days to sync (default: 7)"
    echo "    --importance=N    Importance level filter (1-3)"
    echo "  process-emails      Process emails with AI"
    echo "    --limit=N         Limit number of items to process (default: 50)"
    echo "  manage-addresses    Manage important email addresses"
    echo "    add EMAIL         Add an email address"
    echo "      --importance=N  Set importance level (1-3, default: 1)"
    echo "    list              List all important addresses"
    echo "    remove EMAIL      Remove an email address"
    echo "  analyze-concepts    Analyze email concepts"
    echo "    --from=DATE       Start date for analysis"
    echo "  export-data         Export email data"
    echo "    --format=FORMAT   Export format (csv, json, default: csv)"
    echo "    --output=PATH     Output directory (default: ./exports/)"
    echo "  test-connection     Test database connection"
    echo "  stats               Show email statistics"
    echo "  import-sqlite       Import SQLite email data from CSV files"
    echo "  status              Show pipeline status"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $(basename "$0") sync-emails --days=7"
    echo "  $(basename "$0") process-emails --limit=50"
    echo "  $(basename "$0") manage-addresses add 'email@example.com' --importance=2"
    echo "  $(basename "$0") export-data --format=csv --output=./exports/"
}

# Command: sync-emails
cmd_sync_emails() {
    local days=7
    local importance=""
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --days=*)
                days="${1#*=}"
                shift
                ;;
            --importance=*)
                importance="${1#*=}"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_info "Syncing emails from the last $days days..."
    
    local args=""
    [[ -n "$days" ]] && args="$args --days=$days"
    [[ -n "$importance" ]] && args="$args --importance=$importance"
    
    execute_ts_command "sync-emails" "$SCRIPT_DIR/sync-emails.ts" $args
}

# Command: process-emails
cmd_process_emails() {
    local limit=50
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --limit=*)
                limit="${1#*=}"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_info "Processing up to $limit emails..."
    execute_ts_command "process-emails" "$SCRIPT_DIR/process-emails.ts" --limit="$limit"
}

# Command: manage-addresses
cmd_manage_addresses() {
    local action="${1:-list}"
    shift || true
    
    case "$action" in
        add)
            local email="$1"
            local importance=1
            shift || true
            
            # Parse options
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --importance=*)
                        importance="${1#*=}"
                        shift
                        ;;
                    *)
                        shift
                        ;;
                esac
            done
            
            if [[ -z "$email" ]]; then
                log_error "Email address required"
                echo "Usage: $(basename "$0") manage-addresses add EMAIL [--importance=N]"
                return 1
            fi
            
            log_info "Adding email address: $email with importance level $importance"
            execute_ts_command "manage-addresses-add" "$SCRIPT_DIR/manage-addresses.ts" add "$email" --importance="$importance"
            ;;
            
        list)
            log_info "Listing important email addresses..."
            execute_ts_command "manage-addresses-list" "$SCRIPT_DIR/manage-addresses.ts" list
            ;;
            
        remove)
            local email="$1"
            if [[ -z "$email" ]]; then
                log_error "Email address required"
                echo "Usage: $(basename "$0") manage-addresses remove EMAIL"
                return 1
            fi
            
            log_info "Removing email address: $email"
            execute_ts_command "manage-addresses-remove" "$SCRIPT_DIR/manage-addresses.ts" remove "$email"
            ;;
            
        *)
            log_error "Unknown action: $action"
            echo "Usage: $(basename "$0") manage-addresses [add|list|remove] [EMAIL] [OPTIONS]"
            return 1
            ;;
    esac
}

# Command: analyze-concepts
cmd_analyze_concepts() {
    local from_date=""
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --from=*)
                from_date="${1#*=}"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_info "Analyzing email concepts..."
    
    local args=""
    [[ -n "$from_date" ]] && args="--from=$from_date"
    
    execute_ts_command "analyze-concepts" "$SCRIPT_DIR/analyze-concepts.ts" $args
}

# Command: export-data
cmd_export_data() {
    local format="csv"
    local output="./exports/"
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --format=*)
                format="${1#*=}"
                shift
                ;;
            --output=*)
                output="${1#*=}"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_info "Exporting email data as $format to $output..."
    execute_ts_command "export-data" "$SCRIPT_DIR/export-data.ts" --format="$format" --output="$output"
}

# Command: test-connection
cmd_test_connection() {
    log_info "Testing database connection..."
    execute_ts_command "test-connection" "$SCRIPT_DIR/test-connection.ts"
}

# Command: stats
cmd_stats() {
    log_info "Generating email statistics..."
    execute_ts_command "stats" "$SCRIPT_DIR/stats.ts"
}

# Command: import-sqlite
cmd_import_sqlite() {
    log_info "Importing SQLite email data from CSV files..."
    execute_js_command "import-sqlite" "$SCRIPT_DIR/import-sqlite-data-simple.js" "$@"
}

# Command: status
cmd_status() {
    log_info "Gmail Pipeline Status"
    echo "===================="
    
    if [[ -f "$SCRIPT_DIR/show-status.ts" ]]; then
        execute_ts_command "status" "$SCRIPT_DIR/show-status.ts"
    else
        # Show basic status
        log_warning "Status functionality not yet implemented."
        echo ""
        echo "Available commands:"
        echo "- sync-emails"
        echo "- process-emails"
        echo "- manage-addresses"
        echo "- analyze-concepts"
        echo "- export-data"
        echo "- test-connection"
        echo "- stats"
        echo "- import-sqlite"
    fi
}

# Main command handler
main() {
    # Check dependencies first
    if ! check_dependencies; then
        exit 1
    fi
    
    # Get the command
    case "${1:-help}" in
        sync-emails)
            shift
            cmd_sync_emails "$@"
            ;;
        process-emails)
            shift
            cmd_process_emails "$@"
            ;;
        manage-addresses)
            shift
            cmd_manage_addresses "$@"
            ;;
        analyze-concepts)
            shift
            cmd_analyze_concepts "$@"
            ;;
        export-data)
            shift
            cmd_export_data "$@"
            ;;
        test-connection)
            shift
            cmd_test_connection "$@"
            ;;
        stats)
            shift
            cmd_stats "$@"
            ;;
        import-sqlite)
            shift
            cmd_import_sqlite "$@"
            ;;
        status)
            shift
            cmd_status "$@"
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            log_error "Unknown command: $1"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"