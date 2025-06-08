#!/bin/bash
# Script to run the Google Sync CLI
# Usage: ./google-sync-cli.sh <command> [options]
#
# AVAILABLE COMMANDS:
#   sync                         Sync files from Google Drive to the database (core functionality)
#   health-check                 Check the health of Google Drive API connection
#   classify-pdfs                Classify PDF files missing document types or marked as needs_reprocessing using Claude AI
#   classify-powerpoints         Classify PowerPoint files missing document types using local extraction and Claude AI
#   reclassify-docs              Re-classify documents with temperature=0 for deterministic results
#   classify-docs-service        Classify .docx and .txt files missing document types
#   classify                     NEW: Universal document classification - handles all file types
#   test-classify                NEW: Test the unified classification service  
#   reprocess-docx-files         Reprocess DOCX files with needs_reprocessing status
#   check-duplicates             Check for duplicate files in sources_google
#   check-document-types         Check for files missing document types
#   renamed-file                 Update sources_google record when a file has been renamed in Google Drive (by source ID)
#   report-main-video-ids        Report on video files for folders
#   show-expert-documents        Generate a report of expert documents in the database
#   list                         List Google sources with their corresponding expert documents
#   list-unclassified-files      List PDF and PowerPoint files without document types
#   list-unsupported-types       List all unsupported document types in the system
#   needs-reprocessing           Find documents marked as needs_reprocessing with unsupported document types
#   check-expert-doc             Check the most recent expert document for proper content extraction
#   fix-orphaned-docx            Fix DOCX files with document_type_id but no expert_documents records
#   remove-expert-docs-pdf-records Remove expert_documents for PDF files with null document_type_id (incl. large PDFs)
#   sync-expert-documents        Sync sources_google files with expert_documents records (create missing records)
#   assign-main-video-id         Assign main_video_id to all nested folders/files in a high-level folder
#   refresh-main-video-id        Find MP4 in folder and update main_video_id for all items (auto-detect video)
#   report-folder-video-assignments  Generate report showing main_video_id assignments for a folder and nested items
#   help                         Show this help message

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${PROJECT_ROOT}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Load environment variables from project root .env.development file if it exists
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  # Export environment variables for Supabase
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Function to execute a command with tracking
track_command() {
  local pipeline_name="google_sync"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Check if we have a TS tracking wrapper
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
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

if [ "$1" = "check-reprocessing-status" ]; then
  shift
  track_command "check-reprocessing-status" "ts-node $SCRIPT_DIR/check-reprocessing-status.ts $*"
  exit $?
fi

if [ "$1" = "health-check" ]; then
  shift
  track_command "health-check" "$SCRIPT_DIR/health-check.sh $*"
  exit $?
fi

if [ "$1" = "classify-docs-service" ]; then
  shift
  echo "Classifying documents with service (only updates sources_google document_type_id)"
  track_command "classify-docs-service" "ts-node $SCRIPT_DIR/classify-missing-docs-with-service.ts $*"
  exit $?
fi

if [ "$1" = "reprocess-docx-files" ]; then
  shift
  echo "Reprocessing DOCX files with needs_reprocessing status (only updates sources_google document_type_id)"
  track_command "reprocess-docx-files" "ts-node $SCRIPT_DIR/reprocess-docx-files.ts $*"
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

# NEW: Unified classification command
if [ "$1" = "classify" ]; then
  shift
  echo "Running unified document classification..."
  track_command "classify" "ts-node $SCRIPT_DIR/classify.ts $*"
  exit $?
fi

# NEW: Test classification command
if [ "$1" = "test-classify" ]; then
  shift
  echo "Testing unified classification service..."
  track_command "test-classify" "ts-node $SCRIPT_DIR/test-classify.ts $*"
  exit $?
fi

if [ "$1" = "reclassify-docs" ] || [ "$1" = "reclassify_docs" ]; then
  shift
  # This is the command to reclassify documents that need reprocessing
  # based on their file extension
  
  echo "Reclassifying documents that need reprocessing..."
  
  # First get a list of documents that need reprocessing
  REPROCESSING_OUTPUT_PATH="./reprocessing-sources-temp.json"
  
  # Process arguments
  LIMIT_ARG="500"
  DRY_RUN=false
  
  # Process all arguments
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--dry-run" ]; then
      DRY_RUN=true
      shift
    elif [[ "$1" =~ ^[0-9]+$ ]]; then
      LIMIT_ARG="$1"
      shift
    else
      shift
    fi
  done
  
  track_command "reclassify-docs" "ts-node $SCRIPT_DIR/check-reprocessing-status.ts --limit $LIMIT_ARG --output $REPROCESSING_OUTPUT_PATH --format json"
  
  # Check if we got the data
  if [ ! -f "$REPROCESSING_OUTPUT_PATH" ]; then
    echo "Error: Could not get list of documents that need reprocessing"
    exit 1
  fi
  
  # Read the file to get documents needing reprocessing
  echo "Processing documents that need reprocessing..."
  
  # We need jq to properly parse the JSON
  if ! command -v jq &> /dev/null; then
    echo "Error: 'jq' command is required but not installed. Please install jq to continue."
    exit 1
  fi
  
  # Get the processed sources as an array
  SOURCES=$(jq -c '.[]' "$REPROCESSING_OUTPUT_PATH")
  
  # Create counters file to track counts outside the subshell
  COUNTS_FILE=$(mktemp)
  echo "0 0 0 0 0" > "$COUNTS_FILE" # DOCX PDF PPTX MP4 OTHER counts
  
  # Process each document based on file extension
  echo "$SOURCES" | while read -r SOURCE; do
    SOURCE_ID=$(echo "$SOURCE" | jq -r '.sourceId')
    FILENAME=$(echo "$SOURCE" | jq -r '.sourceName')
    PROCESSING_STATUS=$(echo "$SOURCE" | jq -r '.processingStatus')
    
    if [ -z "$FILENAME" ]; then
      echo "Warning: Could not find filename for source ID $SOURCE_ID, skipping"
      continue
    fi
    
    # Only process documents that need reprocessing (needs_reprocessing status)
    # ENHANCED FIX: Normalize processing status to handle whitespace/case issues
    NORMALIZED_STATUS=$(echo "$PROCESSING_STATUS" | xargs | tr '[:upper:]' '[:lower:]')
    echo "Normalized status: '$NORMALIZED_STATUS'"
    
    if [[ "$NORMALIZED_STATUS" != *"needs"*"reprocessing"* ]]; then
      echo "Skipping document with processing status: '$PROCESSING_STATUS'"
      continue
    fi
    
    # Debug log for documents we're processing
    echo "Found document needing reprocessing: $FILENAME"
    
    # Read current counts
    read DOCX_COUNT PDF_COUNT PPTX_COUNT MP4_COUNT OTHER_COUNT < "$COUNTS_FILE"
    
    # Process based on file extension
    if [[ "$FILENAME" == *".docx" ]]; then
      echo "Processing DOCX file: $FILENAME (ID: $SOURCE_ID)"
      if [ "$DRY_RUN" = false ]; then
        # Get the expert document ID
        EXPERT_DOC_ID=$(echo "$SOURCE" | jq -r '.expertDocId')
        if [ -n "$EXPERT_DOC_ID" ] && [ "$EXPERT_DOC_ID" != "null" ]; then
          # Run the force reclassify command directly
          track_command "force-reclassify-docx" "ts-node -e \"require('$SCRIPT_DIR/force-reclassify').forceReclassifyDocument('$EXPERT_DOC_ID', '$SOURCE_ID', true)\""
          
          # Display document summary
          sleep 1 # Brief pause to ensure the DB has been updated
          track_command "check-docx-summary" "ts-node -e \"require('$SCRIPT_DIR/reclassify-docs-helper').checkDocumentSummary('$EXPERT_DOC_ID')\""
        else
          echo "⚠️ No expert document ID found for ${FILENAME}, running standard classification"
          # Fall back to standard classification
          track_command "classify-docs-service" "ts-node $SCRIPT_DIR/classify-missing-docs-with-service.ts --limit 1 --verbose"
        fi
      else
        echo "[DRY RUN] Would classify $FILENAME with classify-docs-service"
      fi
      DOCX_COUNT=$((DOCX_COUNT + 1))
    elif [[ "$FILENAME" == *".pdf" ]]; then
      echo "Processing PDF file: $FILENAME (ID: $SOURCE_ID)"
      if [ "$DRY_RUN" = false ]; then
        # Get the expert document ID
        EXPERT_DOC_ID=$(echo "$SOURCE" | jq -r '.expertDocId')
        if [ -n "$EXPERT_DOC_ID" ] && [ "$EXPERT_DOC_ID" != "null" ]; then
          # Run the force reclassify command directly
          track_command "force-reclassify-pdf" "ts-node -e \"require('$SCRIPT_DIR/force-reclassify').forceReclassifyDocument('$EXPERT_DOC_ID', '$SOURCE_ID', true)\""
          
          # Display document summary
          sleep 1 # Brief pause to ensure the DB has been updated
          track_command "check-pdf-summary" "ts-node -e \"require('$SCRIPT_DIR/reclassify-docs-helper').checkDocumentSummary('$EXPERT_DOC_ID')\""
        else
          echo "⚠️ No expert document ID found for ${FILENAME}, running standard classification"
          # Fall back to standard classification
          track_command "classify-pdfs" "ts-node $SCRIPT_DIR/classify-pdfs-with-service.ts --limit 1 --verbose"
        fi
      else
        echo "[DRY RUN] Would classify $FILENAME with classify-pdfs"
      fi
      PDF_COUNT=$((PDF_COUNT + 1))
    elif [[ "$FILENAME" == *".pptx" ]]; then
      echo "Processing PowerPoint file: $FILENAME (ID: $SOURCE_ID)"
      if [ "$DRY_RUN" = false ]; then
        # Get the expert document ID
        EXPERT_DOC_ID=$(echo "$SOURCE" | jq -r '.expertDocId')
        if [ -n "$EXPERT_DOC_ID" ] && [ "$EXPERT_DOC_ID" != "null" ]; then
          # Run the force reclassify command directly
          track_command "force-reclassify-pptx" "ts-node -e \"require('$SCRIPT_DIR/force-reclassify').forceReclassifyDocument('$EXPERT_DOC_ID', '$SOURCE_ID', true)\""
          
          # Display document summary
          sleep 1 # Brief pause to ensure the DB has been updated
          track_command "check-pptx-summary" "ts-node -e \"require('$SCRIPT_DIR/reclassify-docs-helper').checkDocumentSummary('$EXPERT_DOC_ID')\""
        else
          echo "⚠️ No expert document ID found for ${FILENAME}, running standard classification"
          # Fall back to standard classification
          track_command "classify-powerpoints" "ts-node $SCRIPT_DIR/classify-powerpoints.ts --limit 1 --verbose"
        fi
      else
        echo "[DRY RUN] Would classify $FILENAME with classify-powerpoints"
      fi
      PPTX_COUNT=$((PPTX_COUNT + 1))
    elif [[ "$FILENAME" == *".mp4" || "$FILENAME" == *".MP4" ]]; then
      echo "Found MP4 file: $FILENAME (ID: $SOURCE_ID)"
      EXPERT_DOC_ID=$(echo "$SOURCE" | jq -r '.expertDocId')
      
      if [ "$DRY_RUN" = false ] && [ -n "$EXPERT_DOC_ID" ] && [ "$EXPERT_DOC_ID" != "null" ]; then
        # For MP4 files, mark them as skip_processing instead of processing them
        # MP4 files should not be classified with text-based AI
        echo "Marking MP4 file as skip_processing (videos should not be classified with text-based AI)"
        track_command "mark-skip-processing" "ts-node -e \"require('$SCRIPT_DIR/reclassify-docs-helper').markSkipProcessing('$EXPERT_DOC_ID', '$SOURCE_ID', 'Video files should not be processed with text-based AI tools')\""
        
        # Count this as an MP4 file
        MP4_COUNT=$((MP4_COUNT + 1))
      else
        echo "[DRY RUN] Would mark MP4 file $FILENAME as skip_processing"
        MP4_COUNT=$((MP4_COUNT + 1))
      fi
    else
      echo "Skipping $FILENAME - unsupported file type"
      OTHER_COUNT=$((OTHER_COUNT + 1))
    fi
    
    # Write updated counts back to file
    echo "$DOCX_COUNT $PDF_COUNT $PPTX_COUNT $MP4_COUNT $OTHER_COUNT" > "$COUNTS_FILE"
    
    # Add a small pause to prevent overwhelming the API
    if [ "$DRY_RUN" = false ]; then
      sleep 1
    fi
  done
  
  # Read final counts
  read DOCX_COUNT PDF_COUNT PPTX_COUNT MP4_COUNT OTHER_COUNT < "$COUNTS_FILE"
  rm -f "$COUNTS_FILE"
  
  # Print summary
  echo ""
  echo "Reclassification Summary:"
  echo "------------------------"
  echo "DOCX files: $DOCX_COUNT"
  echo "PDF files: $PDF_COUNT"
  echo "PowerPoint files: $PPTX_COUNT"
  echo "MP4 files: $MP4_COUNT"
  echo "Other files: $OTHER_COUNT"
  echo "------------------------"
  echo "Total files: $((DOCX_COUNT + PDF_COUNT + PPTX_COUNT + MP4_COUNT + OTHER_COUNT))"
  
  # Clean up temporary file if not in dry run mode
  if [ "$DRY_RUN" = false ]; then
    rm -f "$REPROCESSING_OUTPUT_PATH"
  else
    echo "Dry run mode - keeping temporary file: $REPROCESSING_OUTPUT_PATH"
  fi
  
  echo "Reclassification complete!"
  exit $?
fi

if [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  # Show the help message
  echo "Google Sync CLI - Manage Google Drive synchronization and document classification"
  echo ""
  echo "STATISTICS (as of 5/25/2025):"
  echo "  - Total Google Sync Commands: 92"
  echo "  - Total Executions: 2,304"
  echo "  - Overall Success Rate: 83.9%"
  echo ""
  echo "USAGE:"
  echo "  ./google-sync-cli.sh <command> [options]"
  echo ""
  echo "COMMANDS:"
  echo "  (* = frequently used commands with usage count and success rate)"
  echo ""
  echo "CORE OPERATIONS:"
  echo "  * sync                         Sync files from Google Drive to the database with intelligent file categorization (legacy - use sync-all)"
  echo "    sync-all                     NEW: Complete sync pipeline (sync + process + metadata update) - RECOMMENDED"
  echo "    sync-files                   NEW: Fast core sync only - just file existence (< 30s typical)"
  echo "    sync-history                 NEW: View recent sync history from the database"
  echo "    process-new-files-enhanced   NEW: Process new files with detailed hierarchical report (create expert_documents)"
  echo "    update-metadata              NEW: Update metadata for existing files (size, thumbnails, renames)"
  echo "    verify-deletions             NEW: Verify deleted files and optionally restore those that still exist"
  echo "    fix-root-path-depth          Fix path_depth for root folders (should be -1)"
  echo "    find-folder                  Find a specific folder or file by name pattern in Google Drive"
  echo "    get-current-drive-id         Get the current drive_id for a file given its path and root_drive_id"
  echo "  * health-check                 Check the health of Google Drive API connection"
  echo ""
  echo "DOCUMENT CLASSIFICATION:"
  echo "  * update-media-document-types  Update document_type_id for media files and create expert_documents (191 uses, 89.5% success)"
  echo "  * classify-docs-service        Classify .docx and .txt files missing document types (only updates sources_google table) (73 uses, 90.4% success)"
  echo "  * classify-powerpoints         Classify PowerPoint files missing document types using Claude AI (not in recent stats)"
  echo "    force-classify-docs          Force classify documents using the document-classification-prompt-new"
  echo "    find-documents-with-content Find documents with content that can be used for classification"
  echo "    check-concepts            Check concepts stored for a document (by source ID)"
  echo "    classify-unprocessed-with-content  Find docx/txt/pptx files with content and classify them using AI"
  echo "    classify-pdfs                Classify PDF files missing document types or marked as needs_reprocessing using Claude AI"
  echo "    direct-classify-pdfs         Process PDF files with needs_reprocessing status directly (more reliable)"
  echo "    fix-classify-pdfs            Mark PDF files with needs_reprocessing status as processed (without analyzing)"
  echo "    validate-pdf-classification  Validate PDF classification results and generate a report (slow)"
  echo ""
  echo "LISTING & REPORTING:"
  echo "  * list                         List Google sources with their corresponding expert documents (109 uses, 97.2% success)"
  echo "  * list-google-sources          List sources from Google Drive with filtering options (106 uses, 88.7% success)"
  echo "  * show-expert-documents        Generate a report of expert documents in the database (100 uses, 83.0% success)"
  echo "  * list-pipeline-status         List Google sources with their pipeline status (89 uses, 94.4% success)"
  echo "    pipeline-status-summary      Generate a summary report of all pipeline_status enum values"
  echo "    update-processed-records     Update records with valid processed_content JSON to have a pipeline_status of \"processed\""
  echo "    process-unprocessed          Process unprocessed documents based on mime type (supports DOCX and PDF)"
  echo "    source-info                  Get detailed information about a sources_google record and related expert_documents"
  echo "    list-unclassified-files      List PDF, PowerPoint, TXT and DOCX files without document types"
  echo "    list-unsupported-types       List all unsupported document types in the system"
  echo "    list-main-video-folders      List folders that have a main_video_id set with details"
  echo "    list-main-video-folders-tree List high-level folders with main_video_id and their hierarchical contents"
  echo "    check-recent-updates         Show recently updated files and their associated expert documents"
  echo "    check-document-summary       Check and display the summary for a specific document by ID"
  echo "    check-expert-doc             Check the most recent expert document for proper content extraction"
  echo "  * update-main-video-id         Update main_video_id for a specified folder with a specified video file (70 uses, 44.3% success)"
  echo "    report-main-video-ids        Report on video files for folders"
  echo ""
  echo "MAINTENANCE & INTEGRITY:"
  echo "  * check-reprocessing-status    Check which expert documents need reprocessing based on metadata (145 uses, 95.9% success)"
  echo "  * needs-reprocessing           Find documents marked as needs_reprocessing with unsupported document types (115 uses, 80.9% success)"
  echo "  * sources-google-integrity     Check for document type consistency issues (files with folder types, etc.) (108 uses, 86.1% success)"
  echo "    reclassify-docs              Re-classify documents that need reprocessing based on file type (not in recent stats)"
  echo "    check-duplicates             Check for duplicate files by path_array, drive_id, or name (14 uses recently)"
  echo "    check-document-types         Check for files missing document types"
  echo "    check-deleted-files          Check if files marked as deleted in the database still exist in Google Drive
    reset-deleted-files          Reset is_deleted flag for files that still exist in Google Drive"
  echo "    fix-bad-folders              Fix files incorrectly marked with folder document types"
  echo "    fix-orphaned-docx            Fix DOCX files with document_type_id but no expert_documents records"
  echo "    fix-mp4-status               Fix MP4 files that are incorrectly marked as needs_reprocessing"
  echo ""
  echo "EXPERT DOCUMENTS MANAGEMENT:"
  echo "  * sync-expert-documents        Sync sources_google files with expert_documents records (create missing records)"
  echo "    expert-documents-duplicates  Find and report duplicate expert_documents with same source_id"
  echo "    expert-documents-purge       Purge problematic expert_documents (duplicates or orphaned records)"
  echo "    clean-orphaned-records       Clean up orphaned expert_documents and their presentation_assets references"
  echo "    purge-orphaned-with-presentations Clean up orphaned expert_documents and related presentation_assets"
  echo "    check-duplicate-prevention   Check if all functions inserting expert_documents prevent duplicates"
  echo "    remove-expert-docs-pdf-records Remove expert_documents for PDF files with null document_type_id"
  echo ""
  echo "REPROCESSING MANAGEMENT:"
  echo "    ids-need-reprocessing        Reset reprocessing_status to needs_reprocessing for specified sources"
  echo "    find-needs-reprocessing      Find files with incorrect document types and mark them for reprocessing"
  echo "    mark-pdfs                    Mark PDF files for reprocessing (creates needs_reprocessing status)"
  echo "    clear-reprocessing           Clear 'needs_reprocessing' status for documents"
  echo ""
  echo "AUDIO EXTRACTION:"
  echo "    analyze-audio-gaps           Find MP4 files missing corresponding M4A audio files"
  echo "    generate-audio-batch         Generate batch processing scripts for audio extraction"
  echo "    upload-audio-files           Upload extracted M4A files to Google Drive"
  echo ""
  echo "STATISTICS:"
  echo "    populate-statistics          Populate google_sync_statistics table with folder statistics for active drive"
  echo "    show-statistics             Display current sync statistics from the database"
  echo ""
  echo "OTHER:"
  echo "    analyze-command-usage        Analyze Google sync command usage patterns from tracking data"
  echo "    analyze-unprocessed-files    Analyze which files in sources_google don't have expert_documents records"
  echo "    help                         Show this help message"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "CORE OPERATIONS:"
  echo "  # NEW RECOMMENDED: Complete sync pipeline (fast sync + process + metadata)"
  echo "  ./google-sync-cli.sh sync-all --verbose"
  echo ""
  echo "  # NEW: Quick sync to check for new files only (< 30s typical)"
  echo "  ./google-sync-cli.sh sync-files --dry-run"
  echo ""
  echo "  # NEW: Process new files with detailed hierarchical report showing full folder structure"
  echo "  ./google-sync-cli.sh process-new-files-enhanced --limit 50 --verbose"
  echo ""
  echo "  # NEW: Update metadata for existing files (handles renames, size changes)"
  echo "  ./google-sync-cli.sh update-metadata --limit 100 --verbose"
  echo ""
  echo "  # NEW: Verify deleted files and restore those that still exist"
  echo "  ./google-sync-cli.sh verify-deletions --restore --limit 50"
  echo ""
  echo "  # Legacy: Full sync with all operations (slow - 2+ minutes)"
  echo "  ./google-sync-cli.sh sync --verbose --limit 100"
  echo ""
  echo "  # Run sync in preview mode (no changes) with limited depth"
  echo "  ./google-sync-cli.sh sync --dry-run --max-depth 3"
  echo ""
  echo "  # Check only for new folders (faster operation)"
  echo "  ./google-sync-cli.sh sync --new-folder-only --verbose"
  echo ""
  echo "  # Find a specific folder by name"
  echo "  ./google-sync-cli.sh find-folder \"folder-name-pattern\""
  echo ""
  echo "  # Get the current drive_id for a file at a specific path"
  echo "  ./google-sync-cli.sh get-current-drive-id --path \"Expert Profiles/John Doe/presentation.pptx\" --root-drive-id \"1ABC123XYZ\""
  echo ""
  echo "  # Get drive_id with verbose output to see search progress"
  echo "  ./google-sync-cli.sh get-current-drive-id --path \"folder1/folder2/document.pdf\" --root-drive-id \"1DEF456ABC\" --verbose"
  echo ""
  echo "  # Check if Google Drive API connection is working"
  echo "  ./google-sync-cli.sh health-check"
  echo ""
  echo "DOCUMENT CLASSIFICATION:"
  echo "  # Update document types for media files and create expert_documents"
  echo "  ./google-sync-cli.sh update-media-document-types --dry-run"
  echo ""
  echo "  # Classify PowerPoint files and extract their content"
  echo "  ./google-sync-cli.sh classify-powerpoints --limit 3 --verbose"
  echo ""
  echo "  # Classify .docx and .txt files (only updates sources_google table)"
  echo "  ./google-sync-cli.sh classify-docs-service --limit 5 --concurrency 2"
  echo ""
  echo "  # Find and classify unprocessed docx/txt/pptx files that have content"
  echo "  ./google-sync-cli.sh classify-unprocessed-with-content --limit 5 --mime-types docx,txt"
  echo ""
  echo "  # Run a dry run of the classify-unprocessed-with-content command"
  echo "  ./google-sync-cli.sh classify-unprocessed-with-content --dry-run --verbose"
  echo ""
  echo "  # Reprocess DOCX files that have needs_reprocessing status"
  echo "  ./google-sync-cli.sh reprocess-docx-files --limit 10 --verbose"
  echo ""
  echo "LISTING & REPORTING:"
  echo "  # Generate a report of expert documents in the database"
  echo "  ./google-sync-cli.sh show-expert-documents"
  echo ""
  echo "  # List Google sources with a console-friendly table format"
  echo "  ./google-sync-cli.sh list --limit 50 --console"
  echo ""
  echo "  # List Google sources with pipeline status in a console-friendly table format"
  echo "  ./google-sync-cli.sh list-pipeline-status --limit 50 --console"
  echo ""
  echo "  # List Google sources with a specific pipeline status (e.g., unprocessed)"
  echo "  ./google-sync-cli.sh list-pipeline-status --status unprocessed --console"
  echo ""
  echo "  # List Google sources excluding those with 'processed' status"
  echo "  ./google-sync-cli.sh list-pipeline-status --exclude-processed --console"
  echo ""
  echo "  # List only newly added files (created within the last 7 days)"
  echo "  ./google-sync-cli.sh list-pipeline-status --isNewFile --console"
  echo ""
  echo "  # Generate a summary of pipeline_status distribution across all expert documents"
  echo "  ./google-sync-cli.sh pipeline-status-summary --console"
  echo ""
  echo "  # Generate a markdown-formatted table of pipeline statuses in the console"
  echo "  ./google-sync-cli.sh pipeline-status-summary --markdown"
  echo ""
  echo "  # Generate a detailed pipeline status report with additional insights"
  echo "  ./google-sync-cli.sh pipeline-status-summary --all --markdown"
  echo ""
  echo "  # Update records with valid processed_content and no errors to have status \"processed\""
  echo "  ./google-sync-cli.sh update-processed-records --dry-run"
  echo ""
  echo "  # Process unprocessed DOCX and PDF files with specialized handling"
  echo "  ./google-sync-cli.sh process-unprocessed --dry-run --limit 5"
  echo ""
  echo "  # Report on video files for folders"
  echo "  ./google-sync-cli.sh report-main-video-ids"
  echo ""
  echo "  # Update main_video_id for a folder with a specific video file"
  echo "  ./google-sync-cli.sh update-main-video-id --folder-name \"2024-05-08-Kjearvik\" --video-name \"Kjearvik_2024_05_08.mp4\""
  echo ""
  echo "MAINTENANCE & INTEGRITY:"
  echo "  # Check for document type consistency issues"
  echo "  ./google-sync-cli.sh sources-google-integrity --verbose"
  echo ""
  echo "  # Check reprocessing status of expert documents"
  echo "  ./google-sync-cli.sh check-reprocessing-status --limit 200"
  echo ""
  echo "  # Find documents marked as needs_reprocessing with unsupported types"
  echo "  ./google-sync-cli.sh needs-reprocessing --limit 200"
  echo ""
  echo "  # Re-classify documents that need reprocessing"
  echo "  ./google-sync-cli.sh reclassify-docs --dry-run"
  echo ""
  echo "  # Check for duplicate path_arrays (same file listed multiple times)"
  echo "  ./google-sync-cli.sh check-duplicates --by-path-array --limit 20 --verbose"
  echo ""
  echo "  # Check for duplicate drive_ids"
  echo "  ./google-sync-cli.sh check-duplicates --by-drive-id --verbose"
  echo ""
  echo "  # Check duplicates and verify if drive_ids still exist in Google Drive"
  echo "  ./google-sync-cli.sh check-duplicates --by-path-array --check-current --verbose"
  echo ""
  echo "  # Check duplicate drive_ids and show which ones can be safely deleted"
  echo "  ./google-sync-cli.sh check-duplicates --by-drive-id --check-current"
  echo ""
  echo "  # Check all types of duplicates (path_array, drive_id, and name)"
  echo "  ./google-sync-cli.sh check-duplicates --all --limit 10"
  echo ""
  echo "EXPERT DOCUMENTS MANAGEMENT:"
  echo "  # Sync sources_google files with expert_documents records"
  echo "  ./google-sync-cli.sh sync-expert-documents --dry-run --verbose"
  echo "" 
  echo "  # Create missing expert_documents with a limit of 100 records"
  echo "  ./google-sync-cli.sh sync-expert-documents --limit 100"
  echo ""
  echo "  # Find and report duplicate expert_documents"
  echo "  ./google-sync-cli.sh expert-documents-duplicates --verbose"
  echo ""
  echo "  # Clean up orphaned expert_documents"
  echo "  ./google-sync-cli.sh clean-orphaned-records --dry-run --verbose"
  echo ""
  echo "REPROCESSING MANAGEMENT:"
  echo "  # Mark specific sources for reprocessing (using UUIDs)"
  echo "  ./google-sync-cli.sh ids-need-reprocessing <uuid1>,<uuid2> --dry-run"
  echo ""
  echo "  # Find files with incorrect document types and mark for reprocessing"
  echo "  ./google-sync-cli.sh find-needs-reprocessing --limit 50"
  echo ""
  echo "  # Reset is_deleted flag for files that still exist in Google Drive"
  echo "  ./google-sync-cli.sh reset-deleted-files --dry-run"
  echo "  ./google-sync-cli.sh reset-deleted-files --verbose --limit 200"
  echo ""
  echo "AUDIO EXTRACTION:"
  echo "  # Find MP4 files missing M4A audio files"
  echo "  ./google-sync-cli.sh analyze-audio-gaps"
  echo ""
  echo "  # Save analysis to a file with a limit of 20 files"
  echo "  ./google-sync-cli.sh analyze-audio-gaps --output=audio-gaps.json --limit=20"
  echo ""
  echo "  # Generate batch processing scripts with local Google Drive path"
  echo "  ./google-sync-cli.sh generate-audio-batch --google-drive-path=\"/Users/username/Google Drive/My Drive\" --limit=10"
  echo ""
  echo "  # Upload extracted M4A files to Google Drive (dry run)"
  echo "  ./google-sync-cli.sh upload-audio-files --batch-id=audio-batch-2025-05-27T10-00-00 --dry-run"
  echo ""
  echo "  # Upload extracted M4A files from a specific directory"
  echo "  ./google-sync-cli.sh upload-audio-files --batch-dir=\"/Users/username/Documents/dhg-audio-processing/batch-123\""
  echo ""
  echo "STATISTICS:"
  echo "  # Populate sync statistics for the active filter profile"
  echo "  ./google-sync-cli.sh populate-statistics --verbose"
  echo ""
  echo "  # Populate statistics for a specific root drive ID"
  echo "  ./google-sync-cli.sh populate-statistics --root-drive-id \"1ABC123XYZ\" --verbose"
  echo ""
  echo "  # Preview statistics calculation without updating database"
  echo "  ./google-sync-cli.sh populate-statistics --dry-run --verbose"
  echo ""
  echo "ANALYTICS:"
  echo "  # Analyze Google sync command usage patterns"
  echo "  ./google-sync-cli.sh analyze-command-usage"
  exit 0
fi

if [ "$1" = "test-prompt-service" ]; then
  shift
  track_command "test-prompt-service" "ts-node $SCRIPT_DIR/test-prompt-service.ts $*"
  exit $?
fi

if [ "$1" = "force-classify-docs" ]; then
  shift
  track_command "force-classify-docs" "ts-node $SCRIPT_DIR/force-classify-docs.ts $*"
  exit $?
fi

if [ "$1" = "find-documents-with-content" ]; then
  shift
  track_command "find-documents-with-content" "ts-node $SCRIPT_DIR/find-documents-with-content.ts $*"
  exit $?
fi

if [ "$1" = "check-concepts" ]; then
  shift
  track_command "check-concepts" "ts-node $SCRIPT_DIR/check-concepts.ts $*"
  exit $?
fi

if [ "$1" = "update-document-type-id" ]; then
  shift
  track_command "update-document-type-id" "ts-node $SCRIPT_DIR/update-document-type-id.ts $*"
  exit $?
fi

if [ "$1" = "fix-orphaned-docx" ]; then
  shift
  track_command "fix-orphaned-docx" "ts-node $SCRIPT_DIR/fix-orphaned-docx.ts $*"
  exit $?
fi

if [ "$1" = "fix-mp4-status" ]; then
  shift
  track_command "fix-mp4-status" "ts-node $SCRIPT_DIR/fix-mp4-processing-status.ts $*"
  exit $?
fi

if [ "$1" = "ids-need-reprocessing" ]; then
  shift
  if [ -z "$1" ]; then
    echo "Error: Comma-separated list of IDs is required"
    echo "Usage: ./google-sync-cli.sh ids-need-reprocessing <comma-separated-ids> [options]"
    echo "Example: ./google-sync-cli.sh ids-need-reprocessing dd93874c-0fda-4edc-a4a9-d873da8e9421,cf21460f-159d-4992-a3a5-d7d7cbd00a1f"
    exit 1
  fi
  
  # Ensure IDs are properly formatted (remove any trailing commas, consolidate spaces)
  IDS=$(echo "$1" | sed 's/,\s*/,/g' | sed 's/,$//')
  shift
  
  # Form the new command with sanitized IDs and remaining args
  SANITIZED_COMMAND="ts-node $SCRIPT_DIR/reset-sources-processing-status.ts \"$IDS\""
  if [ "$#" -gt 0 ]; then
    SANITIZED_COMMAND="$SANITIZED_COMMAND $*"
  fi
  
  # Run the command
  track_command "ids-need-reprocessing" "$SANITIZED_COMMAND"
  RESULT_CODE=$?
  
  # If the command succeeded and was not in dry-run mode, verify the updated records
  if [ $RESULT_CODE -eq 0 ] && ! echo "$*" | grep -q "\--dry-run"; then
    echo ""
    echo "Verifying updates in the database..."
    VERIFY_COMMAND="ts-node -e \"
    const { SupabaseClientService } = require('$PROJECT_ROOT/packages/shared/services/supabase-client');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    async function verifyStatus() {
      const ids = '$IDS'.split(',').filter(id => id.trim().length > 0);
      
      const { data, error } = await supabase
        .from('expert_documents')
        .select('id, source_id, reprocessing_status, reprocessing_status_updated_at')
        .in('source_id', ids);
      
      if (error) {
        console.error('Error verifying updates:', error);
        return;
      }
      
      if (!data || data.length === 0) {
        console.log('❌ No expert documents found for the provided source IDs.');
        return;
      }
      
      console.log('✅ VERIFICATION RESULTS:');
      console.log('-------------------------------------------------------------------------------------------------');
      console.log('| Expert Document ID                     | Processing Status    | Last Updated                  |');
      console.log('-------------------------------------------------------------------------------------------------');
      
      for (const doc of data) {
        const status = doc.reprocessing_status || 'null';
        const updated = doc.reprocessing_status_updated_at ? 
          new Date(doc.reprocessing_status_updated_at).toLocaleString() : 'never';
        
        console.log('| ' + doc.id.padEnd(40) + ' | ' + status.padEnd(20) + ' | ' + updated.padEnd(30) + ' |');
      }
      
      console.log('-------------------------------------------------------------------------------------------------');
      console.log('NOTE: Updates are made to the expert_documents table, not the sources_google table.');
      console.log('      When checking in Supabase UI, look for these records in the expert_documents table.');
    }
    
    verifyStatus();
    \""
    
    eval "$VERIFY_COMMAND"
  fi
  
  exit $RESULT_CODE
fi

if [ "$1" = "check-document-summary" ]; then
  shift
  if [ -z "$1" ]; then
    echo "Error: Document ID is required"
    echo "Usage: ./google-sync-cli.sh check-document-summary <document-id>"
    exit 1
  fi
  DOCUMENT_ID="$1"
  track_command "check-document-summary" "ts-node -e \"require('$SCRIPT_DIR/reclassify-docs-helper').checkDocumentSummary('$DOCUMENT_ID')\""
  exit $?
fi

if [ "$1" = "list-unsupported-types" ]; then
  shift
  track_command "list-unsupported-types" "ts-node $SCRIPT_DIR/list-unsupported-document-types.ts $*"
  exit $?
fi

if [ "$1" = "needs-reprocessing" ]; then
  shift
  track_command "needs-reprocessing" "ts-node $SCRIPT_DIR/needs-reprocessing.ts $*"
  exit $?
fi

if [ "$1" = "find-needs-reprocessing" ]; then
  shift
  track_command "find-needs-reprocessing" "ts-node $SCRIPT_DIR/needs-reprocessing.ts $*"
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

if [ "$1" = "list-pipeline-status" ]; then
  shift
  track_command "list-pipeline-status" "ts-node $SCRIPT_DIR/list-pipeline-status.ts $*"
  exit $?
fi

if [ "$1" = "pipeline-status-summary" ]; then
  shift
  track_command "pipeline-status-summary" "ts-node $SCRIPT_DIR/pipeline-status-summary.ts $*"
  exit $?
fi

if [ "$1" = "update-processed-records" ]; then
  shift
  track_command "update-processed-records" "ts-node $SCRIPT_DIR/update-processed-records.ts $*"
  exit $?
fi

if [ "$1" = "process-unprocessed" ]; then
  shift
  echo "Processing unprocessed documents based on mime type (DOCX, PDF)..."
  echo "This command will extract content from unprocessed files according to mime_types_processing configuration."
  
  # Process arguments
  MIME_TYPE_ARG=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --mime-type|-m)
        MIME_TYPE_ARG="--mime-type \"$2\""
        shift 2
        ;;
      --mime-type=*|-m=*)
        MIME_TYPE_ARG="--mime-type \"${1#*=}\""
        shift
        ;;
      *)
        # Keep other arguments as is
        MIME_TYPE_ARG="$MIME_TYPE_ARG $1"
        shift
        ;;
    esac
  done
  
  track_command "process-unprocessed" "ts-node $SCRIPT_DIR/process-unprocessed.ts $MIME_TYPE_ARG"
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

if [ "$1" = "sources-google-integrity" ]; then
  shift
  track_command "sources-google-integrity" "ts-node $SCRIPT_DIR/sources-google-integrity.ts $*"
  exit $?
fi

if [ "$1" = "fix-bad-folders" ]; then
  shift
  track_command "fix-bad-folders" "ts-node $SCRIPT_DIR/fix-bad-folders.ts $*"
  exit $?
fi

if [ "$1" = "clear-reprocessing" ]; then
  shift
  track_command "clear-reprocessing" "ts-node $SCRIPT_DIR/clear-reprocessing.ts $*"
  exit $?
fi

if [ "$1" = "source-info" ]; then
  shift
  if [ -z "$1" ]; then
    echo "Error: Source ID or ID prefix is required"
    echo "Usage: ./google-sync-cli.sh source-info <source-id-or-prefix>"
    exit 1
  fi
  SOURCE_ID="$1"
  shift
  track_command "source-info" "ts-node $SCRIPT_DIR/source-info.ts $SOURCE_ID $*"
  exit $?
fi

if [ "$1" = "expert-documents-duplicates" ]; then
  shift
  track_command "expert-documents-duplicates" "ts-node $SCRIPT_DIR/expert-documents-duplicates.ts $*"
  exit $?
fi

if [ "$1" = "expert-documents-purge" ]; then
  shift
  track_command "expert-documents-purge" "ts-node $SCRIPT_DIR/expert-documents-purge.ts $*"
  exit $?
fi

if [ "$1" = "check-duplicate-prevention" ]; then
  shift
  track_command "check-duplicate-prevention" "ts-node $SCRIPT_DIR/check-duplicate-prevention.ts $*"
  exit $?
fi

if [ "$1" = "check-duplicates" ]; then
  shift
  track_command "check-duplicates" "ts-node $SCRIPT_DIR/check-duplicates.ts $*"
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
  
  # Check for special parameter --continue-from-error or --continue-update-only
  if [[ "$*" == *"--continue-from-error"* ]]; then
    echo "Special mode: Continuing from previous error (skipping sync phase)"
    track_command "sync-and-update-metadata-continue" "ts-node $SCRIPT_DIR/sync-and-update-metadata.ts $* --continue-from-error true"
  elif [[ "$*" == *"--continue-update-only"* ]]; then
    echo "Special mode: Continuing update phase only (skipping sync phase)"
    track_command "sync-and-update-metadata-update-only" "ts-node $SCRIPT_DIR/sync-and-update-metadata.ts $* --continue-update-only true"
  elif [[ "$*" == *"--new-folder-only"* ]]; then
    # New option to specifically check for new folders
    echo "Special mode: Checking for new folders and files only"
    track_command "sync-check-new-folders" "ts-node $SCRIPT_DIR/sync-and-update-metadata.ts $* --new-folder-only true"
  else
    track_command "sync-and-update-metadata" "ts-node $SCRIPT_DIR/sync-and-update-metadata.ts $*"
  fi
  exit $?
fi

# NEW MODULAR SYNC COMMANDS
if [ "$1" = "sync-all" ]; then
  shift
  track_command "sync-all" "ts-node $SCRIPT_DIR/sync-all.ts $*"
  exit $?
fi

if [ "$1" = "sync-files" ]; then
  shift
  track_command "sync-files" "ts-node $SCRIPT_DIR/sync-files.ts $*"
  exit $?
fi

if [ "$1" = "sync-history" ]; then
  shift
  track_command "sync-history" "ts-node $SCRIPT_DIR/view-sync-history.ts $*"
  exit $?
fi

if [ "$1" = "process-new-files-enhanced" ]; then
  shift
  track_command "process-new-files-enhanced" "ts-node $SCRIPT_DIR/process-new-files-enhanced.ts $*"
  exit $?
fi

if [ "$1" = "update-metadata" ]; then
  shift
  track_command "update-metadata" "ts-node $SCRIPT_DIR/update-metadata.ts $*"
  exit $?
fi

if [ "$1" = "verify-deletions" ]; then
  shift
  track_command "verify-deletions" "ts-node $SCRIPT_DIR/verify-deletions.ts $*"
  exit $?
fi

if [ "$1" = "fix-root-path-depth" ]; then
  shift
  track_command "fix-root-path-depth" "ts-node $SCRIPT_DIR/fix-root-path-depth.ts $*"
  exit $?
fi

# Add a specific command to look for a folder by name
if [ "$1" = "find-folder" ]; then
  shift
  if [ -z "$1" ]; then
    echo "Error: Folder name is required"
    echo "Usage: ./google-sync-cli.sh find-folder <folder-name>"
    exit 1
  fi
  FOLDER_NAME="$1"
  shift
  track_command "find-folder" "ts-node $SCRIPT_DIR/find-folder.ts \"$FOLDER_NAME\" $*"
  exit $?
fi

# Track commands that directly use index.ts with proper command name
if [ "$1" = "sync-and-update-metadata" ]; then
  shift
  track_command "sync-and-update-metadata" "ts-node $SCRIPT_DIR/index.ts sync-and-update-metadata $*"
  exit $?
fi

# Add the sync-expert-documents command
if [ "$1" = "sync-expert-documents" ]; then
  shift
  track_command "sync-expert-documents" "ts-node $SCRIPT_DIR/sync-expert-documents.ts $*"
  exit $?
fi

# Run the TypeScript file with ts-node - capture command from args
COMMAND="${1:-main}"
track_command "$COMMAND" "ts-node $SCRIPT_DIR/index.ts $*"
# Add the purge-orphaned-with-presentations command
if [ "$1" = "purge-orphaned-with-presentations" ]; then
  shift
  track_command "purge-orphaned-with-presentations" "ts-node $SCRIPT_DIR/purge-orphaned-with-presentations.ts $*"
  exit $?
fi

# Add the clean-orphaned-records command
if [ "$1" = "clean-orphaned-records" ]; then
  shift
  track_command "clean-orphaned-records" "$SCRIPT_DIR/clean-orphaned-records.sh $*"
  exit $?
fi

# Add the list-main-video-folders command
if [ "$1" = "list-main-video-folders" ]; then
  shift
  track_command "list-main-video-folders" "ts-node $SCRIPT_DIR/list-main-video-folders.ts $*"
  exit $?
fi

# Add the list-main-video-folders-tree command
if [ "$1" = "list-main-video-folders-tree" ]; then
  shift
  track_command "list-main-video-folders-tree" "ts-node $SCRIPT_DIR/list-main-video-folders-tree.ts $*"
  exit $?
fi

if [ "$1" = "check-deleted-files" ]; then
  shift
  track_command "check-deleted-files" "ts-node $SCRIPT_DIR/check-deleted-files.ts $*"
  exit $?
fi

if [ "$1" = "reset-deleted-files" ]; then
  shift
  track_command "reset-deleted-files" "ts-node $SCRIPT_DIR/reset-deleted-files.ts $*"
  exit $?
fi

if [ "$1" = "check-document-ids" ]; then
  shift
  track_command "check-document-ids" "ts-node $SCRIPT_DIR/check-document-ids.ts $*"
  exit $?
fi

if [ "$1" = "update-main-video-id" ]; then
  shift
  
  # Process arguments to handle --folder-name and --video-name
  FOLDER_NAME=""
  VIDEO_NAME=""
  OTHER_ARGS=""
  
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --folder-name=*)
        FOLDER_NAME="${1#*=}"
        shift
        ;;
      --folder-name)
        FOLDER_NAME="$2"
        shift 2
        ;;
      --video-name=*)
        VIDEO_NAME="${1#*=}"
        shift
        ;;
      --video-name)
        VIDEO_NAME="$2"
        shift 2
        ;;
      *)
        OTHER_ARGS="$OTHER_ARGS $1"
        shift
        ;;
    esac
  done
  
  # Validate required parameters
  if [ -z "$FOLDER_NAME" ]; then
    echo "Error: --folder-name parameter is required"
    echo "Usage: ./google-sync-cli.sh update-main-video-id --folder-name <folder-name> --video-name <video-name> [options]"
    exit 1
  fi
  
  if [ -z "$VIDEO_NAME" ]; then
    echo "Error: --video-name parameter is required"
    echo "Usage: ./google-sync-cli.sh update-main-video-id --folder-name <folder-name> --video-name <video-name> [options]"
    exit 1
  fi
  
  # Form the command with proper parameter handling
  track_command "update-main-video-id" "ts-node $SCRIPT_DIR/update-main-video-id.ts --folder-name \"$FOLDER_NAME\" --video-name \"$VIDEO_NAME\" $OTHER_ARGS"
  exit $?
fi

if [ "$1" = "renamed-file" ]; then
  shift
  
  # Process arguments to handle --source-id and --new-name
  SOURCE_ID=""
  NEW_NAME=""
  OTHER_ARGS=""
  
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --source-id=*)
        SOURCE_ID="${1#*=}"
        shift
        ;;
      --source-id)
        SOURCE_ID="$2"
        shift 2
        ;;
      --new-name=*)
        NEW_NAME="${1#*=}"
        shift
        ;;
      --new-name)
        NEW_NAME="$2"
        shift 2
        ;;
      *)
        OTHER_ARGS="$OTHER_ARGS $1"
        shift
        ;;
    esac
  done
  
  # Validate required parameters
  if [ -z "$SOURCE_ID" ]; then
    echo "Error: --source-id parameter is required"
    echo "Usage: ./google-sync-cli.sh renamed-file --source-id <source-id> --new-name <new-name> [options]"
    exit 1
  fi
  
  if [ -z "$NEW_NAME" ]; then
    echo "Error: --new-name parameter is required"
    echo "Usage: ./google-sync-cli.sh renamed-file --source-id <source-id> --new-name <new-name> [options]"
    exit 1
  fi
  
  # Form the command with proper parameter handling
  track_command "renamed-file" "ts-node $SCRIPT_DIR/renamed-file.ts --source-id \"$SOURCE_ID\" --new-name \"$NEW_NAME\" $OTHER_ARGS"
  exit $?
fi

if [ "$1" = "mark-pdfs" ] || [ "$1" = "mark-pdfs-for-processing" ]; then
  shift
  track_command "mark-pdfs-for-processing" "ts-node $SCRIPT_DIR/reset-and-mark-for-processing.ts $*"
  exit $?
fi

if [ "$1" = "direct-classify-pdfs" ]; then
  shift
  track_command "direct-classify-pdfs" "ts-node $SCRIPT_DIR/direct-classify-pdfs.ts $*"
  exit $?
fi

if [ "$1" = "fix-classify-pdfs" ]; then
  shift
  track_command "fix-classify-pdfs" "ts-node $SCRIPT_DIR/fix-classify-pdfs.ts $*"
  exit $?
fi

if [ "$1" = "update-pipeline-status" ]; then
  shift
  track_command "update-pipeline-status" "ts-node $SCRIPT_DIR/update-pipeline-status.ts $*"
  exit $?
fi

if [ "$1" = "classify-unprocessed-with-content" ]; then
  shift
  track_command "classify-unprocessed-with-content" "ts-node $SCRIPT_DIR/classify-unprocessed-with-content.ts $*"
  exit $?
fi

if [ "$1" = "get-current-drive-id" ]; then
  shift
  track_command "get-current-drive-id" "ts-node $SCRIPT_DIR/get-current-drive-id.ts $*"
  exit $?
fi

if [ "$1" = "analyze-command-usage" ]; then
  shift
  track_command "analyze-command-usage" "ts-node $SCRIPT_DIR/analyze-command-usage.ts $*"
  exit $?
fi

if [ "$1" = "analyze-unprocessed-files" ]; then
  shift
  track_command "analyze-unprocessed-files" "ts-node $SCRIPT_DIR/analyze-unprocessed-files.ts $*"
  exit $?
fi

if [ "$1" = "assign-main-video-id" ]; then
  shift
  track_command "assign-main-video-id" "ts-node $SCRIPT_DIR/assign-main-video-id.ts $*"
  exit $?
fi

if [ "$1" = "refresh-main-video-id" ]; then
  shift
  track_command "refresh-main-video-id" "ts-node $SCRIPT_DIR/refresh-main-video-id.ts $*"
  exit $?
fi

if [ "$1" = "report-folder-video-assignments" ]; then
  shift
  track_command "report-folder-video-assignments" "ts-node $SCRIPT_DIR/report-folder-video-assignments.ts $*"
  exit $?
fi

# AUDIO EXTRACTION COMMANDS
if [ "$1" = "analyze-audio-gaps" ]; then
  shift
  track_command "analyze-audio-gaps" "ts-node $SCRIPT_DIR/analyze-audio-gaps.ts $*"
  exit $?
fi

if [ "$1" = "generate-audio-batch" ]; then
  shift
  track_command "generate-audio-batch" "ts-node $SCRIPT_DIR/generate-audio-batch.ts $*"
  exit $?
fi

if [ "$1" = "upload-audio-files" ]; then
  shift
  track_command "upload-audio-files" "ts-node $SCRIPT_DIR/upload-audio-files.ts $*"
  exit $?
fi

# STATISTICS COMMANDS
if [ "$1" = "populate-statistics" ]; then
  shift
  track_command "populate-statistics" "ts-node $SCRIPT_DIR/populate-sync-statistics.ts $*"
  exit $?
fi

if [ "$1" = "show-statistics" ]; then
  shift
  track_command "show-statistics" "ts-node $SCRIPT_DIR/show-statistics.ts $*"
  exit $?
fi

# FILTER COMMANDS
if [ "$1" = "create-sample-filters" ]; then
  shift
  track_command "create-sample-filters" "ts-node $SCRIPT_DIR/create-sample-filters.ts $*"
  exit $?
fi
