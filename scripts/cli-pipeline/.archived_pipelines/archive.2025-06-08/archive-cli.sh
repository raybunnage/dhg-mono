#!/bin/bash

# Archive Management CLI Tool
# Purpose: Manage archiving of documents, scripts, and other files

# Set script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Source common functions
source "$PROJECT_ROOT/scripts/cli-pipeline/common-functions.sh" 2>/dev/null || true

# Load environment variables
load_env

# Function to track command usage
track_command() {
    local pipeline_name="archive"
    local command_name="$1"
    shift # Remove command name from arguments
    
    # Run the tracking script in background
    (cd "$PROJECT_ROOT" && ts-node "$PROJECT_ROOT/scripts/cli-pipeline/tracking/track-command.ts" "$pipeline_name" "$command_name" "$@" &)
}

# Function to show help
show_help() {
    cat << EOF
Archive Management CLI - Manage archived files and documents

Usage: ./archive-cli.sh <command> [options]

COMMANDS:
  (* = frequently used commands)

DOCUMENT ARCHIVING:
  * archive-docs        Archive old markdown documents
  * restore-doc         Restore an archived document
  * list-archived-docs  List all archived documents
  * find-archived       Search archived documents

SCRIPT ARCHIVING:
  * archive-script      Archive a script file
  * restore-script      Restore an archived script
  * list-archived-scripts List all archived scripts

BULK OPERATIONS:
  * bulk-archive        Archive multiple files by pattern
  * cleanup-empty       Remove empty archive directories
  * report              Generate archive status report

SEARCH & ANALYSIS:
  * search              Search in archived files
  * stats               Show archive statistics
  * recent              Show recently archived files

OPTIONS:
  --dry-run            Show what would be done without doing it
  --days <n>           Archive files older than n days (default: 30)
  --pattern <glob>     File pattern to match
  --force              Force operation without confirmation

EXAMPLES:
  # Archive old markdown documents
  ./archive-cli.sh archive-docs --days 60

  # Archive specific pattern
  ./archive-cli.sh bulk-archive --pattern "*-old.md"

  # Search in archives
  ./archive-cli.sh search "important topic"

  # Generate report
  ./archive-cli.sh report

EOF
}

# Main command dispatcher
case "$1" in
    # Document archiving
    "archive-docs")
        track_command "archive-docs" "${@:2}"
        ts-node "$SCRIPT_DIR/archive-documents.ts" "${@:2}"
        ;;
    
    "restore-doc")
        track_command "restore-doc" "${@:2}"
        ts-node "$SCRIPT_DIR/restore-document.ts" "${@:2}"
        ;;
    
    "list-archived-docs")
        track_command "list-archived-docs" "${@:2}"
        ts-node "$SCRIPT_DIR/list-archived-docs.ts" "${@:2}"
        ;;
    
    "find-archived")
        track_command "find-archived" "${@:2}"
        ts-node "$SCRIPT_DIR/find-archived.ts" "${@:2}"
        ;;
    
    # Script archiving
    "archive-script")
        track_command "archive-script" "${@:2}"
        ts-node "$PROJECT_ROOT/scripts/cli-pipeline/scripts/archive-script.ts" "${@:2}"
        ;;
    
    "restore-script")
        track_command "restore-script" "${@:2}"
        ts-node "$SCRIPT_DIR/restore-script.ts" "${@:2}"
        ;;
    
    "list-archived-scripts")
        track_command "list-archived-scripts" "${@:2}"
        ts-node "$SCRIPT_DIR/list-archived-scripts.ts" "${@:2}"
        ;;
    
    # Bulk operations
    "bulk-archive")
        track_command "bulk-archive" "${@:2}"
        ts-node "$SCRIPT_DIR/bulk-archive.ts" "${@:2}"
        ;;
    
    "cleanup-empty")
        track_command "cleanup-empty" "${@:2}"
        ts-node "$SCRIPT_DIR/cleanup-empty-dirs.ts" "${@:2}"
        ;;
    
    "report")
        track_command "report" "${@:2}"
        ts-node "$SCRIPT_DIR/archive-report.ts" "${@:2}"
        ;;
    
    # Search & analysis
    "search")
        track_command "search" "${@:2}"
        ts-node "$SCRIPT_DIR/search-archives.ts" "${@:2}"
        ;;
    
    "stats")
        track_command "stats" "${@:2}"
        ts-node "$SCRIPT_DIR/archive-stats.ts" "${@:2}"
        ;;
    
    "recent")
        track_command "recent" "${@:2}"
        ts-node "$SCRIPT_DIR/recent-archives.ts" "${@:2}"
        ;;
    
    # Help and default
    "--help"|"-h"|"")
        show_help
        ;;
    
    *)
        echo "Unknown command: $1"
        echo "Run './archive-cli.sh --help' for usage information"
        exit 1
        ;;
esac