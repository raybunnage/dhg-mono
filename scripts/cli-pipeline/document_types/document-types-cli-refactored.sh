#!/bin/bash

# Document Types CLI - Refactored
# Manage document types and classifications

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="document_types"
PIPELINE_DESCRIPTION="Document type management and classification"
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

# Execute TypeScript command
execute_ts_command() {
    local command_name="$1"
    shift
    
    local ts_file="$SCRIPT_DIR/cli.ts"
    if [[ ! -f "$ts_file" ]]; then
        log_error "TypeScript implementation not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "cd '$PROJECT_ROOT' && npx ts-node '$ts_file' $command_name $@"
}

# Help command
cmd_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
    echo ""
    echo "COMMANDS:"
    echo "  (* = frequently used commands based on usage statistics)"
    echo ""
    echo "LISTING & QUERYING:"
    echo "  * list                   List all document types (84 uses)"
    echo "  * get                    Get details of a document type (27 uses)"
    echo "    categories             List all document type categories"
    echo "  * stats                  Get document type statistics"
    echo "    cheatsheet             Generate document types cheatsheet markdown"
    echo ""
    echo "CREATION & MANAGEMENT:"
    echo "  * update                 Update an existing document type (34 uses)"
    echo "    create                 Create a new document type"
    echo "    delete                 Delete a document type"
    echo "  * set-classifier         Set document_classifier enum (26 uses)"
    echo "    review-and-reclassify  Review and reclassify documents"
    echo ""
    echo "AI ASSISTANCE:"
    echo "    generate               Generate document type using AI"
    echo ""
    echo "SYSTEM:"
    echo "  * health-check           Check service health (49 uses)"
    echo "    help                   Show this help message"
    echo ""
    echo "OPTIONS:"
    echo "  --id ID                  Document type ID"
    echo "  --name NAME              Document type name"
    echo "  --category CATEGORY      Document category"
    echo "  --description DESC       Description text"
    echo "  --mnemonic CODE          Short mnemonic code"
    echo "  --ai-generated           Flag as AI generated"
    echo "  --general-type           Flag as general type"
    echo ""
    echo "EXAMPLES:"
    echo "  # List all document types"
    echo "  $(basename "$0") list"
    echo ""
    echo "  # Get specific document type"
    echo "  $(basename "$0") get --id \"123e4567-e89b-12d3-a456-426614174000\""
    echo ""
    echo "  # Create new document type"
    echo "  $(basename "$0") create --name \"Research Report\" --category \"Research\" --mnemonic \"RES\""
    echo ""
    echo "  # Check service health"
    echo "  $(basename "$0") health-check"
}

# Command: health-check
cmd_health_check() {
    log_info "Running health check for $PIPELINE_NAME pipeline..."
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Check TypeScript implementation
    if [[ ! -f "$SCRIPT_DIR/cli.ts" ]]; then
        log_error "TypeScript implementation not found"
        return 1
    fi
    
    # Delegate to TypeScript implementation if it has health-check
    execute_ts_command "health-check" "$@" || {
        # Fallback if TypeScript doesn't implement health-check
        log_success "$PIPELINE_NAME pipeline is healthy"
    }
}

# Main command handler
main() {
    case "${1:-help}" in
        # Listing & querying
        list)
            shift
            execute_ts_command "list" "$@"
            ;;
        get)
            shift
            execute_ts_command "get" "$@"
            ;;
        categories)
            shift
            execute_ts_command "categories" "$@"
            ;;
        stats)
            shift
            execute_ts_command "stats" "$@"
            ;;
        cheatsheet)
            shift
            execute_ts_command "cheatsheet" "$@"
            ;;
            
        # Creation & management
        create)
            shift
            execute_ts_command "create" "$@"
            ;;
        update)
            shift
            execute_ts_command "update" "$@"
            ;;
        delete)
            shift
            execute_ts_command "delete" "$@"
            ;;
        set-classifier)
            shift
            execute_ts_command "set-classifier" "$@"
            ;;
        review-and-reclassify)
            shift
            execute_ts_command "review-and-reclassify" "$@"
            ;;
            
        # AI assistance
        generate)
            shift
            execute_ts_command "generate" "$@"
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
            
        # Unknown command
        *)
            log_error "Unknown command: $1"
            echo "Run '$(basename "$0") help' to see available commands"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"