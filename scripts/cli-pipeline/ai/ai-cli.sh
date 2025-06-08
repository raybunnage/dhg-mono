#!/bin/bash
# AI CLI wrapper script
# Provides a consistent interface for AI-related tools and services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="ai"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Check if we have a TS tracking wrapper
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node --project "$ROOT_DIR/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    # Fallback to direct execution without tracking
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Load environment variables
for ENV_FILE in "${ROOT_DIR}/.env" "${ROOT_DIR}/.env.development" "${ROOT_DIR}/.env.local"; do
  if [ -f "${ENV_FILE}" ]; then
    echo "Loading environment variables from ${ENV_FILE}..."
    set -a
    source "${ENV_FILE}"
    set +a
  fi
done

# Display help information
function display_help() {
  echo "AI CLI - Tools for AI services and prompt management"
  echo ""
  echo "Usage:"
  echo "  ai-cli.sh [command] [options]"
  echo ""
  echo "Commands:"
  echo "  prompt-lookup [prompt-name]        Look up a prompt template by name"
  echo "  validate-ai-assets                 Validate AI asset integrity"
  echo "  validate-prompt-relationships      Validate relationships between prompts"
  echo "  run-ai-analyze                     Run AI analysis on content"
  echo "  check-claude-api-key               Verify Claude API key is valid"
  echo "  health-check                       Run health check for AI pipeline"
  echo ""
  echo "Examples:"
  echo "  ai-cli.sh prompt-lookup script-analysis-prompt"
  echo "  ai-cli.sh validate-ai-assets"
}

# Check for help flag or no arguments
if [[ "$1" == "--help" || "$1" == "-h" || "$#" -eq 0 ]]; then
  display_help
  exit 0
fi

# Handle specific commands
COMMAND="$1"
shift

case "$COMMAND" in
  prompt-lookup)
    track_command "prompt-lookup" "$SCRIPT_DIR/prompt-lookup.sh $*"
    ;;
  validate-ai-assets)
    track_command "validate-ai-assets" "$SCRIPT_DIR/validate-ai-assets.sh $*"
    ;;
  validate-prompt-relationships)
    track_command "validate-prompt-relationships" "$SCRIPT_DIR/validate-prompt-relationships.sh $*"
    ;;
  run-ai-analyze)
    track_command "run-ai-analyze" "$SCRIPT_DIR/run-ai-analyze.sh $*"
    ;;
  check-claude-api-key)
    track_command "check-claude-api-key" "$SCRIPT_DIR/check-claude-api-key.sh $*"
    ;;
  health-check)
    track_command "health-check" "$SCRIPT_DIR/health-check.sh $*"
    ;;
  *)
    echo "Unknown command: $COMMAND"
    display_help
    exit 1
    ;;
esac