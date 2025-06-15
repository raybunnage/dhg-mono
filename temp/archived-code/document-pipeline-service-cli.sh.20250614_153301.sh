#!/bin/bash
# document-pipeline-service-cli.sh - Wrapper script for the TypeScript CLI

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_FILE="${SCRIPT_DIR}/cli.ts"
TRACKER_TS="${PROJECT_ROOT}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Command tracking function - works with new tracking service
track_command() {
  local pipeline_name="document_pipeline"
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

# Display help information
show_help() {
  echo "Document Pipeline Service CLI"
  echo "=============================="
  echo "A CLI tool for managing document pipelines and document types"
  echo ""
  echo "Usage: $0 COMMAND [OPTIONS]"
  echo ""
  echo "Commands:"
  echo "  test-connection      Test connection to Supabase"
  echo "  sync                 Synchronize database with files on disk"
  echo "  find-new             Find and insert new files on disk into the database"
  echo "  show-untyped [--limit N]  Show all documentation files without a document type"
  echo "  show-recent [--limit N]   Show the most recent files based on update date"
  echo "  classify-recent [--count N]  Classify the most recent files"
  echo "  classify-untyped [--count N] Classify untyped files"
  echo "  all                  Run the complete pipeline (sync, find-new, classify-recent)"
  echo "  test-classify-document-types  Test document classification with Claude"
  echo "  test-google-doc-classification  Test classifying Google Drive files with Claude" 
  echo "  health-check         Check the health of the document pipeline service"
  echo "    --skip-database    Skip database connection check"
  echo "    --skip-files       Skip file system check"
  echo "    --skip-claude      Skip Claude service check"
  echo "    --verbose, -v      Show verbose output"
  echo ""
  echo "  help                 Show this help information"
  echo ""
  echo "Example:"
  echo "  $0 all               Run the complete document pipeline"
  echo "  $0 health-check      Check the health of all components"
  echo "  $0 classify-recent --count 5  Classify the 5 most recent files"
}

# Load environment variables from .env files
if [ -f "${PROJECT_ROOT}/.env.development" ]; then
  echo "Loading environment variables from .env.development..."
  set -a # automatically export all variables
  source "${PROJECT_ROOT}/.env.development"
  set +a
fi

if [ -f "${PROJECT_ROOT}/.env.local" ]; then
  echo "Loading environment variables from .env.local..."
  set -a
  source "${PROJECT_ROOT}/.env.local"
  set +a
fi

# Ensure we have a valid CLAUDE_API_KEY (copy from ANTHROPIC_API_KEY if needed)
if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY"
  export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
fi

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Missing Supabase credentials."
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  exit 1
fi

# Create a log file
LOG_DIR="${PROJECT_ROOT}/document-analysis-results"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/document-pipeline-$(date +%Y-%m-%d_%H-%M-%S).log"

# Run the TypeScript CLI, pipe stdout and stderr to the log file while also displaying them
cd "${PROJECT_ROOT}"

# Extract command name
COMMAND=${1:-"help"}

# Process help request
if [ "$COMMAND" == "help" ] || [ "$COMMAND" == "--help" ] || [ "$COMMAND" == "-h" ]; then
  show_help
  exit 0
fi

# Process command based on name
case "$COMMAND" in
  # Define specific command handlers
  "test-connection")
    track_command "test-connection" "npx ts-node --transpile-only ${CLI_FILE} test-connection ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "sync")
    track_command "sync" "npx ts-node --transpile-only ${CLI_FILE} sync ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "find-new")
    track_command "find-new" "npx ts-node --transpile-only ${CLI_FILE} find-new ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "show-untyped")
    track_command "show-untyped" "npx ts-node --transpile-only ${CLI_FILE} show-untyped ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "show-recent")
    track_command "show-recent" "npx ts-node --transpile-only ${CLI_FILE} show-recent ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "classify-recent")
    track_command "classify-recent" "npx ts-node --transpile-only ${CLI_FILE} classify-recent ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "classify-untyped")
    track_command "classify-untyped" "npx ts-node --transpile-only ${CLI_FILE} classify-untyped ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "all")
    track_command "all" "npx ts-node --transpile-only ${CLI_FILE} all ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "test-classify-document-types")
    track_command "test-classify-document-types" "npx ts-node --transpile-only ${CLI_FILE} test-classify-document-types ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "test-google-doc-classification")
    track_command "test-google-doc-classification" "npx ts-node --transpile-only ${CLI_FILE} test-google-doc-classification ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  "health-check")
    track_command "health-check" "npx ts-node --transpile-only ${CLI_FILE} health-check ${@:2}" 2>&1 | tee -a "${LOG_FILE}"
    exit ${PIPESTATUS[0]}
    ;;
  *)
    echo "❌ Unknown command: $COMMAND"
    echo "Run '$0 help' for usage information"
    exit 1
    ;;
esac