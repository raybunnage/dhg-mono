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
  echo -e "  scan-for-ai-summaries      Scan for documents that need AI summarization"
  echo -e "  show-missing-content       Show presentations without content that need reprocessing"
  echo -e "  show-ai-summary-status     Show AI summary status for expert documents in markdown table"
  echo -e "  presentation-asset-bio     Match non-transcript expert documents with presentations and create assets"
  echo -e "  add-specific-files         Add specific files from sources_google to presentations"
  echo ""
  echo -e "\033[1mDetailed Command: generate-summary\033[0m"
  echo -e "  Usage: presentations-cli generate-summary [options]"
  echo ""
  echo -e "  Options:"
  echo -e "    -p, --presentation-id <id>   Process a specific presentation ID"
  echo -e "    -e, --expert-id <id>         Process presentations for a specific expert"
  echo -e "    -f, --force                  Regenerate summaries even if they exist"
  echo -e "    --dry-run                    Preview mode: generate but don't save to database"
  echo -e "    -l, --limit <number>         Max presentations to process (default: 5)"
  echo -e "    -o, --output <path>          Output file for JSON results"
  echo -e "    --format <format>            Summary style:"
  echo -e "                                   concise: 2-3 paragraph summary (default)"
  echo -e "                                   detailed: 5-7 paragraph thorough summary"
  echo -e "                                   bullet-points: 5-10 key bullet points"
  echo -e "    --status <status>            Filter by presentation status (e.g., 'pending')"
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
  
  # Load environment from .env files
  if [ -f "$ROOT_DIR/.env.development" ]; then
    source "$ROOT_DIR/.env.development"
  fi
  
  if [ -f "$ROOT_DIR/.env.local" ]; then
    source "$ROOT_DIR/.env.local"
  fi
  
  # Log this help command using Supabase directly
  if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    # Log command execution directly to database
    curl -X POST "$SUPABASE_URL/rest/v1/cli_command_tracking" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d "{
          \"pipeline_name\": \"presentations\",
          \"command_name\": \"help\",
          \"execution_time\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
          \"status\": \"success\",
          \"summary\": \"Help command executed successfully\"
        }" \
        --silent > /dev/null
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
fi

# Otherwise, execute the presentations CLI normally with tracking
# Use the first argument as the command name or default to "main"
COMMAND="${1:-main}"
track_command "$COMMAND" "ts-node $SCRIPT_DIR/index.ts $*"