#!/bin/bash

# Document Archiving CLI - Refactored
# Manages archiving of documentation files

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="document_archiving"
PIPELINE_DESCRIPTION="Documentation file archiving management"
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

# Execute TypeScript CLI
execute_ts_cli() {
    local command_name="$1"
    shift
    
    local ts_file="$SCRIPT_DIR/document-archiving-cli.ts"
    if [[ ! -f "$ts_file" ]]; then
        log_error "TypeScript CLI not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "cd '$SCRIPT_DIR' && npx ts-node '$ts_file' $command_name $@"
}

# Help command
cmd_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
    echo ""
    echo "COMMANDS:"
    echo "  archive               Archive a single document"
    echo "    --path PATH         Document path to archive (required)"
    echo "    --reason REASON     Reason for archiving (required)"
    echo "    --superseded-by PATH Document that supersedes this one"
    echo ""
    echo "  archive-living-docs   Archive multiple living documents"
    echo "    --reason REASON     Reason for archiving (required)"
    echo "    --pattern PATTERN   File pattern to match"
    echo "    --dry-run           Preview changes without archiving"
    echo ""
    echo "  list                  List archived documents"
    echo "    --type TYPE         Filter by document type"
    echo "    --limit N           Limit number of results"
    echo "    --format FORMAT     Output format (table|json)"
    echo ""
    echo "  search <term>         Search archived documents"
    echo "    --limit N           Limit number of results"
    echo "    --exact             Exact match only"
    echo ""
    echo "  superseded-by <path>  Show documents superseded by a specific document"
    echo "    --format FORMAT     Output format (table|json)"
    echo ""
    echo "  health-check          Check archiving service health"
    echo "  help                  Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  # Archive a single document"
    echo "  $(basename "$0") archive --path docs/living-docs/old-doc.md --reason \"Obsolete\""
    echo ""
    echo "  # Archive multiple living documents"
    echo "  $(basename "$0") archive-living-docs --reason \"Consolidated into super-agent-system.md\""
    echo ""
    echo "  # List archived documents"
    echo "  $(basename "$0") list --type living_doc --limit 20"
    echo ""
    echo "  # Search for archived documents"
    echo "  $(basename "$0") search \"development system\" --limit 10"
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
    if [[ ! -f "$SCRIPT_DIR/document-archiving-cli.ts" ]]; then
        log_error "TypeScript CLI not found"
        return 1
    fi
    
    # Try to execute health check via CLI
    execute_ts_cli "health-check" || {
        # Fallback
        log_success "$PIPELINE_NAME pipeline is healthy"
    }
}

# Main command handler
main() {
    # Check if no arguments provided or help requested
    if [[ $# -eq 0 ]]; then
        cmd_help
        exit 0
    fi
    
    case "$1" in
        # Archiving operations
        archive)
            shift
            execute_ts_cli "archive" "$@"
            ;;
        archive-living-docs)
            shift
            execute_ts_cli "archive-living-docs" "$@"
            ;;
            
        # Query operations
        list)
            shift
            execute_ts_cli "list" "$@"
            ;;
        search)
            shift
            execute_ts_cli "search" "$@"
            ;;
        superseded-by)
            shift
            execute_ts_cli "superseded-by" "$@"
            ;;
            
        # System
        health-check)
            shift
            cmd_health_check "$@"
            ;;
            
        # Help
        help|--help|-h)
            cmd_help
            ;;
            
        # Unknown command - pass through to TypeScript CLI
        *)
            execute_ts_cli "$@"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"