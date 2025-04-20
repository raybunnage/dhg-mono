#!/bin/bash
# Script to run the Google Sync CLI
# Usage: ./google-sync-cli.sh <command> [options]
#
# AVAILABLE COMMANDS:
#   sync                         Sync files from Google Drive to the database (core functionality)
#   health-check                 Check the health of Google Drive API connection
#   classify-pdfs                Classify PDF files missing document types using Claude AI
#   classify-powerpoints         Classify PowerPoint files missing document types using local extraction and Claude AI
#   reclassify-docs              Re-classify documents with temperature=0 for deterministic results
#   classify-docs-service        Classify .docx and .txt files missing document types
#   check-duplicates             Check for duplicate files in sources_google
#   check-document-types         Check for files missing document types
#   report-main-video-ids        Report on video files for folders
#   show-expert-documents        Generate a report of expert documents in the database
#   list                         List Google sources with their corresponding expert documents
#   list-unclassified-files      List PDF and PowerPoint files without document types
#   check-expert-doc             Check the most recent expert document for proper content extraction
#   fix-orphaned-docx            Fix DOCX files with document_type_id but no expert_documents records
#   remove-expert-docs-pdf-records Remove expert_documents for PDF files with null document_type_id (incl. large PDFs)
#   help                         Show this help message

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="google_sync"
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

# Handle specific commands that might need special treatment
if [ "$1" = "count-mp4" ]; then
  shift
  track_command "count-mp4" "ts-node $SCRIPT_DIR/count-mp4-files.ts $*"
  exit $?
fi

if [ "$1" = "health-check" ]; then
  shift
  track_command "health-check" "$SCRIPT_DIR/health-check.sh $*"
  exit $?
fi

if [ "$1" = "classify-docs-service" ]; then
  shift
  track_command "classify-docs-service" "ts-node $SCRIPT_DIR/classify-missing-docs-with-service.ts $*"
  exit $?
fi

if [ "$1" = "classify-pdfs" ] || [ "$1" = "classify-pdfs-with-service" ]; then
  shift
  
  # Store the original command name for tracking
  CMD_NAME="classify-pdfs-with-service"
  
  # Check if the user provided a limit parameter
  LIMIT="10"  # Default value
  ARGS=""
  
  # Parse arguments to find the limit parameter
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --limit|-l)
        LIMIT="$2"
        shift 2
        ;;
      --limit=*|-l=*)
        LIMIT="${1#*=}"
        shift
        ;;
      *)
        # Accumulate other arguments
        ARGS="$ARGS $1"
        shift
        ;;
    esac
  done
  
  # Ensure limit is explicitly set
  if [[ "$ARGS" != *"--limit"* && "$ARGS" != *"-l"* ]]; then
    ARGS="$ARGS --limit $LIMIT"
  fi
  
  track_command "$CMD_NAME" "ts-node $SCRIPT_DIR/classify-pdfs-with-service.ts $ARGS"
  exit $?
fi

if [ "$1" = "classify-powerpoints" ]; then
  shift
  
  # Store the original command name for tracking
  CMD_NAME="classify-powerpoints"
  
  # Check if the user provided a limit parameter
  LIMIT="5"  # Default value
  ARGS=""
  
  # Parse arguments to find the limit parameter
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --limit|-l)
        LIMIT="$2"
        shift 2
        ;;
      --limit=*|-l=*)
        LIMIT="${1#*=}"
        shift
        ;;
      *)
        # Accumulate other arguments
        ARGS="$ARGS $1"
        shift
        ;;
    esac
  done
  
  # Ensure limit is explicitly set
  if [[ "$ARGS" != *"--limit"* && "$ARGS" != *"-l"* ]]; then
    ARGS="$ARGS --limit $LIMIT"
  fi
  
  track_command "$CMD_NAME" "ts-node $SCRIPT_DIR/classify-powerpoints.ts $ARGS"
  exit $?
fi

if [ "$1" = "reclassify-docs" ] || [ "$1" = "reclassify-docs-with-service" ]; then
  shift
  track_command "reclassify-docs-with-service" "ts-node $SCRIPT_DIR/reclassify-docs-with-service.ts $*"
  exit $?
fi

if [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  # Show the help message
  echo "Google Sync CLI - Manage Google Drive synchronization and document classification"
  echo ""
  echo "USAGE:"
  echo "  ./google-sync-cli.sh <command> [options]"
  echo ""
  echo "COMMANDS:"
  echo "  sync                         Sync files from Google Drive to the database (core functionality)"
  echo "  health-check                 Check the health of Google Drive API connection"
  echo "  classify-pdfs                Classify PDF files missing document types using Claude AI"
  echo "  classify-powerpoints         Classify PowerPoint files missing document types using local extraction and Claude AI"
  echo "  reclassify-docs              Re-classify documents with temperature=0 for deterministic results"
  echo "  classify-docs-service        Classify .docx and .txt files missing document types"
  echo "  validate-pdf-classification  Validate PDF classification results and generate a report"
  echo "  check-duplicates             Check for duplicate files in sources_google"
  echo "  check-document-types         Check for files missing document types"
  echo "  report-main-video-ids        Report on video files for folders"
  echo "  update-media-document-types  Update document_type_id for media files and create expert_documents"
  echo "  show-expert-documents        Generate a report of expert documents in the database"
  echo "  list                         List Google sources with their corresponding expert documents"
  echo "  list-unclassified-files      List PDF and PowerPoint files without document types"
  echo "  check-expert-doc             Check the most recent expert document for proper content extraction"
  echo "  fix-orphaned-docx            Fix DOCX files with document_type_id but no expert_documents records"
  echo "  remove-expert-docs-pdf-records Remove expert_documents for PDF files with null document_type_id"
  echo "  check-recent-updates         Show recently updated files and their associated expert documents"
  echo "  help                         Show this help message"
  echo ""
  echo "EXAMPLES:"
  echo "  # Sync files from Google Drive (core functionality)"
  echo "  ./google-sync-cli.sh sync --verbose --limit 100"
  echo ""
  echo "  # Run sync in dry-run mode to preview changes"
  echo "  ./google-sync-cli.sh sync --dry-run --max-depth 3"
  echo ""
  echo "  # Check if Google Drive API connection is working"
  echo "  ./google-sync-cli.sh health-check"
  echo ""
  echo "  # Classify PDFs with verbose output"
  echo "  ./google-sync-cli.sh classify-pdfs --verbose"
  echo ""
  echo "  # Re-classify documents created after a specific date"
  echo "  ./google-sync-cli.sh reclassify-docs --start-date \"2025-04-01\" --limit 20"
  echo ""
  echo "  # Run PDF classification in dry-run mode to see what would be updated"
  echo "  ./google-sync-cli.sh classify-pdfs --dry-run"
  echo ""
  echo "  # Classify PowerPoint files and extract their content"
  echo "  ./google-sync-cli.sh classify-powerpoints --limit 3 --verbose"
  echo ""
  echo "  # Run PowerPoint classification in dry-run mode"
  echo "  ./google-sync-cli.sh classify-powerpoints --dry-run"
  echo ""
  echo "  # Force reprocessing of PowerPoint files even if they already have content"
  echo "  ./google-sync-cli.sh classify-powerpoints --force --limit 1"
  echo ""
  echo "  # Generate a report of expert documents in the database"
  echo "  ./google-sync-cli.sh show-expert-documents"
  echo ""
  echo "  # Show recently updated PDF files and their expert documents"
  echo "  ./google-sync-cli.sh check-recent-updates --limit 10"
  echo ""
  echo "  # List Google sources with a console-friendly table format"
  echo "  ./google-sync-cli.sh list --limit 50 --console"
  echo ""
  echo "  # Update document types for media files and create expert_documents"
  echo "  ./google-sync-cli.sh update-media-document-types"
  echo ""
  echo "  # Preview media document type updates without making changes"
  echo "  ./google-sync-cli.sh update-media-document-types --dry-run"
  echo ""
  echo "  # Update document types but skip creating expert_documents"
  echo "  ./google-sync-cli.sh update-media-document-types --skip-expert-docs"
  exit 0
fi

if [ "$1" = "test-prompt-service" ]; then
  shift
  track_command "test-prompt-service" "ts-node $SCRIPT_DIR/test-prompt-service.ts $*"
  exit $?
fi

if [ "$1" = "fix-orphaned-docx" ]; then
  shift
  track_command "fix-orphaned-docx" "ts-node $SCRIPT_DIR/fix-orphaned-docx.ts $*"
  exit $?
fi

if [ "$1" = "report-main-video-ids" ]; then
  shift
  track_command "report-main-video-ids" "ts-node $SCRIPT_DIR/report-main-video-ids.ts $*"
  exit $?
fi

if [ "$1" = "list" ]; then
  shift
  track_command "list" "ts-node $SCRIPT_DIR/list-google-sources.ts $*"
  exit $?
fi

if [ "$1" = "list-unclassified-files" ]; then
  shift
  track_command "list-unclassified-files" "ts-node $SCRIPT_DIR/list-unclassified-files.ts $*"
  exit $?
fi

if [ "$1" = "show-expert-documents" ]; then
  shift
  track_command "show-expert-documents" "ts-node $SCRIPT_DIR/show-expert-documents.ts $*"
  exit $?
fi

if [ "$1" = "check-expert-doc" ]; then
  shift
  track_command "check-expert-doc" "ts-node $SCRIPT_DIR/check-expert-doc.ts $*"
  exit $?
fi

if [ "$1" = "validate-pdf-classification" ]; then
  shift
  track_command "validate-pdf-classification" "ts-node $SCRIPT_DIR/validate-pdf-classification.ts $*"
  exit $?
fi

if [ "$1" = "remove-expert-docs-pdf-records" ]; then
  shift
  track_command "remove-expert-docs-pdf-records" "ts-node $SCRIPT_DIR/remove-expert-docs-pdf-records.ts $*"
  exit $?
fi

if [ "$1" = "check-recent-updates" ]; then
  shift
  track_command "check-recent-updates" "ts-node $SCRIPT_DIR/check-recent-updates.ts $*"
  exit $?
fi

if [ "$1" = "check-document-types" ]; then
  shift
  track_command "check-document-types" "ts-node $SCRIPT_DIR/index.ts check-document-types $*"
  exit $?
fi

if [ "$1" = "check-duplicates" ]; then
  shift
  track_command "check-duplicates" "ts-node $SCRIPT_DIR/index.ts check-duplicates $*"
  exit $?
fi

if [ "$1" = "update-file-signatures" ]; then
  shift
  track_command "update-file-signatures" "ts-node $SCRIPT_DIR/index.ts update-file-signatures $*"
  exit $?
fi

if [ "$1" = "update-media-document-types" ]; then
  shift
  track_command "update-media-document-types" "ts-node $SCRIPT_DIR/update-media-document-types.ts $*"
  exit $?
fi

if [ "$1" = "classify-docs-with-service" ]; then
  shift
  track_command "classify-docs-with-service" "ts-node $SCRIPT_DIR/index.ts classify-docs-with-service $*"
  exit $?
fi

if [ "$1" = "update-main-video-ids" ]; then
  shift
  track_command "update-main-video-ids" "ts-node $SCRIPT_DIR/index.ts update-main-video-ids $*"
  exit $?
fi

if [ "$1" = "browser-recursive-search" ]; then
  shift
  track_command "browser-recursive-search" "ts-node $SCRIPT_DIR/index.ts browser-recursive-search $*"
  exit $?
fi

if [ "$1" = "update-sources-from-json" ]; then
  shift
  track_command "update-sources-from-json" "ts-node $SCRIPT_DIR/index.ts update-sources-from-json $*"
  exit $?
fi

if [ "$1" = "insert-missing-sources" ]; then
  shift
  track_command "insert-missing-sources" "ts-node $SCRIPT_DIR/index.ts insert-missing-sources $*"
  exit $?
fi

if [ "$1" = "update-schema-from-json" ]; then
  shift
  track_command "update-schema-from-json" "ts-node $SCRIPT_DIR/index.ts update-schema-from-json $*"
  exit $?
fi

if [ "$1" = "add-root-service" ]; then
  shift
  track_command "add-root-service" "ts-node $SCRIPT_DIR/index.ts add-root-service $*"
  exit $?
fi

if [ "$1" = "sync" ]; then
  shift
  track_command "sync-and-update-metadata" "ts-node $SCRIPT_DIR/sync-and-update-metadata.ts $*"
  exit $?
fi

# Track commands that directly use index.ts with proper command name
if [ "$1" = "sync-and-update-metadata" ]; then
  shift
  track_command "sync-and-update-metadata" "ts-node $SCRIPT_DIR/index.ts sync-and-update-metadata $*"
  exit $?
fi

# Run the TypeScript file with ts-node - capture command from args
COMMAND="${1:-main}"
track_command "$COMMAND" "ts-node $SCRIPT_DIR/index.ts $*"