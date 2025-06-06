#!/bin/bash

# Maintenance CLI for checking and maintaining code quality

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd $SCRIPT_DIR/../.. && pwd)"

# Define tracking function
track_command() {
  local pipeline_name="maintenance"
  local command_name="$1"
  shift
  local full_command="$@"
  
  local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Display help
show_help() {
  echo "DHG Maintenance CLI"
  echo ""
  echo "USAGE:"
  echo "  ./maintenance-cli.sh <command> [options]"
  echo ""
  echo "COMMANDS:"
  echo "  (* = frequently used commands based on usage statistics)"
  echo ""
  echo "MAINTENANCE:"
  echo "  * health-check        Run a health check on the CLI pipeline code (10 uses)"
  echo "    singleton-usage     Check for correct usage of singleton services"
  echo "    check-google-sync   Check sync-and-update-metadata implementation"
  echo "    check-find-folder   Check find-folder implementation"
  echo ""
  echo "SYSTEM:"
  echo "    help                Show this help message"
  echo ""
  echo "OPTIONS:"
  echo "  --verbose           Show more detailed output"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "MAINTENANCE:"
  echo "  # Run a health check on the CLI pipeline code"
  echo "  ./maintenance-cli.sh health-check"
  echo ""
  echo "  # Check for correct usage of singleton services"
  echo "  ./maintenance-cli.sh singleton-usage --verbose"
}

# Health check command
health_check() {
  echo "Running health check on CLI pipeline code..."
  track_command "health-check" "cd $PROJECT_ROOT && node $SCRIPT_DIR/health-check-services.js $@"
}

# Singleton usage check
singleton_usage() {
  echo "Checking for correct singleton service usage..."
  track_command "singleton-usage" "cd $PROJECT_ROOT && node $SCRIPT_DIR/health-check-services.js $@"
}

# Main command router
# New commands
check_google_sync() {
  echo "Checking Google Drive sync implementation..."
  track_command "check-google-sync" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/check-google-sync.ts $@"
}

check_find_folder() {
  echo "Checking find-folder implementation..."
  track_command "check-find-folder" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/check-find-folder.ts $@"
}

# Main command router
case "$1" in
  "health-check")
    health_check "${@:2}"
    ;;
  "singleton-usage")
    singleton_usage "${@:2}"
    ;;
  "check-google-sync")
    check_google_sync "${@:2}"
    ;;
  "check-find-folder")
    check_find_folder "${@:2}"
    ;;
  "help"|"--help"|"-h")
    show_help
    ;;
  *)
    echo "Unknown command: $1"
    echo "Run './maintenance-cli.sh help' for usage information"
    exit 1
    ;;
esac