#!/bin/bash
# Master script for the presentations CLI with detailed help

# Set script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

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
  echo -e "\033[1mDetailed Command: scan-for-ai-summaries\033[0m"
  echo -e "  Usage: presentations-cli scan-for-ai-summaries [options]"
  echo ""
  echo -e "  Options:"
  echo -e "    -l, --limit <number>         Limit the number of documents to display (default: 50)"
  echo -e "    --update                     Update documents with missing AI status to 'pending'"
  echo -e "    --reset                      Reset all documents with raw content to 'pending' status"
  echo ""
  echo -e "\033[1mExamples:\033[0m"
  echo -e "  # Generate summaries with detailed format"
  echo -e "  presentations-cli generate-summary --format detailed"
  echo ""
  echo -e "  # Preview a summary for specific presentation without saving"
  echo -e "  presentations-cli generate-summary --presentation-id 1234abcd --dry-run"
  echo ""
  echo -e "  # Process summaries for a specific expert"
  echo -e "  presentations-cli generate-summary --expert-id 5678efgh --limit 10"
  echo ""
  echo -e "  # Scan for documents that need AI summary processing"
  echo -e "  presentations-cli scan-for-ai-summaries"
  echo ""
  echo -e "  # Update all documents with raw content but no AI status to 'pending'"
  echo -e "  presentations-cli scan-for-ai-summaries --update"
  echo ""
  echo -e "  # Reset all documents with raw content to have 'pending' status"
  echo -e "  presentations-cli scan-for-ai-summaries --reset"
  echo ""
  echo -e "  # Process documents with pending AI summary status"
  echo -e "  presentations-cli generate-summary --status pending --limit 10"
  echo ""
  echo -e "For detailed help on a specific command, run:"
  echo -e "  presentations-cli [command] --help"
}

# Check for help flag
if [[ "$1" == "--help" || "$1" == "-h" || "$#" -eq 0 ]]; then
  display_help
  exit 0
fi

# Otherwise, execute the presentations CLI
ts-node "$SCRIPT_DIR/index.ts" "$@"