#!/bin/bash

# Media Analytics CLI - Refactored
# Analyze media tracking data and generate reports

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="media_analytics"
PIPELINE_DESCRIPTION="Media tracking data analysis and reporting"
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
    if ! command -v ts-node &> /dev/null; then
        log_error "ts-node is not installed. Please run: pnpm install -g ts-node"
        return 1
    fi
    
    if ! command -v npx &> /dev/null; then
        log_error "npx is not available. Please install Node.js"
        return 1
    fi
    
    return 0
}

# Execute TypeScript CLI
execute_ts_cli() {
    local cli_file="$SCRIPT_DIR/media-analytics-cli.ts"
    
    if [[ ! -f "$cli_file" ]]; then
        log_error "CLI implementation not found: $cli_file"
        return 1
    fi
    
    # Pass all arguments to the TypeScript CLI
    track_command "$1" "npx ts-node '$cli_file' $@"
}

# Help command
cmd_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    
    # If TypeScript CLI exists, delegate to it
    local cli_file="$SCRIPT_DIR/media-analytics-cli.ts"
    if [[ -f "$cli_file" ]]; then
        npx ts-node "$cli_file" --help 2>/dev/null || {
            echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
            echo ""
            echo "Commands:"
            echo "  session-stats      Show media session statistics"
            echo "  user-activity      Analyze user activity patterns"
            echo "  content-metrics    Display content engagement metrics"
            echo "  export-report      Export analytics report"
            echo "  health-check       Check analytics service health"
            echo "  help               Show this help message"
        }
    else
        echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
        echo ""
        echo "Note: TypeScript CLI implementation not found."
        echo "This is a wrapper for the media analytics TypeScript CLI."
    fi
}

# Command: health-check
cmd_health_check() {
    log_info "Running health check for $PIPELINE_NAME pipeline..."
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Check TypeScript CLI
    local cli_file="$SCRIPT_DIR/media-analytics-cli.ts"
    if [[ ! -f "$cli_file" ]]; then
        log_error "TypeScript CLI not found: $cli_file"
        return 1
    fi
    
    log_success "$PIPELINE_NAME pipeline is healthy"
}

# Main command handler
main() {
    # Check dependencies first
    if ! check_dependencies; then
        exit 1
    fi
    
    # Handle empty arguments
    if [[ $# -eq 0 ]]; then
        cmd_help
        exit 0
    fi
    
    # Route commands
    case "$1" in
        help|--help|-h)
            cmd_help
            ;;
        health-check)
            shift
            cmd_health_check "$@"
            ;;
        *)
            # Delegate all other commands to TypeScript CLI
            execute_ts_cli "$@"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"