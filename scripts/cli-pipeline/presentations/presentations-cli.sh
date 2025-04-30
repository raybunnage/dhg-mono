#!/bin/bash
# Master script for the presentations CLI with detailed help

# Set script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="presentations"
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

# Function to display help
function display_help() {
  echo -e "\033[1mPresentations Pipeline CLI\033[0m"
  echo -e "========================="
  echo ""
  echo -e "The presentations pipeline provides commands for managing expert presentations, including generating"
  echo -e "AI summaries from transcriptions, creating expert profiles, and managing presentation assets."
  echo ""
  echo -e "\033[1mAvailable Commands:\033[0m"
  echo -e "  review-presentations       Review presentation status, document types, and content"
  echo -e "  generate-summary           Generate AI summaries from presentation transcripts using Claude"
  echo -e "  generate-expert-bio        Generate AI expert bio/profile from presentation content"
  echo -e "  check-professional-docs    Check for professional documents associated with presentations"
  echo -e "  create-missing-assets      Create missing presentation_asset records"
  echo -e "  export-status              Export presentation transcription status to markdown"
  echo -e "  repair-presentations       Repair presentations with missing main_video_id"
  echo -e "  create-from-expert-docs    Create presentations from expert documents"
  echo -e "  create-presentations-from-mp4   Create presentation records for MP4 files in sources_google"
  echo -e "  scan-for-ai-summaries      Scan for documents that need AI summarization"
  echo -e "  show-missing-content       Show presentations without content that need reprocessing"
  echo -e "  show-ai-summary-status     Show AI summary status for expert documents in markdown table"
  echo -e "  presentation-asset-bio     Match non-transcript expert documents with presentations and create assets"
  echo -e "  add-specific-files         Add specific files from sources_google to presentations"
  echo -e "  update-root-drive-id       Fill in the root_drive_id for all records with the specified value"
  echo -e "  create-presentation-assets Create presentation_assets for files in presentations' high-level folders"
  echo -e "  check-presentation-titles  Check presentation titles against processed content"
  echo -e "  health-check               Check the health of presentations pipeline infrastructure"
  echo -e "    --skip-database          Skip database connection check"
  echo -e "    --skip-presentations     Skip presentations table check" 
  echo -e "    --skip-claude            Skip Claude service check"
  echo -e "    --verbose, -v            Show verbose output"
  echo ""
  echo -e "\033[1mDetailed Command: generate-summary\033[0m"
  echo -e "  Usage: presentations-cli generate-summary [options]"
  echo ""
  echo -e "  Options:"
  echo -e "    -p, --presentation-id <id>   Process a specific presentation ID"
  echo -e "    -d, --document-id <id>       Expert document ID to directly process (bypasses presentation lookup)"
  echo -e "    -e, --expert-id <id>         Process presentations for a specific expert"
  echo -e "    -f, --force                  Regenerate summaries even if they exist"
  echo -e "    --dry-run                    Preview mode: generate but don't save to database"
  echo -e "    --clear-existing             Clear existing processed_content before generating new summary"
  echo -e "    -l, --limit <number>         Max presentations to process (default: 5)"
  echo -e "    -o, --output <path>          Output file for JSON results"
  echo -e "    --format <format>            Summary style:"
  echo -e "                                   concise: 2-3 paragraph summary (default)"
  echo -e "                                   detailed: 5-7 paragraph thorough summary"
  echo -e "                                   bullet-points: 5-10 key bullet points"
  echo -e "    --status <status>            Filter by presentation status (e.g., 'pending')"
  echo -e ""
  echo -e "  \033[1mNOTE:\033[0m The summary output is now in JSON format with structured fields like"
  echo -e "  speakerProfile, presentationEssence, keyTakeaways, memorableQuotes, discussionHighlights,"
  echo -e "  whyWatch, and a text summary field."
  echo ""
  echo -e "  \033[1mRequired Environment Variables:\033[0m"
  echo -e "    CLAUDE_API_KEY or ANTHROPIC_API_KEY    Required for AI summary generation"
  echo -e "    SUPABASE_KEY                           Required for database access"
  echo -e "    SUPABASE_URL                           Required for database access"
  echo ""
  echo -e "\033[1mDetailed Command: scan-for-ai-summaries\033[0m"
  echo -e "  Usage: presentations-cli scan-for-ai-summaries [options]"
  echo ""
  echo -e "  Options:"
  echo -e "    -l, --limit <number>         Limit the number of documents to display (default: 50)"
  echo -e "    --update                     Update documents with missing AI status to 'pending'"
  echo -e "    --update-dhg                 Update DHG documents matching SQL criteria to 'pending' status"
  echo -e "    --reset                      Reset all documents with raw content to 'pending' status"
  echo -e "    --reset-to-null              Reset all documents with raw content to NULL status (recommended)"
  echo -e "    --folder-id <id>             Filter by specific folder ID (default: Dynamic Healing Discussion Group)"
  
  echo ""
  echo -e "\033[1mDetailed Command: show-ai-summary-status\033[0m"
  echo -e "  Usage: presentations-cli show-ai-summary-status [options]"
  echo ""
  echo -e "  Options:"
  echo -e "    -l, --limit <number>         Limit the number of documents to check (default: 125)"
  echo -e "    --folder-id <id>             Filter by folder ID (default: Dynamic Healing Discussion Group)"
  echo -e "    -o, --output-file <path>     Path to write markdown report to (default: docs/cli-pipeline/ai_summary_status.md)"
  echo ""
  
  echo -e "\033[1mDetailed Command: create-presentations-from-mp4\033[0m"
  echo -e "  Usage: presentations-cli create-presentations-from-mp4 [options]"
  echo ""
  echo -e "  Description:"
  echo -e "    Creates presentation records for MP4 files in the sources_google table. It will:"
  echo -e "    - Find all MP4 files without presentation records"
  echo -e "    - Create presentations with basic data from sources_google"
  echo -e "    - Link presentations to experts using high-level folder information"
  echo -e "    - Set duration_seconds based on file size if possible"
  echo -e "    - Use titles from expert_documents when available"
  echo ""
  echo -e "  Options:"
  echo -e "    --dry-run                   Preview what would be created without making changes (default: true)"
  echo -e "    --no-dry-run                Actually create the presentations"
  echo -e "    -l, --limit <number>        Limit the number of MP4 files to process (default: 100)"
  echo -e "    -v, --verbose               Show detailed logs during processing"
  echo -e "    --fix-missing-folders       Fix presentations with missing high-level folder source IDs"
  echo ""
  echo -e "\033[1mDetailed Command: presentation-asset-bio\033[0m"
  echo -e "  Usage: presentations-cli presentation-asset-bio [options]"
  echo ""
  echo -e "  Description:"
  echo -e "    Match non-transcript expert documents (like expert bios, announcements, CV) with presentations"
  echo -e "    and create presentation assets. This command helps connect supporting documents with their"
  echo -e "    related presentations based on folder structure and naming conventions."
  echo ""
  echo -e "  Options:"
  echo -e "    -d, --dry-run                Preview matches without creating presentation assets"
  echo -e "    -l, --limit <number>         Limit the number of documents to process (default: 100)"
  echo -e "    -f, --folder-id <id>         Filter by specific folder ID (default: Dynamic Healing Discussion Group)"
  echo -e "    -c, --confirm-all            Automatically confirm all matches without prompting"
  echo -e "    -t, --document-type <type>   Filter by specific document type (e.g., \"Presentation Announcement\")"
  echo -e "    -m, --min-confidence <level> Minimum confidence level for auto-confirmation (high, medium, low)"
  echo ""
  echo -e "\033[1mExamples:\033[0m"
  echo -e "  # Generate summaries with detailed format"
  echo -e "  presentations-cli generate-summary --format detailed"
  echo ""
  echo -e "  # Process a specific expert document directly (useful for fixing misaligned summaries)"
  echo -e "  presentations-cli generate-summary --document-id abc123-def456 --force"
  echo ""
  echo -e "  # Process a specific expert document and clear existing content first"
  echo -e "  presentations-cli generate-summary --document-id abc123-def456 --clear-existing"
  echo ""
  echo -e "  # Match non-transcript documents with presentations"
  echo -e "  presentations-cli presentation-asset-bio --dry-run"
  echo ""
  echo -e "  # Create presentation assets for matched documents with high confidence"
  echo -e "  presentations-cli presentation-asset-bio --confirm-all --min-confidence high"
  echo ""
  echo -e "  # Preview a summary for specific presentation without saving"
  echo -e "  presentations-cli generate-summary --presentation-id 1234abcd --dry-run"
  echo -e "  # Note: Make sure to use exactly two dashes for --dry-run (not three dashes)"
  echo ""
  echo -e "  # Process summaries for a specific expert"
  echo -e "  presentations-cli generate-summary --expert-id 5678efgh --limit 10"
  echo ""
  echo -e "  # Update root_drive_id for all presentations (display what would be updated)"
  echo -e "  presentations-cli update-root-drive-id --dry-run"
  echo ""
  echo -e "  # Actually update root_drive_id for all presentations"
  echo -e "  presentations-cli update-root-drive-id"
  echo ""
  echo -e "  # Preview assets that would be created for presentations"
  echo -e "  presentations-cli create-presentation-assets --dry-run"
  echo ""
  echo -e "  # Create assets for all presentations (without dry run)"
  echo -e "  presentations-cli create-presentation-assets"
  echo -e ""
  echo -e "  # Create assets for presentations that don't have any assets yet (default behavior)"
  echo -e "  presentations-cli create-presentation-assets"
  echo -e ""
  echo -e "  # Process all presentations, including those with existing assets"
  echo -e "  presentations-cli create-presentation-assets --skip-existing=false"
  echo ""
  echo -e "  # Preview presentations that would be created from MP4 files"
  echo -e "  presentations-cli create-presentations-from-mp4"
  echo ""
  echo -e "  # Create presentations from MP4 files with verbose logging"
  echo -e "  presentations-cli create-presentations-from-mp4 --no-dry-run -v"
  echo -e ""
  echo -e "  # Fix presentations with missing high-level folder source IDs (dry run)"
  echo -e "  presentations-cli create-presentations-from-mp4 --fix-missing-folders --verbose"
  echo -e ""
  echo -e "  # Actually fix presentations with missing high-level folder source IDs"
  echo -e "  presentations-cli create-presentations-from-mp4 --fix-missing-folders --no-dry-run"
  echo ""
  echo -e "  # Scan for documents that need AI summary processing (from Dynamic Healing Discussion Group)"
  echo -e "  presentations-cli scan-for-ai-summaries"
  echo ""
  echo -e "  # Update all documents with raw content but no AI status to 'pending'"
  echo -e "  presentations-cli scan-for-ai-summaries --update"
  echo -e ""
  echo -e "  # Update documents in Dynamic Healing Discussion Group to 'pending' status"
  echo -e "  presentations-cli scan-for-ai-summaries --update-dhg"
  echo ""
  echo -e "  # Scan for documents from a specific folder"
  echo -e "  presentations-cli scan-for-ai-summaries --folder-id 1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc"
  echo ""
  echo -e "  # Reset all documents with raw content to have 'pending' status"
  echo -e "  presentations-cli scan-for-ai-summaries --reset"
  echo ""
  echo -e "  # Process documents with pending AI summary status"
  echo -e "  presentations-cli generate-summary --status pending --limit 10"
  echo -e ""
  echo -e "  # Update documents to have pending status, then generate summaries for them"
  echo -e "  presentations-cli scan-for-ai-summaries --update-dhg"
  echo -e "  presentations-cli generate-summary --status pending --limit 10 --format detailed"
  echo -e ""
  echo -e "  # View AI summary status for documents"
  echo -e "  presentations-cli show-ai-summary-status"
  echo -e ""
  echo -e "  # View AI summary status with custom output file"
  echo -e "  presentations-cli show-ai-summary-status --output-file ./ai_status_report.md"
  echo ""
  echo -e "\033[1mDetailed Command: update-root-drive-id\033[0m"
  echo -e "  Usage: presentations-cli update-root-drive-id [options]"
  echo ""
  echo -e "  Description:"
  echo -e "    Updates all presentation records to have the root_drive_id value set to '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'."
  echo -e "    This command will only update records where root_drive_id is null or empty."
  echo ""
  echo -e "  Options:"
  echo -e "    --dry-run                   Show what would be updated without making changes"
  echo -e "    -v, --verbose               Show detailed logs"
  echo ""
  echo -e "  Examples:"
  echo -e "  # Preview what would be updated without making changes"
  echo -e "  presentations-cli update-root-drive-id --dry-run"
  echo ""
  echo -e "  # Update all presentations to have the specified root_drive_id"
  echo -e "  presentations-cli update-root-drive-id"
  echo ""
  echo -e "\033[1mDetailed Command: create-presentation-assets\033[0m"
  echo -e "  Usage: presentations-cli create-presentation-assets [options]"
  echo ""
  echo -e "  Description:"
  echo -e "    Creates presentation_assets for all supported files in each presentation's high-level folder."
  echo -e "    For each presentation with a high_level_folder_source_id, this command will:"
  echo -e "    - Recursively search for files in the high-level folder up to the specified depth"
  echo -e "    - Filter out unsupported file types (audio, images, video, etc.)"
  echo -e "    - Create presentation_assets for supported files, linking them to the presentation"
  echo -e "    - Set asset_source_id and asset_expert_document_id fields appropriately"
  echo ""
  echo -e "  Options:"
  echo -e "    -p, --presentation-id <id>   Specific presentation ID to process"
  echo -e "    --dry-run                    Show what would be created without making changes"
  echo -e "    -l, --limit <number>         Limit the number of presentations to process"
  echo -e "    -d, --depth <number>         Maximum folder depth to search (default: 6)"
  echo -e "    --skip-existing              Skip presentations that already have assets (default: true)"
  echo -e "    --skip-existing=false        Process all presentations, even those with existing assets"
  echo ""
  echo -e "  Examples:"
  echo -e "  # Preview assets that would be created for all presentations"
  echo -e "  presentations-cli create-presentation-assets --dry-run"
  echo ""
  echo -e "  # Create assets for a specific presentation"
  echo -e "  presentations-cli create-presentation-assets -p 12345-abcde --no-dry-run"
  echo ""
  echo -e "  # Process presentations with a depth limit of 3 folders"
  echo -e "  presentations-cli create-presentation-assets -d 3"
  echo ""
  echo -e "  # Process only the 10 most recent presentations"
  echo -e "  presentations-cli create-presentation-assets -l 10"
  echo ""
  echo -e "\033[1mDetailed Command: add-specific-files\033[0m"
  echo -e "  Usage: presentations-cli add-specific-files [options]"
  echo ""
  echo -e "  Options:"
  echo -e "    --dry-run                   Show what would be added without making changes"
  echo -e "    --source-ids <ids>          Comma-separated list of source_ids to add (optional)"
  echo -e "    --verbose                   Show detailed logs"
  echo ""
  echo -e "  Examples:"
  echo -e "  # Add the 3 default missing files to presentations"
  echo -e "  presentations-cli add-specific-files"
  echo ""
  echo -e "  # Preview what would be added without making changes"
  echo -e "  presentations-cli add-specific-files --dry-run"
  echo ""
  echo -e "  # Add specific source IDs to presentations"
  echo -e "  presentations-cli add-specific-files --source-ids id1,id2,id3"
  echo ""
  echo -e "For detailed help on a specific command, run:"
  echo -e "  presentations-cli [command] --help"
}

# Check for help flag
if [[ "$1" == "--help" || "$1" == "-h" || "$#" -eq 0 ]]; then
  # Display help directly
  display_help
  
  # Log command using NodeJS script directly - create a simple tracking entry
  # This avoids the issues with shell function execution
  LOG_HELP_CMD="npx ts-node -e 'const { createClient } = require(\"@supabase/supabase-js\"); const supabaseUrl = process.env.SUPABASE_URL; const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!supabaseUrl || !supabaseKey) { console.error(\"Missing Supabase credentials\"); process.exit(1); } const supabase = createClient(supabaseUrl, supabaseKey); (async () => { await supabase.from(\"cli_command_tracking\").insert({ pipeline_name: \"presentations\", command_name: \"--help\", execution_time: new Date(), status: \"success\", summary: \"Help command executed successfully\" }); console.log(\"Help command tracked\"); })().catch(err => console.error(err));'"

  # Execute the logging command in the background
  eval $LOG_HELP_CMD &
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
  track_command "review-presentations" "ts-node $SCRIPT_DIR/index.ts review-presentations ${@:2}"
  exit $?
fi

if [[ "$1" == "check-presentation-titles" ]]; then
  track_command "check-presentation-titles" "ts-node $SCRIPT_DIR/index.ts check-presentation-titles ${@:2}"
  exit $?
fi

# Otherwise, execute the presentations CLI normally with tracking
# Use the first argument as the command name or default to "main"
COMMAND="${1:-main}"
track_command "$COMMAND" "ts-node $SCRIPT_DIR/index.ts $*"