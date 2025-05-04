#!/bin/bash
# Media Processing CLI wrapper script
# Processes media files through various stages (MP4 → MP3 → Transcript)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Check that ts-node is installed
if ! command -v ts-node &> /dev/null; then
  echo "❌ ts-node is not installed. Please install it with: npm install -g ts-node typescript"
  exit 1
fi

# Function to execute a command with tracking
track_command() {
  local pipeline_name="media_processing"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Check if we have a TS tracking wrapper
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    # Fallback to direct execution without tracking
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

function display_help() {
  echo "Media Processing CLI - Processes media files from MP4 through transcription"
  echo ""
  echo "Usage:"
  echo "  media-processing-cli.sh [command] [options]"
  echo ""
  echo "COMMANDS:"
  echo "  (* = frequently used commands based on usage statistics)"
  echo ""
  echo "CORE PROCESSING COMMANDS:"
  echo "  * process-local-mp4-files      Process MP4 files from file_types/mp4/ directory (8 uses)"
  echo "    process-video [fileId]       Full pipeline: convert + transcribe (for single files)"
  echo "    batch-process-media          Complete workflow: find, copy, rename, register, convert, and transcribe"
  echo "    batch-transcribe             Process multiple files for transcription"
  echo ""
  echo "MEDIA CONVERSION:"
  echo "  * extract-video-metadata       Extract metadata (duration, etc.) from MP4 video files (8 uses)"
  echo "    convert [fileId|path]        Convert MP4 file to M4A for processing (audio extraction only)"
  echo "  * transcribe [fileId|path]     Transcribe audio file using Whisper (5 uses)"
  echo "    transcribe-with-summary      Transcribe and generate summary of audio file"
  echo ""
  echo "FILE MANAGEMENT:"
  echo "    rename-mp4-files             Rename MP4 files to match database records"
  echo "    sync-m4a-names               Sync M4A filenames with their MP4 counterparts"
  echo "  * find-missing-sources_google-mp4s  Find MP4 files from sources_google not in presentations (5 uses)"
  echo "    register-local-mp4-files     Add local MP4 files to database (2 uses)"
  echo ""
  echo "LISTING & REPORTING:"
  echo "    list-transcribable           List documents ready for transcription with commands"
  echo "    show-transcription-status    Show detailed status of transcriptions and processing times"
  echo "    list-pending                 List pending files waiting for processing"
  echo "    list-ready                   List files ready for content generation"
  echo "    find-processable-videos      Find MP4 files ready for processing"
  echo ""
  echo "DATABASE OPERATIONS:"
  echo "    update-disk-status           Update presentations with MP4 file status on disk"
  echo "    register-expert-docs         Register MP4 files as expert documents in the database"
  echo "    update-status [fileId]       Update processing status of a file"
  echo "    mark-skip-processing [file]  Mark large files to skip batch processing"
  echo ""
  echo "MAINTENANCE & CHECKS:"
  echo "  * health-check                 Check the health of media processing infrastructure (26 uses)"
  echo "    check-media-files            Check for missing/orphaned MP4 and M4A files"
  echo "    find-missing-media           Find missing MP4 files in Google Drive"
  echo "    purge-processed-media        Find and remove MP4/M4A files that have been successfully processed"
  echo ""
  echo "COMMON OPTIONS:"
  echo "  --dry-run                    Show what would happen without making changes"
  echo "  --limit [n]                  Process max n files"
  echo "  --model [tiny|base|small]    Specify Whisper model (default: base)"
  echo "  --accelerator [T4|A10G|A100] Specify GPU accelerator (default: T4)"
  echo "  --max-parallel [n]           Maximum number of parallel processes (default: 3)"
  echo "  --force                      Process even if already processed"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "CORE PROCESSING:"
  echo "  # Process MP4 files from file_types/mp4/ directory"
  echo "  media-processing-cli.sh process-local-mp4-files --limit 5"
  echo ""
  echo "  # Full processing of a specific video by ID"
  echo "  media-processing-cli.sh process-video <file-id>"
  echo ""
  echo "MEDIA CONVERSION:"
  echo "  # Extract metadata from MP4 files" 
  echo "  media-processing-cli.sh extract-video-metadata --limit 5"
  echo ""
  echo "  # Transcribe an audio file"
  echo "  media-processing-cli.sh transcribe <file-id> --accelerator A10G"
  echo ""
  echo "FILE MANAGEMENT:"
  echo "  # Find MP4 files not in presentations"
  echo "  media-processing-cli.sh find-missing-sources_google-mp4s --limit 10"
  echo ""
  echo "  # Register local MP4 files to database"
  echo "  media-processing-cli.sh register-local-mp4-files --dry-run"
  echo ""
  echo "MAINTENANCE:"
  echo "  # Check the health of the media processing infrastructure"
  echo "  media-processing-cli.sh health-check"
}

# No arguments provided
if [ $# -eq 0 ]; then
  display_help
  exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
  # Core commands
  convert)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/convert-mp4.ts $*"
    ;;
  find-processable-videos)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/find-processable-videos.ts $*"
    ;;
  transcribe)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/transcribe-audio.ts $*"
    ;;
  transcribe-with-summary)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/transcribe-with-summary.ts $*"
    ;;
  list-transcribable)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/list-transcribable.ts $*"
    ;;
  show-transcription-status)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/show-transcription-status.ts $*"
    ;;
  process-video)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/process-video.ts $*"
    ;;
  batch-process-media)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/batch-process-media.ts $*"
    ;;
  process-local-mp4-files)
    track_command "$COMMAND" "ts-node --transpile-only $SCRIPT_DIR/commands/process-local-mp4-files.ts $*"
    ;;
  list-pending)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/list-pending.ts $*"
    ;;
  list-ready)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/list-ready.ts $*"
    ;;
  update-status)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/update-status.ts $*"
    ;;
  mark-skip-processing)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/mark-skip-processing.ts $*"
    ;;
  extract-summary)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/extract-summary.ts $*"
    ;;
  batch-transcribe)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/batch-transcribe.ts $*"
    ;;
    
  # File checking commands
  check-media-files)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/check-media-files.ts $*"
    ;;
  find-missing-media)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/find-missing-media.ts $*"
    ;;
  find-missing-sources_google-mp4s)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/find-missing-sources_google-mp4s.ts $*"
    ;;
  find-missing-js-files)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/find-missing-js-files.ts $*"
    ;;
  run-shell-check)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/run-shell-check.ts $*"
    ;;
  purge-processed-media)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/purge-processed-media.ts $*"
    ;;
    
  # File management commands
  rename-mp4-files)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/rename-mp4-files.ts $*"
    ;;
  sync-m4a-names)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/sync-m4a-names.ts $*"
    ;;
  
  # Database integration commands
  update-disk-status)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/index.ts update-disk-status $*"
    ;;
  register-expert-docs)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/index.ts register-expert-docs $*"
    ;;
  register-local-mp4-files)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/register-local-mp4-files.ts $*"
    ;;
  extract-video-metadata)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/extract-video-metadata.ts $*"
    ;;
    
  # Health check command
  health-check)
    track_command "$COMMAND" "ts-node $SCRIPT_DIR/commands/health-check.ts $*"
    ;;
    
  # Help commands
  help|--help|-h)
    # Display help
    display_help
    
    # Log command using NodeJS script directly - create a simple tracking entry
    # This avoids the issues with shell function execution
    LOG_HELP_CMD="npx ts-node -e 'const { createClient } = require(\"@supabase/supabase-js\"); const supabaseUrl = process.env.SUPABASE_URL; const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!supabaseUrl || !supabaseKey) { console.error(\"Missing Supabase credentials\"); process.exit(1); } const supabase = createClient(supabaseUrl, supabaseKey); (async () => { await supabase.from(\"cli_command_tracking\").insert({ pipeline_name: \"media_processing\", command_name: \"--help\", execution_time: new Date(), status: \"success\", summary: \"Help command executed successfully\" }); console.log(\"Help command tracked\"); })().catch(err => console.error(err));'"

    # Execute the logging command in the background
    eval $LOG_HELP_CMD &
    ;;
  *)
    echo "❌ Unknown command: $COMMAND"
    display_help
    exit 1
    ;;
esac