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

# Command handlers
sync_scripts() {
  track_command "sync" "npx ts-node $SCRIPT_DIR/sync-all-scripts.ts $@"
}

classify_script() {
  track_command "classify" "npx ts-node $SCRIPT_DIR/classify-script.ts $@"
}

list_scripts() {
  track_command "list" "npx ts-node $SCRIPT_DIR/list-scripts.ts $@"
}

search_scripts() {
  track_command "search" "npx ts-node $SCRIPT_DIR/search-scripts.ts $@"
}

archive_script() {
  track_command "archive" "npx ts-node $SCRIPT_DIR/archive-script.ts $@"
}

register_script() {
  track_command "register" "npx ts-node $SCRIPT_DIR/register-script.ts $@"
}

script_stats() {
  track_command "stats" "npx ts-node $SCRIPT_DIR/script-stats.ts $@"
}

health_check() {
  track_command "health-check" "$SCRIPT_DIR/health-check.sh $@"
}

# Print help information
show_help() {
  echo "Scripts CLI - Comprehensive script management system"
  echo ""
  echo "USAGE:"
  echo "  ./scripts-cli.sh <command> [options]"
  echo ""
  echo "COMMANDS:"
  echo "  (* = frequently used commands)"
  echo ""
  echo "SCRIPT MANAGEMENT:"
  echo "  * sync                    Full sync of all scripts with AI classification"
  echo "    classify <file>         Classify a single script file"
  echo "    list [options]          List scripts with filtering options"
  echo "      --pipeline <name>       Filter by CLI pipeline"
  echo "      --type <type>           Filter by document type"
  echo "      --recent <days>         Show recently modified"
  echo "      --archived              Include archived scripts"
  echo "    search <query>          Search scripts by content or metadata"
  echo "    archive <file>          Move script to archive folder"
  echo "    register <file>         Manually register a new script"
  echo "    stats                   Show script statistics and insights"
  echo ""
  echo "SYSTEM:"
  echo "    health-check            Check if the scripts pipeline is working"
  echo "    help                    Show this help message"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "SYNC & CLASSIFICATION:"
  echo "  # Sync all scripts with AI classification"
  echo "  ./scripts-cli.sh sync"
  echo ""
  echo "  # Classify a single script"
  echo "  ./scripts-cli.sh classify ./some-script.ts"
  echo ""
  echo "BROWSING & SEARCHING:"
  echo "  # List all scripts in google_sync pipeline"
  echo "  ./scripts-cli.sh list --pipeline google_sync"
  echo ""
  echo "  # Show scripts modified in last 7 days"
  echo "  ./scripts-cli.sh list --recent 7"
  echo ""
  echo "  # Search for scripts containing 'supabase'"
  echo "  ./scripts-cli.sh search supabase"
  echo ""
  echo "MANAGEMENT:"
  echo "  # Archive a legacy script"
  echo "  ./scripts-cli.sh archive ./old-script.sh"
  echo ""
  echo "  # Register a new script with tags"
  echo "  ./scripts-cli.sh register ./new-script.ts --tags 'backup,database'"
  echo ""
  echo "  # View comprehensive statistics"
  echo "  ./scripts-cli.sh stats"
}

# Main command router
case "$1" in
  "sync")
    sync_scripts "${@:2}"
    ;;
  "classify")
    classify_script "${@:2}"
    ;;
  "list")
    list_scripts "${@:2}"
    ;;
  "search")
    search_scripts "${@:2}"
    ;;
  "archive")
    archive_script "${@:2}"
    ;;
  "register")
    register_script "${@:2}"
    ;;
  "stats")
    script_stats "${@:2}"
    ;;
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