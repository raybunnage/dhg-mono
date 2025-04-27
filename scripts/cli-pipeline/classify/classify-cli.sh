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
  echo -e "  classify-subjects          Apply subject classification to documents with processed content"
  echo -e "    -l, --limit <number>       Maximum number of documents to process (default: 10)"
  echo -e "    -e, --extensions <ext>     Filter by file extension(s), comma-separated (e.g., mp4,pdf,docx)"
  echo -e "    -x, --expert <name>        Filter by expert name"
  echo -e "    -t, --table <tableName>    Target table to classify (default: \"expert_documents\")"
  echo -e "    -s, --skip-classified      Skip documents that already have classifications"
  echo -e "    --concurrency <number>     Number of documents to process concurrently (default: 3)"
  echo -e "    --max-retries <number>     Maximum number of retries for failed API calls (default: 3)"
  echo -e "    --retry-delay <number>     Initial delay in milliseconds between retries (default: 1000)"
  echo -e "    --verbose                  Show detailed output"
  echo -e "    --dry-run                  Show what would be classified without making changes"
  echo ""
  echo -e "  extract-titles             Extract titles from MP4 files and update expert_documents"
  echo -e "    -l, --limit <number>       Maximum number of documents to process (default: 50)"
  echo -e "    -x, --expert <n>        Filter by expert name"
  echo -e "    --include-existing         Include documents that already have titles"
  echo -e "    --concurrency <number>     Number of documents to process concurrently (default: 3)"
  echo -e "    --max-retries <number>     Maximum number of retries for failed API calls (default: 3)"
  echo -e "    --retry-delay <number>     Initial delay in milliseconds between retries (default: 1000)"
  echo -e "    --verbose                  Show detailed output"
  echo -e "    --dry-run                  Show what would be extracted without making changes"
  echo -e ""
  echo -e "  check-mp4-titles           Check MP4 files for missing titles in expert_documents"
  echo -e "    -l, --limit <number>       Maximum number of MP4 files to check (default: 500)"
  echo -e "    -x, --expert <n>        Filter by expert name"
  echo -e "    --verbose                  Show detailed output including MP4 files without expert_documents"
  echo -e ""
  echo -e "  list-unclassified           List expert documents with processed content that haven't been classified"
  echo -e "    -l, --limit <number>       Maximum number of documents to list (0 for all)"
  echo -e "    -c, --with-content         Show content preview (only with --verbose)"
  echo -e "    -v, --verbose              Show detailed output including content preview"
  echo ""
  echo -e "\033[1mExamples:\033[0m"
  echo -e "  $ classify-cli list"
  echo -e "  $ classify-cli get 12345678-1234-5678-1234-567812345678"
  echo -e "  $ classify-cli create --name \"Medical\" --category \"Healthcare\""
  echo -e "  $ classify-cli update 12345678-1234-5678-1234-567812345678 --name \"Medicine\""
  echo -e "  $ classify-cli hierarchy -f json -o hierarchy.json"
  echo -e "  $ classify-cli health-check --verbose"
  echo -e "  $ classify-cli classify-subjects -l 5 -e mp4,pdf,docx,txt,pptx -s"
  echo -e "  $ classify-cli classify-subjects -l 100 -t expert_documents -s --verbose"
  echo -e "  $ classify-cli classify-subjects --concurrency 3 --max-retries 5 --retry-delay 2000 -l 30"
  echo -e "  $ classify-cli extract-titles -l 50 --verbose"
  echo -e "  $ classify-cli extract-titles -x \"Navieux\" --concurrency 3 --verbose"
  echo -e "  $ classify-cli check-mp4-titles -l 1000 --verbose"
  echo -e "  $ classify-cli check-mp4-titles -x \"Navieux\""
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

# Handle classify-subjects command
classify_subjects_command() {
  track_command "classify-subjects" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts classify-subjects $@"
}

# Handle extract-titles command
extract_titles_command() {
  track_command "extract-titles" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts extract-titles $@"
}

# Handle check-mp4-titles command
check_mp4_titles_command() {
  track_command "check-mp4-titles" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts check-mp4-titles $@"
}

# Handle debug-classification-status command
debug_classification_status_command() {
  track_command "debug-classification-status" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts debug-classification-status $@"
}

# Handle examine-document command
examine_document_command() {
  track_command "examine-document" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts examine-document $@"
}

# Handle list-unclassified command
list_unclassified_command() {
  track_command "list-unclassified" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts list-unclassified $@"
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
  "classify-subjects")
    classify_subjects_command "${@:2}"
    ;;
  "extract-titles")
    extract_titles_command "${@:2}"
    ;;
  "check-mp4-titles")
    check_mp4_titles_command "${@:2}"
    ;;
  "debug-classification-status")
    debug_classification_status_command "${@:2}"
    ;;
  "examine-document")
    examine_document_command "${@:2}"
    ;;
  "list-unclassified")
    list_unclassified_command "${@:2}"
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