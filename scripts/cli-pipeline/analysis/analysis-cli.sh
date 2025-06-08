#!/bin/bash
# Analysis CLI wrapper script
# Provides a consistent interface for script analysis tools

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${PROJECT_ROOT}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="analysis"
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

# Load environment variables
for ENV_FILE in "${PROJECT_ROOT}/.env" "${PROJECT_ROOT}/.env.development" "${PROJECT_ROOT}/.env.local"; do
  if [ -f "${ENV_FILE}" ]; then
    echo "Loading environment variables from ${ENV_FILE}..."
    set -a
    source "${ENV_FILE}"
    set +a
  fi
done

# Display help information
function display_help() {
  echo "Analysis CLI - Tools for analyzing scripts and code"
  echo ""
  echo "Usage:"
  echo "  analysis-cli.sh [command] [options]"
  echo ""
  echo "Commands:"
  echo "  analyze-scripts                    Analyze scripts in the codebase"
  echo "  classify-script-with-prompt        Classify a script using AI prompts"
  echo "  import-script-analysis             Import script analysis results"
  echo "  health-check                       Run health check for analysis pipeline"
  echo ""
  echo "Examples:"
  echo "  analysis-cli.sh analyze-scripts"
  echo "  analysis-cli.sh classify-script-with-prompt script.ts"
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
  analyze-scripts)
    track_command "analyze-scripts" "$SCRIPT_DIR/analyze-scripts.sh $*"
    ;;
  classify-script-with-prompt)
    track_command "classify-script-with-prompt" "$SCRIPT_DIR/classify-script-with-prompt.sh $*"
    ;;
  import-script-analysis)
    track_command "import-script-analysis" "$SCRIPT_DIR/import-script-analysis.sh $*"
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