#!/bin/bash

# Git Management CLI
# This script provides commands for managing git worktrees and merge operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the environment variables
source "$SCRIPT_DIR/../../core/load-env.sh"

# Function to track command usage
track_command() {
    local pipeline="git"
    local command="$1"
    shift
    
    # Run the tracking wrapper
    if [ -f "$SCRIPT_DIR/../database/tests/test-tracking-wrapper.sh" ]; then
        "$SCRIPT_DIR/../database/tests/test-tracking-wrapper.sh" "$pipeline" "$command" "$@"
    else
        # Fallback: run without tracking
        "$@"
    fi
}

# Function to display help
show_help() {
    echo "Git Management CLI"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list-worktrees                List all git worktrees"
    echo "  create-worktree              Create a new worktree"
    echo "  remove-worktree              Remove an existing worktree"
    echo "  worktree-status              Check status of all worktrees"
    echo "  merge-queue-add              Add branch to merge queue"
    echo "  merge-queue-list             List branches in merge queue"
    echo "  merge-queue-status           Check merge queue status"
    echo "  run-merge-checks             Run checks for a merge"
    echo "  start-merge                  Start merge process"
    echo "  update-from-source           Update branch from source"
    echo "  check-conflicts              Check for merge conflicts"
    echo "  health-check                 Run health check on git CLI"
    echo "  help                         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 list-worktrees"
    echo "  $0 create-worktree --branch feature/new-feature"
    echo "  $0 merge-queue-add --branch feature/my-feature --priority 1"
    echo ""
}

# Main command handling
case "$1" in
    "list-worktrees")
        track_command "list-worktrees" node --loader ts-node/esm "$SCRIPT_DIR/commands/list-worktrees.ts" "${@:2}"
        ;;
    "create-worktree")
        track_command "create-worktree" node --loader ts-node/esm "$SCRIPT_DIR/commands/create-worktree.ts" "${@:2}"
        ;;
    "remove-worktree")
        track_command "remove-worktree" node --loader ts-node/esm "$SCRIPT_DIR/commands/remove-worktree.ts" "${@:2}"
        ;;
    "worktree-status")
        track_command "worktree-status" node --loader ts-node/esm "$SCRIPT_DIR/commands/worktree-status.ts" "${@:2}"
        ;;
    "merge-queue-add")
        track_command "merge-queue-add" node --loader ts-node/esm "$SCRIPT_DIR/commands/merge-queue-add.ts" "${@:2}"
        ;;
    "merge-queue-list")
        track_command "merge-queue-list" node --loader ts-node/esm "$SCRIPT_DIR/commands/merge-queue-list.ts" "${@:2}"
        ;;
    "merge-queue-status")
        track_command "merge-queue-status" node --loader ts-node/esm "$SCRIPT_DIR/commands/merge-queue-status.ts" "${@:2}"
        ;;
    "run-merge-checks")
        track_command "run-merge-checks" node --loader ts-node/esm "$SCRIPT_DIR/commands/run-merge-checks.ts" "${@:2}"
        ;;
    "start-merge")
        track_command "start-merge" node --loader ts-node/esm "$SCRIPT_DIR/commands/start-merge.ts" "${@:2}"
        ;;
    "update-from-source")
        track_command "update-from-source" node --loader ts-node/esm "$SCRIPT_DIR/commands/update-from-source.ts" "${@:2}"
        ;;
    "check-conflicts")
        track_command "check-conflicts" node --loader ts-node/esm "$SCRIPT_DIR/commands/check-conflicts.ts" "${@:2}"
        ;;
    "health-check")
        track_command "health-check" node --loader ts-node/esm "$SCRIPT_DIR/commands/health-check.ts" "${@:2}"
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac