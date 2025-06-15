#!/bin/bash

# Archive CLI - Database table archival and restoration
# Manages archiving of database tables before dropping them

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="archive"
PIPELINE_DESCRIPTION="Database table archival and restoration management"
PIPELINE_VERSION="1.0.0"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [[ -f "$ENV_DEV_FILE" ]]; then
    echo "ℹ️  INFO [$PIPELINE_NAME] Loading environment variables from .env.development..."
    while IFS='=' read -r key value; do
        if [[ $key =~ ^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY) ]]; then
            export "$key=$value"
        fi
    done < <(grep -E "^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)" "$ENV_DEV_FILE" | grep -v '^#')
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
    local command="$1"
    if [[ -f "$SCRIPT_DIR/../core/command-history-tracker.ts" ]]; then
        ts-node "$SCRIPT_DIR/../core/command-history-tracker.ts" "other" "$PIPELINE_NAME" "$command" &
    fi
}

# Execute TypeScript command with tracking
execute_ts_command() {
    local command="$1"
    local script="$2"
    shift 2
    
    log_info "Executing: $command"
    track_command "$command"
    
    if [[ ! -f "$script" ]]; then
        log_error "TypeScript file not found: $script"
        return 1
    fi
    
    ts-node "$script" "$@"
}

# Health check command
cmd_health_check() {
    log_info "Running health check for $PIPELINE_NAME pipeline..."
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Check if sys_archived_tables exists
    log_info "Checking sys_archived_tables table..."
    execute_ts_command "check-table" "$SCRIPT_DIR/check-archive-table.ts"
    
    log_success "$PIPELINE_NAME pipeline is healthy"
    return 0
}

# Show help
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
    echo ""
    echo "COMMANDS:"
    echo "  archive-table <table_name>  Archive a table before dropping it"
    echo "    --reason <text>           Reason for archiving (required)"
    echo "    --by <user>               Who is archiving (default: system)"
    echo ""
    echo "  restore-table <archive_id>  Restore an archived table"
    echo "    --force                   Force restore even if table exists"
    echo ""
    echo "  list                        List all archived tables"
    echo "    --limit <n>               Limit results (default: 20)"
    echo ""
    echo "  show <table_name|id>        Show details of an archived table"
    echo ""
    echo "  health-check                Check pipeline health status"
    echo "  help                        Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  # Archive a table"
    echo "  $(basename "$0") archive-table registry_cli_pipelines --reason \"Migrating to sys_cli_pipelines\""
    echo ""
    echo "  # List archived tables"
    echo "  $(basename "$0") list"
    echo ""
    echo "  # Restore a table"
    echo "  $(basename "$0") restore-table <archive-id>"
}

# Main command handler
main() {
    case "${1:-help}" in
        help|--help|-h)
            show_help
            ;;
            
        health-check)
            cmd_health_check
            ;;
            
        archive-table)
            shift
            if [[ -z "$1" ]]; then
                log_error "Table name is required"
                echo "Usage: $(basename "$0") archive-table <table_name> --reason <text>"
                exit 1
            fi
            execute_ts_command "archive-table" "$SCRIPT_DIR/archive-table.ts" "$@"
            ;;
            
        restore-table)
            shift
            if [[ -z "$1" ]]; then
                log_error "Archive ID is required"
                echo "Usage: $(basename "$0") restore-table <archive_id>"
                exit 1
            fi
            execute_ts_command "restore-table" "$SCRIPT_DIR/restore-table.ts" "$@"
            ;;
            
        list)
            shift
            execute_ts_command "list" "$SCRIPT_DIR/list-archived-tables.ts" "$@"
            ;;
            
        show)
            shift
            if [[ -z "$1" ]]; then
                log_error "Table name or archive ID is required"
                echo "Usage: $(basename "$0") show <table_name|id>"
                exit 1
            fi
            execute_ts_command "show" "$SCRIPT_DIR/show-archive-details.ts" "$@"
            ;;
            
        *)
            log_error "Unknown command: $1"
            echo "Run '$(basename "$0") help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"