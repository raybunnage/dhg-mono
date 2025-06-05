#!/bin/bash
# MIME Types CLI - A wrapper script for the mime-types CLI tools

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Get the project root directory
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source helper functions if available, but continue even if not found
if [ -f "$PROJECT_ROOT/scripts/cli-pipeline/shared/cli-helpers.sh" ]; then
  source "$PROJECT_ROOT/scripts/cli-pipeline/shared/cli-helpers.sh"
else
  echo "⚠️ Warning: cli-helpers.sh not found, but continuing anyway."
fi

# Load environment variables from .env.development in project root
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  # Export key variables needed for Supabase
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
else
  echo "⚠️ Warning: .env.development file not found at $ENV_DEV_FILE"
fi

# Command tracking function
track_command() {
  local pipeline_name="mime_types"
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
  echo "MIME Types CLI"
  echo "Usage: $0 <command> [options]"
  echo ""
  echo "Commands:"
  echo "  sync                      Synchronize the mime_types table with MIME types from sources_google"
  echo "  health-check              Run health check for MIME types pipeline"
  echo "  help                      Show this help message"
  echo ""
  echo "Options for sync:"
  echo "  --dry-run                 Show what would be done without making changes"
  echo "  -v, --verbose             Show detailed information about each MIME type"
  echo ""
  echo "Examples:"
  echo "  $0 sync                  # Synchronize the mime_types table"
  echo "  $0 sync --dry-run        # Show what would be synchronized without making changes"
  echo "  $0 sync -v               # Synchronize with verbose output"
}

# Handle the sync command
sync_mime_types() {
  track_command "sync" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts sync $@"
}

# The configure-processing command has been removed along with the mime_type_processing table

# Main command handler
case "$1" in
  "sync")
    sync_mime_types "${@:2}"
    ;;
  "health-check")
    track_command "health-check" "$SCRIPT_DIR/health-check.sh"
    ;;
  "help" | "-h" | "--help")
    show_help
    ;;
  *)
    if [ -z "$1" ]; then
      show_help
    else
      echo "❌ Unknown command: $1"
      echo "Run '$0 help' for usage information"
      exit 1
    fi
    ;;
esac