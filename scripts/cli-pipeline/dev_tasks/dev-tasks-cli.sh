#!/bin/bash

# Dev Tasks CLI - Claude Code Task Management
#
# Commands:
#   create       Create a new development task
#   create-with-branch  Create task with git branch
#   dhg-research Create a research task for Claude Code
#   start-session       Start work session on a task
#   list         List tasks with filtering options
#   submit       Submit task to Claude Code (tracks submission immediately)
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
  echo "  submit       Submit task to Claude Code (tracks submission immediately)"
  echo "  update       Update task status or details"
  echo "  complete     Mark task as complete with Claude's response"
  echo "  add-file     Add file references to a task"
  echo "  show         Show detailed task information"
  echo "  copy-request Format task for copying to Claude"
  echo "  commit       Commit changes with automatic task linking"
  echo "  assign-worktrees  Analyze commits to assign worktrees to tasks"
  echo "  create-summary      Create work summary with task link"
  echo "  track-validation    Track validation submission results"
  echo "  track-tests         Track test execution results"
  echo "  show-tracking       Show work summary tracking info"
  echo "  git-history-server  Start the Git History Analysis Server"
  echo "  success-criteria    Manage task success criteria"
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
  echo ""
  echo "  # Submit task to Claude Code (saves raw task for recovery)"
  echo "  ./dev-tasks-cli.sh submit <task-id> --text \"# Task: Fix auth bug...\""
  echo "  ./dev-tasks-cli.sh submit <task-id> --file task.md"
  echo "  echo \"# Task: Fix auth...\" | ./dev-tasks-cli.sh submit <task-id> --stdin"
  echo ""
  echo "  # Find interrupted Claude tasks"
  echo "  ./dev-tasks-cli.sh submit recover"
  echo "  ./dev-tasks-cli.sh submit recover my-worktree --minutes 60"
  echo ""
  echo "  # Create work summary linked to task"
  echo "  ./dev-tasks-cli.sh create-summary <task-id> --title \"Implemented feature\" --content \"Details...\""
  echo ""
  echo "  # Track validation and test results"
  echo "  ./dev-tasks-cli.sh track-validation <task-id> --status passed --summary \"All checks passed\""
  echo "  ./dev-tasks-cli.sh track-tests <task-id> --passed 45 --failed 5 --coverage 90"
  echo ""
  echo "  # Show comprehensive tracking info"
  echo "  ./dev-tasks-cli.sh show-tracking <task-id>"
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
    
  "git-history-server")
    track_command "dev-tasks" "git-history-server"
    echo "Starting Git History Analysis Server on port 3011..."
    node "$SCRIPT_DIR/git-history-server.js"
    ;;
    
  "success-criteria")
    track_command "dev-tasks" "success-criteria"
    shift
    ts-node "$SCRIPT_DIR/add-success-criteria.ts" "$@"
    ;;
    
  "submit")
    track_command "dev-tasks" "submit"
    shift
    ts-node "$SCRIPT_DIR/submit-task.ts" "$@"
    ;;
    
  health-check)
    echo "🏥 Running health check for dev_tasks pipeline..."
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
      echo "❌ Missing required environment variables"
      exit 1
    fi
    echo "✅ dev_tasks pipeline is healthy"
    ;;
  create-summary)
    track_command "dev-tasks" "create-summary"
    ts-node "$SCRIPT_DIR/commands/create-work-summary.ts" "${@:2}"
    ;;
  track-validation)
    track_command "dev-tasks" "track-validation"
    ts-node "$SCRIPT_DIR/commands/track-validation.ts" "${@:2}"
    ;;
  track-tests)
    track_command "dev-tasks" "track-tests"
    ts-node "$SCRIPT_DIR/commands/track-tests.ts" "${@:2}"
    ;;
  show-tracking)
    track_command "dev-tasks" "show-tracking"
    ts-node "$SCRIPT_DIR/commands/show-tracking.ts" "${@:2}"
    ;;
  *)
    echo "Unknown command: $1"
    echo "Run './dev-tasks-cli.sh help' for usage"
    exit 1
    ;;
esac
