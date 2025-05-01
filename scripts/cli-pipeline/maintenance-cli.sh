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
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Display help
show_help() {
  echo "DHG Maintenance CLI"
  echo ""
  echo "Usage: ./maintenance-cli.sh COMMAND [OPTIONS]"
  echo ""
  echo "Commands:"
  echo "  health-check        Run a health check on the CLI pipeline code"
  echo "  singleton-usage     Check for correct usage of singleton services"
  echo "  help                Show this help message"
  echo ""
  echo "Options:"
  echo "  --verbose           Show more detailed output"
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
case "$1" in
  "health-check")
    health_check "${@:2}"
    ;;
  "singleton-usage")
    singleton_usage "${@:2}"
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