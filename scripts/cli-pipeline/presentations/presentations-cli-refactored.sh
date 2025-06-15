#!/bin/bash

# Presentations Pipeline CLI - Refactored
# Manage expert presentations and AI processing

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="presentations"
PIPELINE_DESCRIPTION="Expert presentations management and AI processing"
PIPELINE_VERSION="1.0.0"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [[ -f "$ENV_DEV_FILE" ]]; then
    echo "ℹ️  INFO [$PIPELINE_NAME] Loading environment variables from .env.development..."
    export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY|ANTHROPIC_API_KEY" "$ENV_DEV_FILE" | grep -v '^#' | xargs)
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

# Execute TypeScript command via index.ts
execute_ts_command() {
    local command_name="$1"
    shift
    
    local ts_file="$SCRIPT_DIR/index.ts"
    if [[ ! -f "$ts_file" ]]; then
        log_error "TypeScript implementation not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "npx ts-node '$ts_file' $command_name $@"
}

# Execute specific TypeScript file
execute_ts_file() {
    local command_name="$1"
    local ts_file="$2"
    shift 2
    
    if [[ ! -f "$ts_file" ]]; then
        log_error "TypeScript file not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "npx ts-node '$ts_file' $@"
}

# Execute shell script
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

# Add confirmation for destructive operations
confirm_operation() {
    local operation="$1"
    
    echo -e "\n⚠️  CAUTION: You are about to $operation."
    read -p "Are you sure you want to proceed? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation canceled."
        return 1
    fi
    echo "Proceeding..."
    return 0
}

# Help command
cmd_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
    echo ""
    echo "MOST USED COMMANDS (by usage statistics):"
    echo ""
    echo "SYSTEM:"
    echo "  * health-check               Check pipeline health (80 uses, 65% success)"
    echo "    --skip-database            Skip database check"
    echo "    --skip-presentations       Skip presentations table check"
    echo "    --skip-claude              Skip Claude service check"
    echo "    --verbose, -v              Show verbose output"
    echo ""
    echo "PRESENTATIONS MANAGEMENT:"
    echo "  * find-missing-presentations Find folders needing presentations (61 uses)"
    echo "    --create-missing           Create the missing presentations"
    echo "    --dry-run                  Preview changes"
    echo "    -l, --limit N              Limit number to process"
    echo ""
    echo "  * create-presentations-from-mp4  Create presentations for MP4s (23 uses)"
    echo "    --no-dry-run               Execute changes"
    echo "    -l, --limit N              Limit number (default: 150)"
    echo ""
    echo "AI PROCESSING:"
    echo "  * process-mp4-files          Process MP4s with AI (54 uses, 81.5% success)"
    echo "    -d, --document-id ID       Process specific document"
    echo "    -l, --limit N              Max files (default: 5)"
    echo "    -b, --batch-size N         Files per batch (default: 3)"
    echo "    -f, --force                Reprocess existing"
    echo "    --dry-run                  Preview mode"
    echo ""
    echo "  * generate-summary           Generate AI summaries (16 uses)"
    echo "    --status STATUS            Filter by status"
    echo "    --format FORMAT            Output format"
    echo "    -l, --limit N              Limit results"
    echo ""
    echo "STATUS & REPORTS:"
    echo "  * review-presentations       Review status and content (35 uses)"
    echo "    -p, --presentation-id ID   Specific presentation"
    echo "    -e, --expert-id ID         Filter by expert"
    echo "    -s, --status STATUS        Filter by status"
    echo "    -f, --format FORMAT        Output format (table|json)"
    echo "    -o, --output-file PATH     Write to file"
    echo ""
    echo "ASSET MANAGEMENT:"
    echo "  * create-presentation-assets Create assets (30 uses, 86.7% success)"
    echo "    -p, --presentation-id ID   Specific presentation"
    echo "    --dry-run                  Preview changes"
    echo "    -l, --limit N              Limit presentations"
    echo ""
    echo "OTHER COMMANDS:"
    echo "  repair-presentations         Fix missing main_video_id"
    echo "  fix-mismatched-videos        Fix video_source_id mismatches"
    echo "  generate-expert-bio          Generate AI expert profiles"
    echo "  check-video-consistency      Check video consistency"
    echo "  repair-mismatched-video-ids  Fix video ID mismatches"
    echo "  export-status                Export status to markdown"
    echo "  help                         Show this help message"
    echo ""
    echo "COMMON OPTIONS:"
    echo "  --dry-run                    Preview without changes"
    echo "  --force, -f                  Force operation"
    echo "  --verbose, -v                Detailed output"
    echo "  --limit, -l N                Limit items to process"
    echo ""
    echo "EXAMPLES:"
    echo "  # Check pipeline health"
    echo "  $(basename "$0") health-check"
    echo ""
    echo "  # Find and create missing presentations"
    echo "  $(basename "$0") find-missing-presentations --create-missing --dry-run"
    echo ""
    echo "  # Process MP4 files with AI"
    echo "  $(basename "$0") process-mp4-files --limit 10 --batch-size 5"
}

# Command: health-check
cmd_health_check() {
    local health_script="$SCRIPT_DIR/health-check.sh"
    if [[ -f "$health_script" ]]; then
        execute_sh_command "health-check" "$health_script" "$@"
    else
        log_info "Running basic health check..."
        
        if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
            log_error "Missing required environment variables"
            return 1
        fi
        
        if [[ -z "$CLAUDE_API_KEY" ]] && [[ -z "$ANTHROPIC_API_KEY" ]]; then
            log_warning "Claude API key not found - AI features unavailable"
        fi
        
        log_success "$PIPELINE_NAME pipeline is healthy"
    fi
}

# Main command handler
main() {
    case "${1:-help}" in
        # System
        health-check)
            shift
            cmd_health_check "$@"
            ;;
            
        # Presentations management
        find-missing-presentations)
            shift
            # Add confirmation for create-missing without dry-run
            if [[ "$*" == *"--create-missing"* && "$*" != *"--dry-run"* ]]; then
                confirm_operation "create presentations in the database" || exit 0
            fi
            execute_ts_file "find-missing-presentations" "$SCRIPT_DIR/commands/find-missing-presentations.ts" "$@"
            ;;
        create-presentations-from-mp4)
            shift
            execute_ts_command "create-presentations-from-mp4" "$@"
            ;;
        create-missing-presentations)
            shift
            if [[ "$*" != *"--dry-run"* ]]; then
                confirm_operation "create presentations in the database" || exit 0
            fi
            execute_ts_file "create-missing-presentations" "$SCRIPT_DIR/commands/create-missing-presentations.ts" "$@"
            ;;
            
        # AI processing
        process-mp4-files)
            shift
            execute_ts_command "process-mp4-files" "$@"
            ;;
        generate-summary)
            shift
            # Fix triple dash if present
            local args=()
            for arg in "$@"; do
                if [[ "$arg" == "---dry-run" ]]; then
                    log_warning "Fixed '---dry-run' to '--dry-run'"
                    args+=("--dry-run")
                else
                    args+=("$arg")
                fi
            done
            execute_ts_command "generate-summary" "${args[@]}"
            ;;
        generate-expert-bio)
            shift
            execute_ts_command "generate-expert-bio" "$@"
            ;;
            
        # Status & reports
        review-presentations)
            shift
            if [[ "$1" == "--direct" ]]; then
                shift
                execute_ts_file "review-presentations" "$SCRIPT_DIR/commands/review-presentations.ts" "$@"
            else
                execute_ts_file "review-presentations" "$SCRIPT_DIR/commands/review-presentations.ts" "$@"
            fi
            ;;
        export-status)
            shift
            execute_ts_command "export-status" "$@"
            ;;
            
        # Asset management
        create-presentation-assets)
            shift
            execute_ts_command "create-presentation-assets" "$@"
            ;;
        create-missing-assets)
            shift
            execute_ts_command "create-missing-assets" "$@"
            ;;
            
        # Repairs and fixes
        repair-presentations)
            shift
            execute_ts_command "repair-presentations" "$@"
            ;;
        fix-mismatched-videos)
            shift
            execute_ts_file "fix-mismatched-videos" "$SCRIPT_DIR/repair-mismatched-fix.ts" "$@"
            ;;
        repair-mismatched-video-ids)
            shift
            execute_ts_file "repair-mismatched-video-ids" "$SCRIPT_DIR/test-repair-mismatched.ts" "$@"
            ;;
            
        # Other commands
        check-video-consistency)
            shift
            execute_ts_command "check-video-consistency" "$@"
            ;;
        test-process-document)
            shift
            execute_ts_command "test-process-document" "$@"
            ;;
        find-duplicate-folder-names)
            shift
            execute_ts_file "find-duplicate-folder-names" "$SCRIPT_DIR/commands/find-duplicate-folder-names.ts" "$@"
            ;;
            
        # Help
        help|--help|-h)
            cmd_help
            ;;
            
        # Unknown command - pass through to index.ts
        *)
            execute_ts_command "$@"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"