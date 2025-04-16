#!/bin/bash
# document-pipeline-service-cli.sh - Wrapper script for the TypeScript CLI

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_FILE="${SCRIPT_DIR}/cli.ts"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Command tracking function - works with new tracking service
track_command() {
  local pipeline_name="document_pipeline"
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

# Load environment variables from .env files
if [ -f "${ROOT_DIR}/.env.development" ]; then
  echo "Loading environment variables from .env.development..."
  set -a # automatically export all variables
  source "${ROOT_DIR}/.env.development"
  set +a
fi

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

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Missing Supabase credentials."
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  exit 1
fi

# Create a log file
LOG_DIR="${ROOT_DIR}/document-analysis-results"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/document-pipeline-$(date +%Y-%m-%d_%H-%M-%S).log"

# Run the TypeScript CLI, pipe stdout and stderr to the log file while also displaying them
cd "${ROOT_DIR}"

# Extract command name
COMMAND_NAME=${1:-"default"}
ORIG_COMMAND="npx ts-node --transpile-only ${CLI_FILE} $@"

# Use the tracking wrapper for execution with logging
track_command "$COMMAND_NAME" "$ORIG_COMMAND" 2>&1 | tee -a "${LOG_FILE}"

# Exit with the exit code of the pipeline
exit ${PIPESTATUS[0]}