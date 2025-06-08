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
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Track command usage
track_command() {
    local pipeline_name="merge"
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
    echo "  health-check            Run health check for merge pipeline"
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
    
    "health-check")
        track_command "health-check" "$SCRIPT_DIR/health-check.sh"
        ;;
    
    *)
        echo "Unknown command: $COMMAND"
        echo "Run './merge-cli.sh help' for usage information"
        exit 1
        ;;
  health-check)
    echo "🏥 Running health check for merge pipeline..."
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
      echo "❌ Missing required environment variables"
      exit 1
    fi
    echo "✅ merge pipeline is healthy"
    ;;
esac
