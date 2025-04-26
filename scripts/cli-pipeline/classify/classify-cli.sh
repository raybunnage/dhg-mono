#!/bin/bash
# Master script for the classify CLI with detailed help

# Set script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${PROJECT_ROOT}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="classify"
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

# Function to display help
function display_help() {
  echo -e "\033[1mClassify Pipeline CLI\033[0m"
  echo -e "===================="
  echo ""
  echo -e "The classify pipeline provides commands for managing subject classifications in the system."
  echo -e "It allows creating, updating, and organizing classification hierarchies."
  echo ""
  echo -e "\033[1mAvailable Commands:\033[0m"
  echo -e "  list                       List all subject classifications"
  echo -e "    -c, --category <category>  Filter by category"
  echo -e "    -f, --format <format>      Output format (table, json)"
  echo -e "    -o, --output-file <path>   Path to write output to"
  echo ""
  echo -e "  get <id>                   Get a specific classification by ID"
  echo -e "    -f, --format <format>      Output format (table, json)"
  echo ""
  echo -e "  create                     Create a new classification"
  echo -e "    -n, --name <name>          Classification name (required)"
  echo -e "    -d, --description <desc>   Classification description"
  echo -e "    -c, --category <category>  Classification category"
  echo -e "    -p, --parent-id <id>       Parent classification ID"
  echo -e "    --inactive                 Set as inactive (default is active)"
  echo ""
  echo -e "  update <id>                Update an existing classification"
  echo -e "    -n, --name <name>          New classification name"
  echo -e "    -d, --description <desc>   New classification description"
  echo -e "    -c, --category <category>  New classification category"
  echo -e "    -p, --parent-id <id>       New parent classification ID"
  echo -e "    --active <bool>            Set active status (true/false)"
  echo ""
  echo -e "  delete <id>                Delete a classification"
  echo -e "    --force                    Force deletion without confirmation"
  echo ""
  echo -e "  hierarchy                  Get hierarchical view of classifications"
  echo -e "    -f, --format <format>      Output format (tree, json)"
  echo -e "    -o, --output-file <path>   Path to write output to"
  echo ""
  echo -e "  batch-create <file>        Create multiple classifications from a JSON file"
  echo -e "    --dry-run                  Show what would be created without actually creating"
  echo ""
  echo -e "  health-check               Check the health of the classify service"
  echo -e "    --verbose                  Show detailed output"
  echo ""
  echo -e "\033[1mExamples:\033[0m"
  echo -e "  $ classify-cli list"
  echo -e "  $ classify-cli get 12345678-1234-5678-1234-567812345678"
  echo -e "  $ classify-cli create --name \"Medical\" --category \"Healthcare\""
  echo -e "  $ classify-cli update 12345678-1234-5678-1234-567812345678 --name \"Medicine\""
  echo -e "  $ classify-cli hierarchy -f json -o hierarchy.json"
  echo -e "  $ classify-cli health-check --verbose"
}

# Handle list command
list_command() {
  track_command "list" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts list $@"
}

# Handle get command
get_command() {
  track_command "get" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts get $@"
}

# Handle create command
create_command() {
  track_command "create" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts create $@"
}

# Handle update command
update_command() {
  track_command "update" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts update $@"
}

# Handle delete command
delete_command() {
  track_command "delete" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts delete $@"
}

# Handle hierarchy command
hierarchy_command() {
  track_command "hierarchy" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts hierarchy $@"
}

# Handle batch-create command
batch_create_command() {
  track_command "batch-create" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts batch-create $@"
}

# Handle health-check command
health_check_command() {
  track_command "health-check" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts health-check $@"
}

# Direct handling of health-check command for better error output
if [[ "$1" == "health-check" ]]; then
  health_check_command "${@:2}"
  exit $?
fi

# Process command
case "$1" in
  "list")
    list_command "${@:2}"
    ;;
  "get")
    get_command "${@:2}"
    ;;
  "create")
    create_command "${@:2}"
    ;;
  "update")
    update_command "${@:2}"
    ;;
  "delete")
    delete_command "${@:2}"
    ;;
  "hierarchy")
    hierarchy_command "${@:2}"
    ;;
  "batch-create")
    batch_create_command "${@:2}"
    ;;
  "health-check")
    health_check_command "${@:2}"
    ;;
  "help"|"--help"|"-h"|"")
    display_help
    ;;
  *)
    echo "Unknown command: $1"
    echo "Run 'classify-cli help' to see available commands"
    exit 1
    ;;
esac