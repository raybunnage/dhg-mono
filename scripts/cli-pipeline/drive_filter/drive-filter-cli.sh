#!/bin/bash

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Export Supabase environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Command tracking function
track_command() {
  local pipeline_name="drive_filter"
  local command_name="$1"
  shift
  local full_command="$@"
  
  local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
  if [ -f "$TRACKER_TS" ]; then
    # Run command through tracking service but allow console output to be seen
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command" 2>&1
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Help command
show_help() {
  echo "Drive Filter CLI"
  echo "Usage: drive-filter-cli.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  create-profile        Create a new filter profile"
  echo "  update-profile        Update an existing filter profile"
  echo "  delete-profile        Delete a filter profile"
  echo "  list-profiles         List all filter profiles"
  echo "  set-active-profile    Set a profile as active"
  echo "  get-active-profile    Get the currently active profile"
  echo "  add-drive             Add a drive to a profile's included list"
  echo "  remove-drive          Remove a drive from a profile's included list"
  echo "  list-drives           List all drives included in a profile"
  echo "  apply-migrations      Apply the database migrations for filters"
  echo "  health-check          Run a health check on the filter service"
  echo "  help                  Show this help message"
  echo ""
  echo "For command-specific help, run: drive-filter-cli.sh <command> --help"
}

# Command handlers
create_profile() {
  # Properly quote arguments to prevent word splitting
  ARGS=""
  for ARG in "$@"; do
    ARGS="$ARGS \"$ARG\""
  done
  track_command "create-profile" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/create-profile.ts $ARGS"
}

update_profile() {
  track_command "update-profile" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/update-profile.ts $@"
}

delete_profile() {
  track_command "delete-profile" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/delete-profile.ts $@"
}

list_profiles() {
  track_command "list-profiles" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/list-profiles.ts $@"
}

set_active_profile() {
  local args=()
  for arg in "$@"; do
    # Escape single quotes in the argument
    escaped_arg=$(printf '%s' "$arg" | sed "s/'/'\\\\''/g")
    args+=("'$escaped_arg'")
  done
  track_command "set-active-profile" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/set-active-profile.ts ${args[*]}"
}

get_active_profile() {
  track_command "get-active-profile" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/get-active-profile.ts $@"
}

add_drive() {
  track_command "add-drive" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/add-drive-to-profile.ts $@"
}

remove_drive() {
  track_command "remove-drive" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/remove-drive-from-profile.ts $@"
}

list_drives() {
  track_command "list-drives" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/list-drives-in-profile.ts $@"
}

apply_migrations() {
  track_command "apply-migrations" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/apply-migrations.ts $@"
}

health_check() {
  track_command "health-check" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/commands/health-check.ts $@"
}

# Check for help flags first
if [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ "$1" = "help" ]; then
  show_help
  exit 0
fi

# Process command
if [ $# -eq 0 ]; then
  show_help
  exit 0
fi

case "$1" in
  "create-profile")
    create_profile "${@:2}"
    ;;
  "update-profile")
    update_profile "${@:2}"
    ;;
  "delete-profile")
    delete_profile "${@:2}"
    ;;
  "list-profiles")
    list_profiles "${@:2}"
    ;;
  "set-active-profile")
    set_active_profile "${@:2}"
    ;;
  "get-active-profile")
    get_active_profile "${@:2}"
    ;;
  "add-drive")
    add_drive "${@:2}"
    ;;
  "remove-drive")
    remove_drive "${@:2}"
    ;;
  "list-drives")
    list_drives "${@:2}"
    ;;
  "apply-migrations")
    apply_migrations "${@:2}"
    ;;
  "health-check")
    health_check "${@:2}"
    ;;
  "help")
    show_help
    ;;
  *)
    echo "Error: Unknown command '$1'"
    show_help
    exit 1
    ;;
esac