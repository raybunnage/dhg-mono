#!/bin/bash
# Scripts CLI
# CLI for scripts management operations

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
  local pipeline_name="scripts"
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

# Command handler for health-check
health_check() {
  track_command "health-check" "$SCRIPT_DIR/health-check.sh $@"
}

# Print help information
show_help() {
  echo "Scripts CLI - CLI for scripts management operations"
  echo ""
  echo "USAGE:"
  echo "  ./scripts-cli.sh <command> [options]"
  echo ""
  echo "COMMANDS:"
  echo "  health-check            Check if the scripts pipeline is working properly"
  echo "  help                    Show this help message"
  echo ""
  echo "EXAMPLES:"
  echo "  # Check health of the scripts pipeline"
  echo "  ./scripts-cli.sh health-check"
}

# Main command router
case "$1" in
  "health-check")
    health_check "${@:2}"
    ;;
  "help"|"--help"|"-h")
    show_help
    ;;
  *)
    if [ -z "$1" ]; then
      show_help
    else
      echo "Unknown command: $1"
      echo "Run './scripts-cli.sh help' for usage information."
      exit 1
    fi
    ;;
esac