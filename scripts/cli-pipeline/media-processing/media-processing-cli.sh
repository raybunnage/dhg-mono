#!/bin/bash
# Media Processing CLI wrapper script
# Processes media files through various stages (MP4 → MP3 → Transcript)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check that ts-node is installed
if ! command -v ts-node &> /dev/null; then
  echo "❌ ts-node is not installed. Please install it with: npm install -g ts-node typescript"
  exit 1
fi

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
  echo "  process-video [fileId]       Full pipeline: convert + transcribe (recommended for most cases)"
  echo "  list-transcribable           List documents ready for transcription with copy-paste commands"
  echo "  show-transcription-status    Show detailed status of transcriptions and processing times"
  echo "  list-pending                 List pending files waiting for processing"
  echo "  list-ready                   List files ready for content generation"
  echo "  update-status [fileId]       Update processing status of a file"
  echo "  extract-summary [fileId]     Extract transcript from a processed file"
  echo "  batch-transcribe             Process multiple files for transcription"
  echo ""
  echo "File Checking Commands:"
  echo "  check-media-files            Check for missing/orphaned MP4 and M4A files"
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
  echo "  --model [tiny|base|small]    Specify Whisper model (default: base)"
  echo "  --accelerator [T4|A10G|A100] Specify GPU accelerator (default: T4)"
  echo "  --force                      Process even if already processed"
  echo "  --output [path]              Specify output directory"
  echo "  --auto-process               Automatically process files (for find-processable-videos)"
  echo "  --generate-map               Generate a CSV mapping file (for rename-mp4-files)"
  echo ""
  echo "Examples:"
  echo "  media-processing-cli.sh convert path/to/file.mp4"
  echo "  media-processing-cli.sh find-processable-videos --limit 1 --auto-process"
  echo "  media-processing-cli.sh transcribe 8f7e6d5c-4b3a-2a1e-9d8c-7f6e5d4c3b2a"
  echo "  media-processing-cli.sh process-video 8f7e6d5c-4b3a-2a1e-9d8c-7f6e5d4c3b2a"
  echo "  media-processing-cli.sh list-pending --limit 10"
  echo "  media-processing-cli.sh rename-mp4-files --dry-run"
  echo "  media-processing-cli.sh sync-m4a-names --dry-run --after-rename"
  echo "  media-processing-cli.sh update-disk-status --dry-run"
  echo "  media-processing-cli.sh register-expert-docs --limit 20"
  echo "  media-processing-cli.sh purge-processed-media --dry-run"
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
    ts-node "$SCRIPT_DIR/commands/convert-mp4.ts" "$@"
    ;;
  find-processable-videos)
    ts-node "$SCRIPT_DIR/commands/find-processable-videos.ts" "$@"
    ;;
  transcribe)
    ts-node "$SCRIPT_DIR/commands/transcribe-audio.ts" "$@"
    ;;
  transcribe-with-summary)
    ts-node "$SCRIPT_DIR/commands/transcribe-with-summary.ts" "$@"
    ;;
  list-transcribable)
    ts-node "$SCRIPT_DIR/commands/list-transcribable.ts" "$@"
    ;;
  show-transcription-status)
    ts-node "$SCRIPT_DIR/commands/show-transcription-status.ts" "$@"
    ;;
  process-video)
    ts-node "$SCRIPT_DIR/commands/process-video.ts" "$@"
    ;;
  list-pending)
    ts-node "$SCRIPT_DIR/commands/list-pending.ts" "$@"
    ;;
  list-ready)
    ts-node "$SCRIPT_DIR/commands/list-ready.ts" "$@"
    ;;
  update-status)
    ts-node "$SCRIPT_DIR/commands/update-status.ts" "$@"
    ;;
  extract-summary)
    ts-node "$SCRIPT_DIR/commands/extract-summary.ts" "$@"
    ;;
  batch-transcribe)
    ts-node "$SCRIPT_DIR/commands/batch-transcribe.ts" "$@"
    ;;
    
  # File checking commands
  check-media-files)
    ts-node "$SCRIPT_DIR/commands/check-media-files.ts" "$@"
    ;;
  find-missing-js-files)
    ts-node "$SCRIPT_DIR/commands/find-missing-js-files.ts" "$@"
    ;;
  run-shell-check)
    ts-node "$SCRIPT_DIR/commands/run-shell-check.ts" "$@"
    ;;
  purge-processed-media)
    ts-node "$SCRIPT_DIR/commands/purge-processed-media.ts" "$@"
    ;;
    
  # File management commands
  rename-mp4-files)
    ts-node "$SCRIPT_DIR/commands/rename-mp4-files.ts" "$@"
    ;;
  sync-m4a-names)
    ts-node "$SCRIPT_DIR/commands/sync-m4a-names.ts" "$@"
    ;;
  
  # Database integration commands
  update-disk-status)
    ts-node "$SCRIPT_DIR/index.ts" update-disk-status "$@"
    ;;
  register-expert-docs)
    ts-node "$SCRIPT_DIR/index.ts" register-expert-docs "$@"
    ;;
  register-local-mp4-files)
    ts-node "$SCRIPT_DIR/commands/register-local-mp4-files.ts" "$@"
    ;;
    
  # Help commands
  help|--help|-h)
    display_help
    ;;
  *)
    echo "❌ Unknown command: $COMMAND"
    display_help
    exit 1
    ;;
esac