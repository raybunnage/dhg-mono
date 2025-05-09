#!/bin/bash
# Script to run the Document Types CLI
# Usage: ./document-types-cli.sh <command> [options]
#
# AVAILABLE COMMANDS:
#   list                         List all document types
#   get                          Get details of a document type
#   create                       Create a new document type
#   update                       Update an existing document type
#   delete                       Delete a document type
#   stats                        Get document type statistics
#   generate                     Generate a document type definition using AI
#   categories                   List all document type categories
#   help                         Show this help message

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${PROJECT_ROOT}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="document_types"
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

# Function to load environment variables
load_environment() {
  # Load environment variables from .env files in project root
  for env_file in "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.local" "$PROJECT_ROOT/.env.development"; do
    if [ -f "$env_file" ]; then
      echo "Loading environment variables from $env_file"
      set -o allexport
      source "$env_file"
      set +o allexport
    fi
  done
}

# Load environment variables
load_environment

# Handle specific commands
if [ "$1" = "list" ]; then
  shift
  track_command "list" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts list $*"
  exit $?
fi

if [ "$1" = "get" ]; then
  shift
  track_command "get" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts get $*"
  exit $?
fi

if [ "$1" = "create" ]; then
  shift
  # Properly handle arguments with spaces
  ARGS=""
  for ARG in "$@"; do
    ARGS="$ARGS \"$ARG\""
  done
  track_command "create" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts create $ARGS"
  exit $?
fi

if [ "$1" = "update" ]; then
  shift
  track_command "update" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts update $*"
  exit $?
fi

if [ "$1" = "delete" ]; then
  shift
  track_command "delete" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts delete $*"
  exit $?
fi

if [ "$1" = "stats" ]; then
  shift
  track_command "stats" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts stats $*"
  exit $?
fi

if [ "$1" = "generate" ]; then
  shift
  track_command "generate" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts generate $*"
  exit $?
fi

if [ "$1" = "categories" ]; then
  shift
  track_command "categories" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts categories $*"
  exit $?
fi

if [ "$1" = "health-check" ]; then
  shift
  track_command "health-check" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts health-check $*"
  exit $?
fi

if [ "$1" = "set-classifier" ]; then
  shift
  track_command "set-classifier" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts set-classifier $*"
  exit $?
fi

if [ "$1" = "cheatsheet" ]; then
  shift
  track_command "cheatsheet" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts cheatsheet $*"
  exit $?
fi

if [ "$1" = "review-and-reclassify" ]; then
  shift
  # Properly handle arguments with spaces
  ARGS=""
  for ARG in "$@"; do
    ARGS="$ARGS \"$ARG\""
  done
  track_command "review-and-reclassify" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/cli.ts review-and-reclassify $ARGS"
  exit $?
fi

if [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ -z "$1" ]; then
  # Show the help message
  echo "Document Types CLI - Manage document types"
  echo ""
  echo "USAGE:"
  echo "  ./document-types-cli.sh <command> [options]"
  echo ""
  echo "COMMANDS:"
  echo "  (* = frequently used commands based on usage statistics)"
  echo ""
  echo "LISTING & QUERYING:"
  echo "  * list                         List all document types (84 uses)"
  echo "  * get                          Get details of a document type (27 uses)"
  echo "    categories                   List all document type categories"
  echo "  * stats                        Get document type statistics"
  echo "    cheatsheet                   Generate document types cheatsheet markdown"
  echo ""
  echo "CREATION & MANAGEMENT:"
  echo "  * update                       Update an existing document type (34 uses)"
  echo "    create                       Create a new document type"
  echo "    delete                       Delete a document type"
  echo "  * set-classifier               Interactively set the document_classifier enum for document types (26 uses)"
  echo "    review-and-reclassify        Review and reclassify documents of a specific type using mnemonics"
  echo ""
  echo "AI ASSISTANCE:"
  echo "    generate                     Generate a document type definition using AI"
  echo ""
  echo "SYSTEM:"
  echo "  * health-check                 Check the health of document type services (49 uses)"
  echo "    help                         Show this help message"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "LISTING & QUERYING:"
  echo "  # List all document types"
  echo "  ./document-types-cli.sh list"
  echo ""
  echo "  # List document types in a specific category"
  echo "  ./document-types-cli.sh list --category \"Research\""
  echo ""
  echo "  # Get details of a specific document type"
  echo "  ./document-types-cli.sh get --id \"123e4567-e89b-12d3-a456-426614174000\""
  echo ""
  echo "  # Generate document types cheatsheet"
  echo "  ./document-types-cli.sh cheatsheet"
  echo ""
  echo "CREATION & MANAGEMENT:"
  echo "  # Update an existing document type"
  echo "  ./document-types-cli.sh update --id \"123e4567-e89b-12d3-a456-426614174000\" --category \"Updated Category\""
  echo ""
  echo "  # Create a new document type"
  echo "  ./document-types-cli.sh create --name \"Research Report\" --category \"Research\" --description \"Detailed research report\" --mnemonic \"RES\" --ai-generated --general-type"
  echo ""
  echo "  # Set the document_classifier enum for document types"
  echo "  ./document-types-cli.sh set-classifier"
  echo ""
  echo "  # Review and reclassify documents of a specific type"
  echo "  ./document-types-cli.sh review-and-reclassify --name \"Research Paper\""
  echo ""
  echo "SYSTEM:"
  echo "  # Check the health of document type services"
  echo "  ./document-types-cli.sh health-check"
  exit 0
fi

# If command is not recognized
echo "Error: Unknown command '$1'"
echo "Run './document-types-cli.sh help' to see available commands"
exit 1