#!/bin/bash

# Media Processing CLI - Processes media files from MP4 through transcription
# Refactored version following simplified patterns

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="media_processing"
PIPELINE_DESCRIPTION="Media file processing - MP4 conversion, audio extraction, and transcription"
PIPELINE_VERSION="2.0.0"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [[ -f "$ENV_DEV_FILE" ]]; then
    echo "ℹ️  INFO [$PIPELINE_NAME] Loading environment variables from .env.development..."
    # Use a safer method to export environment variables
    while IFS='=' read -r key value; do
        if [[ $key =~ ^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY|WHISPER_) ]]; then
            export "$key=$value"
        fi
    done < <(grep -E "^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY|WHISPER_)" "$ENV_DEV_FILE" | grep -v '^#')
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
    local tracker="${PROJECT_ROOT}/packages/shared/services/tracking-service/shell-command-tracker.ts"
    
    if [[ -f "$tracker" ]]; then
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$tracker" "$PIPELINE_NAME" "$command" &
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
    
    # Check for FFmpeg
    if ! command -v ffmpeg &> /dev/null; then
        log_warning "FFmpeg not installed - required for media conversion"
    fi
    
    # Check TypeScript files exist
    local required_files=(
        "commands/convert-mp4.ts"
        "commands/transcribe-audio.ts"
        "commands/process-video.ts"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/$file" ]]; then
            log_warning "Missing TypeScript file: $file"
        fi
    done
    
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
    echo "FREQUENTLY USED COMMANDS:"
    echo "  * process-local-mp4-files    Process MP4 files from file_types/mp4/"
    echo "  * extract-video-metadata     Extract metadata from MP4 files"
    echo "  * transcribe                 Transcribe audio file using Whisper"
    echo "  * health-check               Check media processing infrastructure"
    echo ""
    echo "CORE PROCESSING:"
    echo "  process-video               Full pipeline: convert + transcribe"
    echo "  batch-process-media         Complete workflow for multiple files"
    echo "  batch-transcribe            Process multiple files for transcription"
    echo "  convert                     Convert MP4 to M4A (audio extraction)"
    echo "  transcribe-with-summary     Transcribe and generate summary"
    echo ""
    echo "FILE MANAGEMENT:"
    echo "  rename-mp4-files            Rename MP4 files to match database"
    echo "  sync-m4a-names              Sync M4A filenames with MP4s"
    echo "  find-missing-sources_google-mp4s  Find unregistered MP4 files"
    echo "  register-local-mp4-files    Add local MP4 files to database"
    echo ""
    echo "LISTING & REPORTING:"
    echo "  list-transcribable          List documents ready for transcription"
    echo "  show-transcription-status   Show transcription status details"
    echo "  list-pending                List pending files"
    echo "  list-ready                  List files ready for content generation"
    echo "  find-processable-videos     Find MP4 files ready for processing"
    echo ""
    echo "DATABASE OPERATIONS:"
    echo "  update-disk-status          Update MP4 file status on disk"
    echo "  register-expert-docs        Register MP4s as expert documents"
    echo "  update-status               Update processing status"
    echo "  mark-skip-processing        Mark large files to skip"
    echo ""
    echo "MAINTENANCE:"
    echo "  check-media-files           Check for missing/orphaned files"
    echo "  find-missing-media          Find missing MP4 files in Drive"
    echo "  purge-processed-media       Remove successfully processed files"
    echo ""
    echo "OPTIONS:"
    echo "  --dry-run                   Preview without changes"
    echo "  --limit N                   Process max N files"
    echo "  --model MODEL               Whisper model (tiny|base|small)"
    echo "  --accelerator GPU           GPU type (T4|A10G|A100)"
    echo "  --max-parallel N            Max parallel processes"
    echo "  --force                     Process even if already done"
    echo ""
    echo "EXAMPLES:"
    echo "  # Process local MP4 files"
    echo "  $(basename "$0") process-local-mp4-files --limit 5"
    echo ""
    echo "  # Transcribe a specific file"
    echo "  $(basename "$0") transcribe <file-id> --accelerator A10G"
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
            
        # Core Processing Commands
        process-local-mp4-files)
            shift
            execute_ts_command "process-local-mp4-files" "$SCRIPT_DIR/commands/process-local-mp4-files.ts" "$@"
            ;;
        process-video)
            shift
            execute_ts_command "process-video" "$SCRIPT_DIR/commands/process-video.ts" "$@"
            ;;
        batch-process-media)
            shift
            execute_ts_command "batch-process-media" "$SCRIPT_DIR/commands/batch-process-media.ts" "$@"
            ;;
        batch-transcribe)
            shift
            execute_ts_command "batch-transcribe" "$SCRIPT_DIR/commands/batch-transcribe.ts" "$@"
            ;;
            
        # Media Conversion
        extract-video-metadata)
            shift
            execute_ts_command "extract-video-metadata" "$SCRIPT_DIR/commands/extract-video-metadata.ts" "$@"
            ;;
        convert)
            shift
            execute_ts_command "convert" "$SCRIPT_DIR/commands/convert-mp4.ts" "$@"
            ;;
        transcribe)
            shift
            execute_ts_command "transcribe" "$SCRIPT_DIR/commands/transcribe-audio.ts" "$@"
            ;;
        transcribe-with-summary)
            shift
            execute_ts_command "transcribe-with-summary" "$SCRIPT_DIR/commands/transcribe-with-summary.ts" "$@"
            ;;
            
        # File Management
        rename-mp4-files)
            shift
            execute_ts_command "rename-mp4-files" "$SCRIPT_DIR/commands/rename-mp4-files.ts" "$@"
            ;;
        sync-m4a-names)
            shift
            execute_ts_command "sync-m4a-names" "$SCRIPT_DIR/commands/sync-m4a-names.ts" "$@"
            ;;
        find-missing-sources_google-mp4s|find-missing-sources-google-mp4s)
            shift
            execute_ts_command "find-missing-sources_google-mp4s" "$SCRIPT_DIR/commands/find-missing-sources_google-mp4s.ts" "$@"
            ;;
        register-local-mp4-files)
            shift
            execute_ts_command "register-local-mp4-files" "$SCRIPT_DIR/commands/register-local-mp4-files.ts" "$@"
            ;;
            
        # Listing & Reporting
        list-transcribable)
            shift
            execute_ts_command "list-transcribable" "$SCRIPT_DIR/commands/list-transcribable.ts" "$@"
            ;;
        show-transcription-status)
            shift
            execute_ts_command "show-transcription-status" "$SCRIPT_DIR/commands/show-transcription-status.ts" "$@"
            ;;
        list-pending)
            shift
            execute_ts_command "list-pending" "$SCRIPT_DIR/commands/list-pending.ts" "$@"
            ;;
        list-ready)
            shift
            execute_ts_command "list-ready" "$SCRIPT_DIR/commands/list-ready.ts" "$@"
            ;;
        find-processable-videos)
            shift
            execute_ts_command "find-processable-videos" "$SCRIPT_DIR/commands/find-processable-videos.ts" "$@"
            ;;
            
        # Database Operations
        update-disk-status)
            shift
            execute_ts_command "update-disk-status" "$SCRIPT_DIR/commands/update-disk-status.ts" "$@"
            ;;
        register-expert-docs)
            shift
            execute_ts_command "register-expert-docs" "$SCRIPT_DIR/commands/register-expert-docs.ts" "$@"
            ;;
        update-status)
            shift
            execute_ts_command "update-status" "$SCRIPT_DIR/commands/update-status.ts" "$@"
            ;;
        mark-skip-processing)
            shift
            execute_ts_command "mark-skip-processing" "$SCRIPT_DIR/commands/mark-skip-processing.ts" "$@"
            ;;
            
        # Maintenance & Checks
        check-media-files)
            shift
            execute_ts_command "check-media-files" "$SCRIPT_DIR/commands/check-media-files.ts" "$@"
            ;;
        find-missing-media)
            shift
            execute_ts_command "find-missing-media" "$SCRIPT_DIR/commands/find-missing-media.ts" "$@"
            ;;
        purge-processed-media)
            shift
            execute_ts_command "purge-processed-media" "$SCRIPT_DIR/commands/purge-processed-media.ts" "$@"
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