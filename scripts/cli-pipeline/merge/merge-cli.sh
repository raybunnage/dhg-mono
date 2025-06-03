#!/bin/bash

# Merge Management CLI - Manage feature branch merging workflow
#
# Commands:
#   queue-add         Add a branch to the merge queue
#   queue-list        List branches in merge queue
#   queue-status      Check status of a branch in queue
#   check-conflicts   Check for merge conflicts
#   run-checks        Run pre-merge validation checks
#   start-merge       Start merging a branch
#   complete-merge    Mark a merge as complete
#   queue-remove      Remove a branch from queue
#   help              Show this help message

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the environment
source "$ROOT_DIR/scripts/cli-pipeline/core/load-env.sh"

# Track command usage
track_command() {
    local command="$1"
    ts-node "$SCRIPT_DIR/../all_pipelines/track-command.ts" "merge" "$command" &
}

# Show help if no arguments
if [ $# -eq 0 ] || [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Merge Management CLI - Manage feature branch merging workflow"
    echo ""
    echo "Usage: ./merge-cli.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  queue-add <branch>      Add a branch to the merge queue"
    echo "  queue-list              List all branches in merge queue"
    echo "  queue-status <branch>   Check status of a branch"
    echo "  check-conflicts <branch> Check for merge conflicts"
    echo "  run-checks <branch>     Run pre-merge validation"
    echo "  start-merge <branch>    Start merging a branch"
    echo "  complete-merge <branch> Mark merge as complete"
    echo "  queue-remove <branch>   Remove branch from queue"
    echo ""
    echo "Options:"
    echo "  --priority <n>     Set priority (0-10, higher = sooner)"
    echo "  --task-id <id>     Associate with a dev task"
    echo "  --target <branch>  Target branch (default: development)"
    echo ""
    echo "Examples:"
    echo "  ./merge-cli.sh queue-add feature/my-feature --priority 5"
    echo "  ./merge-cli.sh check-conflicts feature/my-feature"
    echo "  ./merge-cli.sh queue-list"
    exit 0
fi

# Get command
COMMAND="$1"
shift

# Track the command
track_command "$COMMAND"

# Execute command
case "$COMMAND" in
    "queue-add")
        echo "Adding branch to merge queue..."
        ts-node "$SCRIPT_DIR/queue-add.ts" "$@"
        ;;
    
    "queue-list")
        echo "Listing merge queue..."
        ts-node "$SCRIPT_DIR/queue-list.ts" "$@"
        ;;
    
    "queue-status")
        echo "Checking queue status..."
        ts-node "$SCRIPT_DIR/queue-status.ts" "$@"
        ;;
    
    "check-conflicts")
        echo "Checking for merge conflicts..."
        ts-node "$SCRIPT_DIR/check-conflicts.ts" "$@"
        ;;
    
    "run-checks")
        echo "Running pre-merge checks..."
        ts-node "$SCRIPT_DIR/run-checks.ts" "$@"
        ;;
    
    "start-merge")
        echo "Starting merge process..."
        ts-node "$SCRIPT_DIR/start-merge.ts" "$@"
        ;;
    
    "complete-merge")
        echo "Completing merge..."
        ts-node "$SCRIPT_DIR/complete-merge.ts" "$@"
        ;;
    
    "queue-remove")
        echo "Removing from queue..."
        ts-node "$SCRIPT_DIR/queue-remove.ts" "$@"
        ;;
    
    *)
        echo "Unknown command: $COMMAND"
        echo "Run './merge-cli.sh help' for usage information"
        exit 1
        ;;
esac