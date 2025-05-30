#!/bin/bash

# Refactor Tracking CLI - Track google sync command refactoring progress
#
# This CLI helps manage the refactoring status of google sync commands
#
# Commands:
#   status                    Show overall refactoring status
#   list                      List all commands with their current status
#   update                    Update status of a command
#   test-complete            Mark a command as tested with results
#   sign-off                 Sign off on a command as complete
#   show                     Show details for a specific command
#   needs-work               List commands that need attention
#   help                     Show this help message

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment files directly
if [ -f "$ROOT_DIR/.env" ]; then
  export $(cat "$ROOT_DIR/.env" | grep -v '^#' | xargs)
fi
if [ -f "$ROOT_DIR/.env.local" ]; then
  export $(cat "$ROOT_DIR/.env.local" | grep -v '^#' | xargs)
fi
if [ -f "$ROOT_DIR/.env.development" ]; then
  export $(cat "$ROOT_DIR/.env.development" | grep -v '^#' | xargs)
fi

# Function to track command execution
track_command() {
  local command_name="$1"
  local full_command="$2"
  
  echo "Executing: $full_command" >&2
  eval "$full_command"
}

# Show help if no arguments
if [ $# -eq 0 ] || [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Refactor Tracking CLI - Track google sync command refactoring progress"
  echo ""
  echo "Usage: ./refactor-tracking-cli.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  status [--pipeline <name>] Show refactoring status (filter by pipeline)"
  echo "  list [--type <type>] [--pipeline <name>]  List commands (filter by type/pipeline)"
  echo "  update <name> <status>    Update command status"
  echo "  test-complete <name>      Mark command as tested with results"
  echo "  sign-off <name>          Sign off on a command"
  echo "  show <name>              Show details for a command"
  echo "  needs-work               List commands needing attention"
  echo "  add-note <name>          Add a note to a command"
  echo ""
  echo "Status values: not_started, in_progress, needs_testing, tested, signed_off, archived"
  exit 0
fi

# Route commands
case "$1" in
  "status")
    shift
    track_command "refactor-status" "ts-node $SCRIPT_DIR/show-status.ts $*"
    ;;
    
  "list")
    shift
    track_command "refactor-list" "ts-node $SCRIPT_DIR/list-commands.ts $*"
    ;;
    
  "update")
    shift
    track_command "refactor-update" "ts-node $SCRIPT_DIR/update-status.ts $*"
    ;;
    
  "test-complete")
    shift
    track_command "refactor-test-complete" "ts-node $SCRIPT_DIR/mark-tested.ts $*"
    ;;
    
  "sign-off")
    shift
    track_command "refactor-sign-off" "ts-node $SCRIPT_DIR/sign-off-command.ts $*"
    ;;
    
  "show")
    shift
    track_command "refactor-show" "ts-node $SCRIPT_DIR/show-command.ts $*"
    ;;
    
  "needs-work")
    shift
    track_command "refactor-needs-work" "ts-node $SCRIPT_DIR/needs-work.ts $*"
    ;;
    
  "add-note")
    shift
    track_command "refactor-add-note" "ts-node $SCRIPT_DIR/add-note.ts $*"
    ;;
    
  *)
    echo "Unknown command: $1"
    echo "Run './refactor-tracking-cli.sh help' for usage"
    exit 1
    ;;
esac