#!/bin/bash
# document-pipeline-main.sh - Main pipeline for managing documentation files

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MANAGER_SCRIPT="${SCRIPT_DIR}/document-pipeline-manager.sh"

# Load environment variables from .env.development
if [ -f "${ROOT_DIR}/.env.development" ]; then
  echo "Loading environment variables from .env.development..."
  set -a # automatically export all variables
  source "${ROOT_DIR}/.env.development"
  set +a
fi

# Load local environment variables if they exist (these override .env.development)
if [ -f "${ROOT_DIR}/.env.local" ]; then
  echo "Loading environment variables from .env.local..."
  set -a
  source "${ROOT_DIR}/.env.local"
  set +a
fi

# Ensure we have a valid CLAUDE_API_KEY (copy from ANTHROPIC_API_KEY if needed)
if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY"
  export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
fi

# Check for document manager script
if [ ! -f "${MANAGER_SCRIPT}" ]; then
  echo "Error: Cannot find document-pipeline-manager.sh at ${MANAGER_SCRIPT}"
  exit 1
fi

# Verify API key status after loading environment files
if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️ WARNING: No Claude API key found after loading environment files."
  echo "Verify .env.development has ANTHROPIC_API_KEY set."
  echo ""
else
  echo "✅ API key found in environment variables."
fi

# Source the document manager script to import functions
source "${MANAGER_SCRIPT}"

# Display usage information
function show_help() {
  echo "Usage: scripts/cli-pipeline/document/document-pipeline-main.sh [option] [count]"
  echo "Options:"
  echo "  sync                      - Synchronize database with files on disk (standardize metadata, hard delete missing files)"
  echo "  find-new                  - Find and insert new files on disk into the database"
  echo "  show-untyped              - Show all documentation files without a document type"
  echo "  show-recent               - Show the 20 most recent files based on update date"
  echo "  classify-recent [n]       - Classify the n most recent files (default: 20)"
  echo "  classify-untyped [n]      - Classify untyped files, optionally specify number to process (default: 10)"
  echo "  clean-script-results      - Remove script-analysis-results files from the database"
  echo "  generate-summary [n] [i]  - Generate a summary report of documents"
  echo "                              n: Number of documents (default: 50, use 'all' for all documents)"
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

# Main logic
option=$1
count=$2
include_deleted=$3

# Process command line options with input validation
case $option in
  sync)
    sync_files
    exit $?
    ;;
  find-new)
    find_new_files
    exit $?
    ;;
  show-untyped)
    show_untyped_files
    exit $?
    ;;
  show-recent)
    show_recent_files
    exit $?
    ;;
  classify-recent)
    # Validate count parameter
    if [[ -n "$count" && ! "$count" =~ ^[0-9]+$ ]]; then
      echo "Error: Count must be a positive integer"
      exit 1
    fi
    classify_recent_files "$count"
    exit $?
    ;;
  classify-untyped)
    # Validate count parameter
    if [[ -n "$count" && ! "$count" =~ ^[0-9]+$ ]]; then
      echo "Error: Count must be a positive integer"
      exit 1
    fi
    classify_untyped_files "$count"
    exit $?
    ;;
  clean-script-results)
    clean_script_results
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