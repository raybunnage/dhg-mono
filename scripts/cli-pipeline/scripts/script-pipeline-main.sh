#!/bin/bash
# script-pipeline-main.sh - Shell wrapper for the TypeScript CLI implementation
# This script executes the TypeScript version of the script pipeline CLI
# It provides a backwards-compatible interface while using the new service-based approach

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TS_SCRIPT="${SCRIPT_DIR}/script-pipeline-main.ts"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="script_pipeline"
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
for ENV_FILE in "${ROOT_DIR}/.env" "${ROOT_DIR}/.env.development" "${ROOT_DIR}/.env.local"; do
  if [ -f "${ENV_FILE}" ]; then
    echo "Loading environment variables from ${ENV_FILE}..."
    set -a
    source "${ENV_FILE}"
    set +a
  fi
done

# Ensure we have a valid CLAUDE_API_KEY (copy from ANTHROPIC_API_KEY if needed)
if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY"
  export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
fi

# Check for TS_NODE and install if needed
if ! command -v ts-node &> /dev/null; then
  echo "ts-node not found, installing with npm..."
  npm install -g ts-node typescript
fi

# Check for typescript and install if needed
if ! command -v tsc &> /dev/null; then
  echo "TypeScript not found, installing with npm..."
  npm install -g typescript
fi

# Verify TypeScript script exists
if [ ! -f "${TS_SCRIPT}" ]; then
  echo "Error: Cannot find script-pipeline-main.ts at ${TS_SCRIPT}"
  exit 1
fi

# Display a separator for better readability
echo "===================================================================="
echo "                  Script Pipeline (Service-Based)"
echo "===================================================================="

# Use the first argument as the command name or default to "main"
COMMAND="${1:-main}"
track_command "$COMMAND" "ts-node ${TS_SCRIPT} $*"
exit $?