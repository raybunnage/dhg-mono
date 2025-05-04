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
  echo -e "COMMANDS:"
  echo -e "  (* = frequently used commands based on usage statistics)"
  echo ""
  echo -e "\033[1mCLASSIFICATION OPERATIONS:\033[0m"
  echo -e "  * classify-subjects          Apply subject classification to documents with processed content (59 uses)"
  echo -e "    classify-source            Classify a specific source by its ID"
  echo -e "  * classify-remaining-experts Classify remaining expert documents using specialized filtering (11 uses)"
  echo -e ""
  echo -e "\033[1mTITLE MANAGEMENT:\033[0m"
  echo -e "  * extract-titles             Extract titles from MP4 files and update expert_documents (10 uses)"
  echo -e "  * check-mp4-titles           Check MP4 files for missing titles in expert_documents (12 uses)"
  echo -e ""
  echo -e "\033[1mLISTING & REPORTING:\033[0m"
  echo -e "  * list-unclassified          List expert documents without classifications (11 uses)"
  echo -e "    list                       List all subject classifications"
  echo -e "    get <id>                   Get a specific classification by ID"
  echo -e "    hierarchy                  Get hierarchical view of classifications"
  echo -e "    compare-presentations-assets Compare presentations against presentation_assets"
  echo -e ""
  echo -e "\033[1mSUBJECT MANAGEMENT:\033[0m"
  echo -e "    create                     Create a new classification"
  echo -e "    update <id>                Update an existing classification"
  echo -e "    delete <id>                Delete a classification"
  echo -e "    batch-create <file>        Create multiple classifications from a JSON file"
  echo -e ""
  echo -e "\033[1mSYSTEM:\033[0m"
  echo -e "  * health-check               Check the health of the classify service (6 uses)"
  echo -e ""
  echo -e "\033[1mCOMMON OPTIONS:\033[0m"
  echo -e "  -l, --limit <number>       Maximum items to process"
  echo -e "  -x, --expert <name>        Filter by expert name"
  echo -e "  -e, --extensions <ext>     Filter by file extension(s), comma-separated"
  echo -e "  --dry-run                  Preview changes without making them"
  echo -e "  --verbose                  Show detailed output"
  echo -e ""
  echo -e "\033[1mEXAMPLES:\033[0m"
  echo -e ""
  echo -e "CLASSIFICATION OPERATIONS:"
  echo -e "  # Classify documents with processed content"
  echo -e "  classify-cli classify-subjects -l 5 -e mp4,pdf,docx,txt,pptx -s"
  echo -e ""
  echo -e "  # Classify remaining expert documents"
  echo -e "  classify-cli classify-remaining-experts -l 5 --verbose"
  echo -e ""
  echo -e "TITLE MANAGEMENT:"
  echo -e "  # Extract titles from MP4 files"
  echo -e "  classify-cli extract-titles -l 50 --verbose"
  echo -e ""
  echo -e "  # Check MP4 files for missing titles"
  echo -e "  classify-cli check-mp4-titles -x \"Navieux\""
  echo -e ""
  echo -e "LISTING & REPORTING:"
  echo -e "  # List documents without classifications"
  echo -e "  classify-cli list-unclassified -l 20 --verbose"
  echo -e ""
  echo -e "  # Compare presentations against assets"
  echo -e "  classify-cli compare-presentations-assets --limit 25"
  echo -e ""
  echo -e "SUBJECT MANAGEMENT:"
  echo -e "  # Create a new classification"
  echo -e "  classify-cli create --name \"Medical\" --category \"Healthcare\""
  echo -e ""
  echo -e "SYSTEM:"
  echo -e "  # Check service health"
  echo -e "  classify-cli health-check --verbose"
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

# Handle classify-source command
classify_source_command() {
  track_command "classify-source" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts classify-source $@"
}

# Handle compare-presentations-assets command
compare_presentations_assets_command() {
  track_command "compare-presentations-assets" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts compare-presentations-assets $@"
}

# Handle classify-remaining-experts command
classify_remaining_experts_command() {
  track_command "classify-remaining-experts" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/index.ts classify-remaining-experts $@"
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
  "classify-source")
    classify_source_command "${@:2}"
    ;;
  "compare-presentations-assets")
    compare_presentations_assets_command "${@:2}"
    ;;
  "classify-remaining-experts")
    classify_remaining_experts_command "${@:2}"
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