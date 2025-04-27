#!/bin/bash
# All Pipelines CLI
# This is a master CLI that can run health checks across all pipelines

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${PROJECT_ROOT}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Load environment variables from project root .env.development file if it exists
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  # Export environment variables for Supabase
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Function to execute a command with tracking
track_command() {
  local pipeline_name="all_pipelines"
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

# Command handler for master-health-check
master_health_check() {
  track_command "master-health-check" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts master-health-check $@"
}

# Print help information
show_help() {
  echo "All Pipelines CLI - Master CLI for running health checks across all pipelines"
  echo ""
  echo "USAGE:"
  echo "  ./all-pipelines-cli.sh <command> [options]"
  echo ""
  echo "COMMANDS:"
  echo "  master-health-check       Run health checks for all pipelines and report consolidated status"
  echo "  help                      Show this help message"
  echo ""
  echo "OPTIONS for master-health-check:"
  echo "  -v, --verbose             Display detailed output from each health check"
  echo "  -t, --timeout <ms>        Timeout for individual health check operations in milliseconds (default: 30000)"
  echo "  --include <pipelines>     Comma-separated list of pipelines to include (default: all)"
  echo "  --exclude <pipelines>     Comma-separated list of pipelines to exclude"
  echo ""
  echo "EXAMPLES:"
  echo "  # Run health checks for all pipelines"
  echo "  ./all-pipelines-cli.sh master-health-check"
  echo ""
  echo "  # Run health checks with verbose output"
  echo "  ./all-pipelines-cli.sh master-health-check --verbose"
  echo ""
  echo "  # Run health checks for specific pipelines"
  echo "  ./all-pipelines-cli.sh master-health-check --include google_sync,document"
  echo ""
  echo "  # Run health checks excluding specific pipelines"
  echo "  ./all-pipelines-cli.sh master-health-check --exclude media_processing"
  echo ""
  echo "  # Set custom timeout (in milliseconds)"
  echo "  ./all-pipelines-cli.sh master-health-check --timeout 60000"
}

# Main command router
case "$1" in
  "master-health-check")
    master_health_check "${@:2}"
    ;;
  "help"|"--help"|"-h")
    show_help
    ;;
  *)
    if [ -z "$1" ]; then
      show_help
    else
      echo "Unknown command: $1"
      echo "Run './all-pipelines-cli.sh help' for usage information."
      exit 1
    fi
    ;;
esac