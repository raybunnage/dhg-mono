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
  echo "Commands:"
  echo "  convert [fileId|path]        Convert MP4 file to M4A for processing (audio extraction only)"
  echo "                               Options: --dry-run, --force, --batch <number>"
  echo "  find-processable-videos      Find MP4 files ready for processing"
  echo "  transcribe [fileId|path]     Transcribe audio file using Whisper"
  echo "  transcribe-with-summary      Transcribe and generate summary of audio file"
  echo "  process-video [fileId]       Full pipeline: convert + transcribe (recommended for single files)"
  echo "  batch-process-media          Complete workflow: find, copy, rename, register, update, convert, and transcribe files
                               Options: --skip-copy, --skip-rename, --skip-register, --skip-disk-status,
                               --skip-expert-docs, --skip-conversion, --skip-m4a-sync, --skip-transcription"
  echo "  process-local-mp4-files      Process MP4 files from file_types/mp4/ directory, register and transcribe them
                               Options: --dry-run, --force, --max-parallel <number>, --limit <number>, --specific-files <list>"
  echo "  list-transcribable           List documents ready for transcription with copy-paste commands"
  echo "  show-transcription-status    Show detailed status of transcriptions and processing times"
  echo "  list-pending                 List pending files waiting for processing"
  echo "  list-ready                   List files ready for content generation"
  echo "  update-status [fileId]       Update processing status of a file"
  echo "  mark-skip-processing [file]  Mark large files to skip batch processing"
  echo "  extract-summary [fileId]     Extract transcript from a processed file"
  echo "  batch-transcribe             Process multiple files for transcription"
  echo ""
  echo "File Checking Commands:"
  echo "  check-media-files            Check for missing/orphaned MP4 and M4A files"
  echo "  find-missing-media           Find missing MP4 files in Google Drive and generate copy commands"
  echo "                               Options: --deep, --limit, --source, --format"
  echo "  find-missing-sources_google-mp4s  Find MP4 files from sources_google with video/mp4 type not in presentations"
  echo "                               Options: --limit, --format, --path-contains"
  echo "  find-missing-js-files        Run JavaScript-based MP4 file checker (legacy)"
  echo "  run-shell-check [--script]   Run shell script (default: mp4-files-check.sh)"
  echo "  purge-processed-media        Find and remove MP4/M4A files that have been successfully processed"
  echo "                               Options: --dry-run, --force, --days [number]"
  echo ""
  echo "File Management Commands:"
  echo "  rename-mp4-files             Rename MP4 files to match database records"
  echo "                               Options: --dry-run, --force, --generate-map, --skip-sync"
  echo "  sync-m4a-names               Sync M4A filenames with their MP4 counterparts"
  echo "                               Options: --dry-run, --force, --after-rename"
  echo ""  
  echo "Database Integration Commands:"
  echo "  update-disk-status           Update presentations with MP4 file status on disk"
  echo "  register-expert-docs         Register MP4 files as expert documents in the database"
  echo "  register-local-mp4-files     Add local MP4 files to database that are not already registered"
  echo "                               Options: --dry-run, --force, --specific-files"
  echo ""
  echo "Options:"
  echo "  --dry-run                    Show what would happen without making changes"
  echo "  --limit [n]                  Process max n files"
  echo "  --source [path]              Source directory for finding files (default: ~/Google Drive)"
  echo "  --model [tiny|base|small]    Specify Whisper model (default: base)"
  echo "  --accelerator [T4|A10G|A100] Specify GPU accelerator (default: T4)"
  echo "  --skip-copy                  Skip the copy step (for batch-process-media)"
  echo "  --skip-rename                Skip the rename step (for batch-process-media)"
  echo "  --skip-register              Skip the register step (for batch-process-media)"
  echo "  --skip-disk-status           Skip the disk status update step (for batch-process-media)"
  echo "  --skip-expert-docs           Skip the register expert docs step (for batch-process-media)"
  echo "  --skip-conversion            Skip the MP4 to M4A conversion step (for batch-process-media)"
  echo "  --skip-m4a-sync              Skip the M4A sync step (for batch-process-media)"
  echo "  --skip-transcription         Skip the transcription step (for batch-process-media)"
  echo "  --parallel                   Process files in parallel (for batch-transcribe)"
  echo "  --max-parallel [n]           Maximum number of parallel processes (default: 3)"
  echo "  --force                      Process even if already processed"
  echo "  --resume                     Resume processing for previously skipped file (for mark-skip-processing)"
  echo "  --output [path]              Specify output directory"
  echo "  --auto-process               Automatically process files (for find-processable-videos)"
  echo "  --generate-map               Generate a CSV mapping file (for rename-mp4-files)"
  echo ""
  echo "Examples:"
  echo "  media-processing-cli.sh convert path/to/file.mp4"
  echo "  media-processing-cli.sh find-processable-videos --limit 1 --auto-process"
  echo "  media-processing-cli.sh transcribe 8f7e6d5c-4b3a-2a1e-9d8c-7f6e5d4c3b2a"
  echo "  media-processing-cli.sh transcribe 8f7e6d5c-4b3a-2a1e-9d8c-7f6e5d4c3b2a --accelerator A10G"
  echo "  media-processing-cli.sh process-video 8f7e6d5c-4b3a-2a1e-9d8c-7f6e5d4c3b2a"
  echo "  media-processing-cli.sh batch-process-media --limit 25 --model base --accelerator T4"
  echo "  media-processing-cli.sh batch-process-media --dry-run"
  echo "  media-processing-cli.sh batch-process-media --skip-copy --limit 10"
  echo "  media-processing-cli.sh batch-process-media --skip-copy --skip-rename --skip-register"
  echo "  media-processing-cli.sh batch-transcribe --parallel --max-parallel 3 --accelerator A10G"
  echo "  media-processing-cli.sh list-pending --limit 10"
  echo "  media-processing-cli.sh mark-skip-processing \"Large Lecture.mp4\" --dry-run"
  echo "  media-processing-cli.sh mark-skip-processing f9f1e470-3b07-4aee-b134-5a740bd89446 --resume"
  echo "  media-processing-cli.sh rename-mp4-files --dry-run"
  echo "  media-processing-cli.sh sync-m4a-names --dry-run --after-rename"
  echo "  media-processing-cli.sh update-disk-status --dry-run"
  echo "  media-processing-cli.sh register-expert-docs --limit 20"
  echo "  media-processing-cli.sh purge-processed-media --dry-run"
  echo "  media-processing-cli.sh find-missing-sources_google-mp4s --limit 10 --format commands"
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