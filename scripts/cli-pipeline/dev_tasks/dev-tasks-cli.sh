#!/bin/bash

# Dev Tasks CLI - Claude Code Task Management
#
# Commands:
#   create       Create a new development task
#   create-with-branch  Create task with git branch
#   dhg-research Create a research task for Claude Code
#   start-session       Start work session on a task
#   list         List tasks with filtering options

#   update       Update task status or details
#   complete     Mark task as complete with Claude's response
#   add-file     Add file references to a task
#   show         Show detailed task information
#   copy-request Format task for copying to Claude
#   commit       Commit changes with automatic task linking
#   help         Show this help message

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Command tracking function
track_command() {
  local command="$1"
  local subcommand="$2"
  ts-node "$SCRIPT_DIR/../core/command-history-tracker.ts" "other" "dev-tasks" "$command" &
}

# Show help if no arguments
if [ $# -eq 0 ] || [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Dev Tasks CLI - Claude Code Task Management"
  echo ""
  echo "Usage: ./dev-tasks-cli.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  create       Create a new development task"
  echo "  create-with-branch  Create task with git branch"
  echo "  dhg-research Create a research task for Claude Code"
  echo "  start-session       Start work session on a task"
  echo "  list         List tasks with filtering options"
  echo "  update       Update task status or details"
  echo "  complete     Mark task as complete with Claude's response"
  echo "  add-file     Add file references to a task"
  echo "  show         Show detailed task information"
  echo "  copy-request Format task for copying to Claude"
  echo "  commit       Commit changes with automatic task linking"
  echo "  assign-worktrees  Analyze commits to assign worktrees to tasks"
  echo "  health-check Run health check for dev tasks pipeline"
  echo ""
  echo "Examples:"
  echo "  # Create a new task with git branch"
  echo "  ./dev-tasks-cli.sh create-with-branch \"Fix auth flow\" \"Users can't login\" --type bug --priority high"
  echo ""
  echo "  # Start working on a task (switches to its branch)"
  echo "  ./dev-tasks-cli.sh start-session <task-id>"
  echo ""
  echo "  # Create a regular task (no branch)"
  echo "  ./dev-tasks-cli.sh create --title \"Fix auth flow\" --description \"Users can't login\" --type bug --priority high"
  echo ""
  echo "  # List pending tasks"
  echo "  ./dev-tasks-cli.sh list --status pending"
  echo ""
  echo "  # Update task status"
  echo "  ./dev-tasks-cli.sh update <task-id> --status in_progress"
  echo ""
  echo "  # Complete task with Claude's response"
  echo "  ./dev-tasks-cli.sh complete <task-id> --response \"Fixed by updating OAuth config...\""
  echo ""
  echo "  # Add affected files"
  echo "  ./dev-tasks-cli.sh add-file <task-id> --path \"src/auth/oauth.ts\" --action modified"
  echo ""
  echo "  # Show task details and copy-friendly format"
  echo "  ./dev-tasks-cli.sh show <task-id>"
  echo "  ./dev-tasks-cli.sh copy-request <task-id>"
  echo ""
  echo "  # Commit with automatic task linking"
  echo "  ./dev-tasks-cli.sh commit \"Fix authentication bug in OAuth flow\""
  exit 0
fi

# Route commands
case "$1" in
  "create")
    track_command "dev-tasks" "create"
    shift
    ts-node "$SCRIPT_DIR/create-task.ts" "$@"
    ;;
    
  "create-with-branch")
    track_command "dev-tasks" "create-with-branch"
    shift
    ts-node "$SCRIPT_DIR/create-with-branch.ts" "$@"
    ;;
    
  "start-session")
    track_command "dev-tasks" "start-session"
    shift
    ts-node "$SCRIPT_DIR/start-session.ts" "$@"
    ;;
    
  "list")
    track_command "dev-tasks" "list"
    shift
    ts-node "$SCRIPT_DIR/list-tasks.ts" "$@"
    ;;
    
  "update")
    track_command "dev-tasks" "update"
    shift
    ts-node "$SCRIPT_DIR/update-task.ts" "$@"
    ;;
    
  "complete")
    track_command "dev-tasks" "complete"
    shift
    ts-node "$SCRIPT_DIR/complete-task.ts" "$@"
    ;;
    
  "add-file")
    track_command "dev-tasks" "add-file"
    shift
    ts-node "$SCRIPT_DIR/add-file.ts" "$@"
    ;;
    
  "show")
    track_command "dev-tasks" "show"
    shift
    ts-node "$SCRIPT_DIR/show-task.ts" "$@"
    ;;
    
  "copy-request")
    track_command "dev-tasks" "copy-request"
    shift
    ts-node "$SCRIPT_DIR/copy-request.ts" "$@"
    ;;
    
  "health-check")
    track_command "dev-tasks" "health-check"
    "$SCRIPT_DIR/health-check.sh"
    ;;
    
  "dhg-research")
    track_command "dev-tasks" "dhg-research"
    shift
    ts-node "$SCRIPT_DIR/dhg-research.ts" "$@"
    ;;
    
  "commit")
    track_command "dev-tasks" "commit"
    shift
    ts-node "$SCRIPT_DIR/commit-with-task.ts" "$@"
    ;;
    
  "assign-worktrees")
    track_command "dev-tasks" "assign-worktrees"
    shift
    ts-node "$SCRIPT_DIR/commands/assign-worktrees.ts" "$@"
    ;;
    
  *)
    echo "Unknown command: $1"
    echo "Run './dev-tasks-cli.sh help' for usage"
    exit 1
    ;;
  health-check)
    echo "🏥 Running health check for dev_tasks pipeline..."
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
      echo "❌ Missing required environment variables"
      exit 1
    fi
    echo "✅ dev_tasks pipeline is healthy"
    ;;
esac
