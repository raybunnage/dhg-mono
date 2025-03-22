#!/bin/bash
# script-pipeline-main.sh - Main pipeline for managing scripts

# Source the script manager (with error handling)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANAGER_SCRIPT="${SCRIPT_DIR}/script-manager.sh"

if [ ! -f "${MANAGER_SCRIPT}" ]; then
  echo "Error: Cannot find script-manager.sh at ${MANAGER_SCRIPT}"
  exit 1
fi

# Check for Claude API key environment variables before continuing
# This provides early feedback to users
if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$CLI_CLAUDE_API_KEY" ] && [ -z "$VITE_ANTHROPIC_API_KEY" ]; then
  echo "⚠️ WARNING: No Claude API key found in environment variables."
  echo "For using classify features, you need to set one of these environment variables:"
  echo "   - CLAUDE_API_KEY"
  echo "   - ANTHROPIC_API_KEY"
  echo "   - CLI_CLAUDE_API_KEY"
  echo ""
  echo "Example: export CLAUDE_API_KEY=your_api_key"
  echo ""
fi

source "${MANAGER_SCRIPT}"

# Display usage information
function show_help() {
  echo "Usage: scripts/cli-pipeline/script-pipeline-main.sh [option] [count]"
  echo "Options:"
  echo "  sync                      - Synchronize database with files on disk (mark files as deleted/not deleted)"
  echo "  find-new                  - Find and insert new script files on disk into the database"
  echo "  show-untyped              - Show all script files without a script type"
  echo "  show-recent               - Show the 20 most recent script files based on update date"
  echo "  classify-recent           - Classify the 20 most recent script files"
  echo "  classify-untyped [n]      - Classify untyped script files, optionally specify number to process (default: 10)"
  echo "  generate-summary [n] [i]  - Generate a summary report of scripts"
  echo "                              n: Number of scripts (default: 50, use 'all' for all scripts)"
  echo "                              i: Include deleted (true/false, default: false)"
  echo "  all                       - Run the complete pipeline (sync, find-new, classify-recent)"
  echo "  help                      - Show this help message"
  echo ""
  echo "Environment Variables Required:"
  echo "  For classification (classify-recent, classify-untyped):"
  echo "    CLAUDE_API_KEY or ANTHROPIC_API_KEY     - Your Claude API key"
  echo ""
  echo "  For database operations (all commands):"
  echo "    SUPABASE_URL                            - Your Supabase URL"
  echo "    SUPABASE_SERVICE_ROLE_KEY               - Your Supabase service role key"
}

# We no longer need to check for environment variables here since we use config service
# The ScriptManagementService handles loading credentials correctly
# This comment is kept to document the change

# Main logic
option=$1
count=$2
include_deleted=$3

# Process command line options with input validation
case $option in
  sync)
    sync_scripts
    exit $?
    ;;
  find-new)
    find_new_scripts
    exit $?
    ;;
  show-untyped)
    show_untyped_scripts
    exit $?
    ;;
  show-recent)
    show_recent_scripts
    exit $?
    ;;
  classify-recent)
    classify_recent_scripts
    exit $?
    ;;
  classify-untyped)
    # Validate count parameter
    if [[ -n "$count" && ! "$count" =~ ^[0-9]+$ ]]; then
      echo "Error: Count must be a positive integer"
      exit 1
    fi
    classify_untyped_scripts "$count"
    exit $?
    ;;
  generate-summary)
    # Validate parameters
    if [[ -n "$count" && "$count" != "all" && ! "$count" =~ ^[0-9]+$ ]]; then
      echo "Error: Count must be a positive integer or 'all'"
      exit 1
    fi
    
    if [[ -n "$include_deleted" && "$include_deleted" != "true" && "$include_deleted" != "false" ]]; then
      echo "Error: Include deleted must be 'true' or 'false'"
      exit 1
    fi
    
    # Handle 'all' as a special case for count
    if [ "$count" = "all" ]; then
      count=-1
    fi
    
    generate_summary "$count" "$include_deleted"
    exit $?
    ;;
  all)
    run_complete_pipeline
    exit $?
    ;;
  help|"")
    show_help
    exit 0
    ;;
  *)
    echo "Error: Unknown option '$option'"
    show_help
    exit 1
    ;;
esac