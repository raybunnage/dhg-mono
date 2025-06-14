#!/bin/bash

# Classify Pipeline CLI - Refactored
# Document classification engine with subject management

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="classify"
PIPELINE_DESCRIPTION="Document classification and subject management"
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
    
    local ts_file="$SCRIPT_DIR/index.ts"
    if [[ ! -f "$ts_file" ]]; then
        log_error "TypeScript implementation not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "cd '$PROJECT_ROOT' && npx ts-node '$ts_file' $command_name $@"
}

# Execute shell script command
execute_sh_command() {
    local command_name="$1"
    local sh_file="$2"
    shift 2
    
    if [[ ! -f "$sh_file" ]]; then
        log_error "Shell script not found: $sh_file"
        return 1
    fi
    
    track_command "$command_name" "'$sh_file' $@"
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
    echo "CLASSIFICATION OPERATIONS:"
    echo "  * classify-subjects          Apply subject classification to documents (59 uses)"
    echo "    classify-source            Classify a specific source by its ID"
    echo "  * classify-remaining-experts Classify remaining expert documents (11 uses)"
    echo ""
    echo "TITLE MANAGEMENT:"
    echo "  * extract-titles             Extract titles from MP4 files (10 uses)"
    echo "  * check-mp4-titles           Check MP4 files for missing titles (12 uses)"
    echo ""
    echo "LISTING & REPORTING:"
    echo "  * list-unclassified          List expert documents without classifications (11 uses)"
    echo "    list                       List all subject classifications"
    echo "    get <id>                   Get a specific classification by ID"
    echo "    hierarchy                  Get hierarchical view of classifications"
    echo "    compare-presentations-assets Compare presentations against assets"
    echo ""
    echo "SUBJECT MANAGEMENT:"
    echo "    create                     Create a new classification"
    echo "    update <id>                Update an existing classification"
    echo "    delete <id>                Delete a classification"
    echo "    batch-create <file>        Create multiple classifications from JSON"
    echo ""
    echo "SYSTEM:"
    echo "  * health-check               Check the health of the classify service (6 uses)"
    echo ""
    echo "COMMON OPTIONS:"
    echo "  -l, --limit <number>         Maximum items to process"
    echo "  -x, --expert <name>          Filter by expert name"
    echo "  -e, --extensions <ext>       Filter by file extensions (comma-separated)"
    echo "  --dry-run                    Preview changes without making them"
    echo "  --verbose                    Show detailed output"
    echo ""
    echo "EXAMPLES:"
    echo "  # Classify documents with processed content"
    echo "  $(basename "$0") classify-subjects -l 5 -e mp4,pdf,docx"
    echo ""
    echo "  # Extract titles from MP4 files"
    echo "  $(basename "$0") extract-titles -l 50 --verbose"
    echo ""
    echo "  # Check service health"
    echo "  $(basename "$0") health-check --verbose"
}

# Command: health-check
cmd_health_check() {
    # Check if there's a dedicated health-check script
    local health_script="$SCRIPT_DIR/health-check.sh"
    if [[ -f "$health_script" ]]; then
        execute_sh_command "health-check" "$health_script" "$@"
    else
        # Fallback health check
        log_info "Running health check for $PIPELINE_NAME pipeline..."
        
        if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
            log_error "Missing required environment variables"
            return 1
        fi
        
        # Check TypeScript implementation
        if [[ ! -f "$SCRIPT_DIR/index.ts" ]]; then
            log_error "TypeScript implementation not found"
            return 1
        fi
        
        log_success "$PIPELINE_NAME pipeline is healthy"
    fi
}

# Main command handler
main() {
    case "${1:-help}" in
        # Classification operations
        classify-subjects)
            shift
            execute_ts_command "classify-subjects" "$@"
            ;;
        classify-source)
            shift
            execute_ts_command "classify-source" "$@"
            ;;
        classify-remaining-experts)
            shift
            execute_ts_command "classify-remaining-experts" "$@"
            ;;
            
        # Title management
        extract-titles)
            shift
            execute_ts_command "extract-titles" "$@"
            ;;
        check-mp4-titles)
            shift
            execute_ts_command "check-mp4-titles" "$@"
            ;;
            
        # Listing & reporting
        list)
            shift
            execute_ts_command "list" "$@"
            ;;
        get)
            shift
            execute_ts_command "get" "$@"
            ;;
        hierarchy)
            shift
            execute_ts_command "hierarchy" "$@"
            ;;
        list-unclassified)
            shift
            execute_ts_command "list-unclassified" "$@"
            ;;
        compare-presentations-assets)
            shift
            execute_ts_command "compare-presentations-assets" "$@"
            ;;
            
        # Subject management
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
        batch-create)
            shift
            execute_ts_command "batch-create" "$@"
            ;;
            
        # Debug/examination
        debug-classification-status)
            shift
            execute_ts_command "debug-classification-status" "$@"
            ;;
        examine-document)
            shift
            execute_ts_command "examine-document" "$@"
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