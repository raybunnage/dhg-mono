#!/bin/bash

# Git Management CLI
# This script provides commands for managing git worktrees and merge operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Function to track command usage
track_command() {
    local pipeline_name="git"
    local command_name="$1"
    shift
    local full_command="$@"
    
    local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
    if [ -f "$TRACKER_TS" ]; then
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
    else
        echo "ℹ️ Tracking not available. Running command directly."
        eval "$full_command"
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
        track_command "health-check" "$SCRIPT_DIR/health-check.sh ${@:2}"
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
  health-check)
    echo "🏥 Running health check for git pipeline..."
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
      echo "❌ Missing required environment variables"
      exit 1
    fi
    echo "✅ git pipeline is healthy"
    ;;
esac
