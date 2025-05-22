#!/bin/bash
# Master script for the presentations CLI with detailed help

# Set script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Export Supabase environment variables
ENV_DEV_FILE="${ROOT_DIR}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
else
  echo "Warning: .env.development file not found at $ENV_DEV_FILE"
fi

# Function to execute a command with tracking
track_command() {
  local pipeline_name="presentations"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # For commands that need special handling to ensure output is visible
  if [[ "$command_name" == "check-video-consistency" || "$command_name" == "find-missing-presentations" ]]; then
    # Execute with full output passthrough
    echo "Running $command_name command with direct output..."
    if [ -f "$TRACKER_TS" ]; then
      eval "npx ts-node \"$TRACKER_TS\" \"$pipeline_name\" \"$command_name\" \"$full_command\"" 2>&1
      return $?
    else
      eval "$full_command" 2>&1
      return $?
    fi
  fi
  
  # Regular command handling for other commands
  # Check if we have a TS tracking wrapper
  if [ -f "$TRACKER_TS" ]; then
    # Use 2>&1 to ensure both stdout and stderr are passed through
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command" 2>&1
  else
    # Fallback to direct execution without tracking
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Function to display help
function display_help() {
  echo -e "\033[1mPresentations Pipeline CLI\033[0m"
  echo -e "========================="
  echo ""
  echo -e "The presentations pipeline provides commands for managing expert presentations, including"
  echo -e "generating AI summaries from transcriptions, creating expert profiles, and managing assets."
  echo ""
  
  # Command Groups Section
  echo -e "\033[1mCOMMAND GROUPS:\033[0m"
  echo -e "  \033[1mAI Processing:\033[0m"
  echo -e "    generate-summary           Generate AI summaries from transcripts using Claude"
  echo -e "    generate-expert-bio        Generate AI expert bio/profile from presentation content"
  echo -e "    process-mp4-files          Process MP4 files and generate AI summaries"
  echo -e "    scan-for-ai-summaries      Scan for documents needing AI summarization"
  echo -e "    test-process-document      Test processing a specific document with detailed logs"
  echo ""
  
  echo -e "  \033[1mAsset Management:\033[0m"
  echo -e "    create-presentation-assets Create assets for files in presentations' folders"
  echo -e "    create-missing-assets      Create missing presentation_asset records"
  echo -e "    add-specific-files         Add specific files from sources_google to presentations"
  echo -e "    presentation-asset-bio     Match non-transcript documents with presentations"
  echo ""
  
  echo -e "  \033[1mPresentations Management:\033[0m"
  echo -e "    create-presentations-from-mp4  Create presentation records for MP4 files"
  echo -e "    create-from-expert-docs    Create presentations from expert documents"
  echo -e "    repair-presentations       Repair presentations with missing main_video_id"
  echo -e "    fix-mismatched-videos      Fix video_source_id in presentations to match main_video_id in folders"
  echo -e "    update-root-drive-id       Fill in the root_drive_id for all records"
  echo ""
  
  echo -e "  \033[1mStatus & Reports:\033[0m"
  echo -e "    review-presentations       Review presentation status and content"
  echo -e "    export-status              Export presentation status to markdown"
  echo -e "    show-missing-content       Show presentations needing reprocessing"
  echo -e "    show-ai-summary-status     Show AI summary status in markdown table"
  echo -e "    check-presentation-titles  Check titles against processed content"
  echo -e "    check-professional-docs    Check for professional documents with presentations"
  echo -e "    find-missing-presentations Find top-level folders with videos that need presentations created"
  echo -e "    create-missing-presentations Create presentations for folders that don't have them yet"
  echo -e "    find-duplicate-folder-names Find folders with duplicate names and list their presentations and videos"
  echo -e "      -d, --path-depth <number>  Folder depth to check (default: 0)"
  echo -e "      -o, --output-file <path>   Output file path for the results"
  echo -e "      -v, --verbose              Show detailed logs during processing"
  echo -e "    repair-mismatched-video-ids Find presentations with mismatched video IDs compared to their high-level folders"
  echo -e "      --folder-depth <number>    Folder depth to check (default: 0)"
  echo -e "      -v, --verbose              Show detailed logs during processing"
  echo ""
  
  echo -e "  \033[1mSystem:\033[0m"
  echo -e "    health-check               Check health of pipeline infrastructure"
  echo -e "      --skip-database          Skip database connection check"
  echo -e "      --skip-presentations     Skip presentations table check" 
  echo -e "      --skip-claude            Skip Claude service check"
  echo -e "      --verbose, -v            Show verbose output"
  echo ""
  
  # Common Options Section
  echo -e "\033[1mCOMMON OPTIONS:\033[0m"
  echo -e "  --dry-run                    Preview mode without making changes"
  echo -e "  --force, -f                  Force operation even if conditions would prevent it"
  echo -e "  --limit, -l <number>         Limit number of items to process"
  echo -e "  --verbose, -v                Show detailed logs during processing"
  echo -e "  --output, -o <path>          Specify output file for results"
  echo ""
  
  # Key Commands Section - Only show the most important commands
  echo -e "\033[1mKEY COMMANDS:\033[0m"
  
  echo -e "\033[1m1. generate-summary\033[0m - Generate AI summaries from transcripts"
  echo -e "   Usage: presentations-cli generate-summary [options]"
  echo -e "   Options:"
  echo -e "     -p, --presentation-id <id>   Process a specific presentation"
  echo -e "     -d, --document-id <id>       Process a specific expert document"
  echo -e "     -e, --expert-id <id>         Process presentations for a specific expert"
  echo -e "     --format <format>            Summary style: concise|detailed|bullet-points"
  echo -e "     --status <status>            Filter by status (e.g., 'pending')"
  echo -e "     --dry-run                    Preview without saving to database"
  echo ""
  
  echo -e "\033[1m2. process-mp4-files\033[0m - Process MP4 files and generate AI summaries"
  echo -e "   Usage: presentations-cli process-mp4-files [options]"
  echo -e "   Options:"
  echo -e "     -d, --document-id <id>       Process a specific document ID"
  echo -e "     -l, --limit <limit>          Maximum files to process (default: 5)"
  echo -e "     -b, --batch-size <size>      Files per batch (default: 3)"
  echo -e "     -c, --concurrency <num>      Files to process concurrently (default: 1)"
  echo -e "     -f, --force                  Reprocess already processed documents"
  echo -e "     --dry-run                    Preview without saving"
  echo ""
  
  echo -e "\033[1m3. create-presentations-from-mp4\033[0m - Create presentation records for MP4 files"
  echo -e "   Usage: presentations-cli create-presentations-from-mp4 [options]"
  echo -e "   Options:"
  echo -e "     --dry-run                   Preview changes (default)"
  echo -e "     --no-dry-run                Actually create the presentations"
  echo -e "     -l, --limit <number>        Limit the number of MP4 files to process (default: 150)"
  echo -e "     -v, --verbose               Show detailed logs"
  echo -e "     --fix-missing-folders       Fix presentations with missing folder IDs"
  echo ""
  
  echo -e "\033[1m4. scan-for-ai-summaries\033[0m - Scan for documents needing AI processing"
  echo -e "   Usage: presentations-cli scan-for-ai-summaries [options]"
  echo -e "   Options:"
  echo -e "     --update                     Set missing AI status to 'pending'"
  echo -e "     --update-dhg                 Update DHG documents to 'pending'"
  echo -e "     --folder-id <id>             Filter by folder ID"
  echo ""
  
  echo -e "\033[1m5. create-presentation-assets\033[0m - Create assets for presentations"
  echo -e "   Usage: presentations-cli create-presentation-assets [options]"
  echo -e "   Options:"
  echo -e "     -p, --presentation-id <id>   Process specific presentation"
  echo -e "     --dry-run                    Preview changes"
  echo -e "     --skip-existing=false        Process all presentations"
  echo ""
  
  echo -e "\033[1mENVIRONMENT REQUIREMENTS:\033[0m"
  echo -e "  CLAUDE_API_KEY or ANTHROPIC_API_KEY    Required for AI generation"
  echo -e "  SUPABASE_URL                           Required for database access"
  echo -e "  SUPABASE_KEY                           Required for database access"
  echo ""
  
  echo -e "\033[1mEXAMPLES:\033[0m"
  echo -e "  # Generate detailed summaries for pending documents"
  echo -e "  presentations-cli generate-summary --status pending --format detailed --limit 10"
  echo ""
  echo -e "  # Process MP4 files and generate AI summaries"
  echo -e "  presentations-cli process-mp4-files --limit 10 --batch-size 5"
  echo ""
  echo -e "  # Create presentations from MP4 files (default limit is 150)"
  echo -e "  presentations-cli create-presentations-from-mp4 --no-dry-run -v"
  echo -e "  # Process more files by setting a higher limit"
  echo -e "  presentations-cli create-presentations-from-mp4 --no-dry-run -v --limit 300"
  echo ""
  echo -e "  # Create assets for all presentations"
  echo -e "  presentations-cli create-presentation-assets"
  echo ""
  echo -e "  # Check health of the presentations pipeline"
  echo -e "  presentations-cli health-check"
  echo ""
  echo -e "  # Find and fix presentations with mismatched video IDs"
  echo -e "  presentations-cli fix-mismatched-videos"
  echo ""
  
  echo -e "For detailed help on a specific command, run:"
  echo -e "  presentations-cli [command] --help"
}

# Check for help flag
if [[ "$1" == "--help" || "$1" == "-h" || "$#" -eq 0 ]]; then
  # Display help directly
  display_help
  
  # Use the proper tracking mechanism for help
  if [ -f "$TRACKER_TS" ]; then
    # Use the tracker script in the background to avoid hanging
    npx ts-node "$TRACKER_TS" "presentations" "--help" "Display help for presentations pipeline" &>/dev/null &
  fi
  exit 0
fi

# Check for and fix triple dash issues directly
if [[ "$1" == "generate-summary" ]]; then
  for arg in "$@"; do
    if [[ "$arg" == "---dry-run" ]]; then
      echo "WARNING: Detected '---dry-run' instead of '--dry-run', fixing automatically"
      # Call with fixed args
      fixed_args=("$@")
      for i in "${!fixed_args[@]}"; do
        if [[ "${fixed_args[$i]}" == "---dry-run" ]]; then
          fixed_args[$i]="--dry-run"
        fi
      done
      
      # Execute with fixed args
      track_command "generate-summary" "ts-node $SCRIPT_DIR/index.ts ${fixed_args[*]}"
      exit $?
    fi
  done
  
  # Add explicit command for generate-summary
  track_command "generate-summary" "ts-node $SCRIPT_DIR/index.ts generate-summary ${@:2}"
  exit $?
fi

# Handle health-check command directly
if [[ "$1" == "health-check" ]]; then
  track_command "health-check" "ts-node $SCRIPT_DIR/index.ts health-check ${@:2}"
  exit $?
fi

# Handle specific commands directly to ensure proper tracking
if [[ "$1" == "create-presentations-from-mp4" ]]; then
  track_command "create-presentations-from-mp4" "ts-node $SCRIPT_DIR/index.ts create-presentations-from-mp4 ${@:2}"
  exit $?
fi

if [[ "$1" == "scan-for-ai-summaries" ]]; then
  track_command "scan-for-ai-summaries" "ts-node $SCRIPT_DIR/index.ts scan-for-ai-summaries ${@:2}"
  exit $?
fi

if [[ "$1" == "show-ai-summary-status" ]]; then
  track_command "show-ai-summary-status" "ts-node $SCRIPT_DIR/index.ts show-ai-summary-status ${@:2}"
  exit $?
fi

if [[ "$1" == "show-missing-content" ]]; then
  track_command "show-missing-content" "ts-node $SCRIPT_DIR/index.ts show-missing-content ${@:2}"
  exit $?
fi

if [[ "$1" == "presentation-asset-bio" ]]; then
  track_command "presentation-asset-bio" "ts-node $SCRIPT_DIR/index.ts presentation-asset-bio ${@:2}"
  exit $?
fi

if [[ "$1" == "add-specific-files" ]]; then
  track_command "add-specific-files" "ts-node $SCRIPT_DIR/index.ts add-specific-files ${@:2}"
  exit $?
fi

if [[ "$1" == "create-presentation-assets" ]]; then
  track_command "create-presentation-assets" "ts-node $SCRIPT_DIR/index.ts create-presentation-assets ${@:2}"
  exit $?
fi

if [[ "$1" == "update-root-drive-id" ]]; then
  track_command "update-root-drive-id" "ts-node $SCRIPT_DIR/index.ts update-root-drive-id ${@:2}"
  exit $?
fi

if [[ "$1" == "create-from-expert-docs" ]]; then
  track_command "create-from-expert-docs" "ts-node $SCRIPT_DIR/index.ts create-from-expert-docs ${@:2}"
  exit $?
fi

if [[ "$1" == "repair-presentations" ]]; then
  track_command "repair-presentations" "ts-node $SCRIPT_DIR/index.ts repair-presentations ${@:2}"
  exit $?
fi

if [[ "$1" == "export-status" ]]; then
  track_command "export-status" "ts-node $SCRIPT_DIR/index.ts export-status ${@:2}"
  exit $?
fi

if [[ "$1" == "create-missing-assets" ]]; then
  track_command "create-missing-assets" "ts-node $SCRIPT_DIR/index.ts create-missing-assets ${@:2}"
  exit $?
fi

if [[ "$1" == "check-professional-docs" ]]; then
  track_command "check-professional-docs" "ts-node $SCRIPT_DIR/index.ts check-professional-docs ${@:2}"
  exit $?
fi

if [[ "$1" == "generate-expert-bio" ]]; then
  track_command "generate-expert-bio" "ts-node $SCRIPT_DIR/index.ts generate-expert-bio ${@:2}"
  exit $?
fi

if [[ "$1" == "review-presentations" ]]; then
  # Check for direct execution flag
  if [[ "$2" == "--direct" ]]; then
    echo "Executing review-presentations command directly..."
    ts-node $SCRIPT_DIR/commands/review-presentations.ts ${@:3}
    exit $?
  else
    track_command "review-presentations" "ts-node $SCRIPT_DIR/commands/review-presentations.ts ${@:2}"
    exit $?
  fi
fi

if [[ "$1" == "check-presentation-titles" ]]; then
  track_command "check-presentation-titles" "ts-node $SCRIPT_DIR/index.ts check-presentation-titles ${@:2}"
  exit $?
fi

# Archived check-video-consistency command as it didn't work correctly
# Archived on $(date +%Y-%m-%d) to .archived_scripts/check-video-consistency.$(date +%Y%m%d).ts

if [[ "$1" == "repair-mismatched-video-ids" ]]; then
  # Run the direct script instead of going through index.ts
  track_command "repair-mismatched-video-ids" "ts-node $SCRIPT_DIR/test-repair-mismatched.ts ${@:2}"
  exit $?
fi

if [[ "$1" == "fix-mismatched-videos" ]]; then
  # Direct script to fix mismatched video IDs
  track_command "fix-mismatched-videos" "ts-node $SCRIPT_DIR/repair-mismatched-fix.ts ${@:2}"
  exit $?
fi

if [[ "$1" == "process-mp4-files" ]]; then
  track_command "process-mp4-files" "ts-node $SCRIPT_DIR/index.ts process-mp4-files ${@:2}"
  exit $?
fi

if [[ "$1" == "test-process-document" ]]; then
  track_command "test-process-document" "ts-node $SCRIPT_DIR/index.ts test-process-document ${@:2}"
  exit $?
fi

if [[ "$1" == "find-missing-presentations" ]]; then
  # Add confirmation step for create-missing without dry-run
  if [[ "${@:2}" == *"--create-missing"* && "${@:2}" != *"--dry-run"* && "${@:2}" != *"--dry-run=true"* ]]; then
    echo -e "\n⚠️ CAUTION: You are about to create presentations in the database."
    read -p "Are you sure you want to proceed? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo "Operation canceled."
      exit 0
    fi
    echo "Proceeding with creating presentations..."
  fi
  
  # Run directly from command file, skipping the index.ts routing
  track_command "find-missing-presentations" "ts-node $SCRIPT_DIR/commands/find-missing-presentations.ts ${@:2}"
  exit $?
fi

# Create one presentation command (helper command for testing)
if [[ "$1" == "create-one-presentation" ]]; then
  echo "Creating a single presentation for a specific folder..."
  
  # Add confirmation if not in dry-run mode
  if [[ "$*" != *"--dry-run"* ]]; then
    echo -e "\n⚠️ CAUTION: You are about to create a presentation in the database."
    read -p "Are you sure you want to proceed? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo "Operation canceled."
      exit 0
    fi
    echo "Proceeding with creating presentation..."
  fi
  
  track_command "create-one-presentation" "ts-node $SCRIPT_DIR/test-create-one-presentation.ts ${@:2}"
  exit $?
fi

# Create missing presentations command
if [[ "$1" == "create-missing-presentations" ]]; then
  # Add confirmation if not in dry-run mode
  if [[ "$*" != *"--dry-run"* ]]; then
    echo -e "\n⚠️ CAUTION: You are about to create presentations in the database."
    read -p "Are you sure you want to proceed? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo "Operation canceled."
      exit 0
    fi
  fi
  
  # Execute the command
  track_command "create-missing-presentations" "ts-node $SCRIPT_DIR/commands/create-missing-presentations.ts ${@:2}"
  exit $?
fi

# Add find-duplicate-folder-names command
if [[ "$1" == "find-duplicate-folder-names" ]]; then
  track_command "find-duplicate-folder-names" "ts-node $SCRIPT_DIR/commands/find-duplicate-folder-names.ts ${@:2}"
  exit $?
fi

# Otherwise, execute the presentations CLI normally with tracking
# Use the first argument as the command name or default to "main"
COMMAND="${1:-main}"
track_command "$COMMAND" "ts-node $SCRIPT_DIR/index.ts $*"