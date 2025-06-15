#!/bin/bash

# Dev Tasks CLI - Claude Code Task Management
# Refactored version following simplified patterns

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="dev_tasks"
PIPELINE_DESCRIPTION="Development task management with Claude Code integration"
PIPELINE_VERSION="2.0.0"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [[ -f "$ENV_DEV_FILE" ]]; then
    echo "ℹ️  INFO [$PIPELINE_NAME] Loading environment variables from .env.development..."
    # Use a safer method to export environment variables
    while IFS='=' read -r key value; do
        if [[ $key =~ ^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY) ]]; then
            export "$key=$value"
        fi
    done < <(grep -E "^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY)" "$ENV_DEV_FILE" | grep -v '^#')
fi

# Logging functions
log_info() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  INFO [$PIPELINE_NAME] $*"
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ ERROR [$PIPELINE_NAME] $*" >&2
}

log_success() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ SUCCESS [$PIPELINE_NAME] $*"
}

log_warning() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  WARNING [$PIPELINE_NAME] $*"
}

# Command tracking wrapper
track_command() {
    local command="$1"
    if [[ -f "$SCRIPT_DIR/../core/command-history-tracker.ts" ]]; then
        ts-node "$SCRIPT_DIR/../core/command-history-tracker.ts" "other" "$PIPELINE_NAME" "$command" &
    fi
}

# Execute TypeScript command with tracking
execute_ts_command() {
    local command="$1"
    local script="$2"
    shift 2
    
    log_info "Executing: $command"
    track_command "$command"
    
    if [[ ! -f "$script" ]]; then
        log_error "TypeScript file not found: $script"
        return 1
    fi
    
    ts-node "$script" "$@"
}

# Health check command
cmd_health_check() {
    log_info "Running health check for $PIPELINE_NAME pipeline..."
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Check TypeScript files exist
    local required_files=(
        "create-task.ts"
        "list-tasks.ts"
        "update-task.ts"
        "submit-task.ts"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/$file" ]]; then
            log_warning "Missing TypeScript file: $file"
        fi
    done
    
    log_success "$PIPELINE_NAME pipeline is healthy"
    return 0
}

# Show help
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
    echo ""
    echo "TASK MANAGEMENT:"
    echo "  create              Create a new development task"
    echo "  create-with-branch  Create task with git branch"
    echo "  dhg-research        Create a research task for Claude Code"
    echo "  start-session       Start work session on a task"
    echo "  list                List tasks with filtering options"
    echo "  update              Update task status or details"
    echo "  complete            Mark task as complete with Claude's response"
    echo "  show                Show detailed task information"
    echo ""
    echo "CLAUDE CODE INTEGRATION:"
    echo "  submit              Submit task to Claude Code (tracks submission)"
    echo "  copy-request        Format task for copying to Claude"
    echo "  backfill-submissions Backfill Claude submission data"
    echo ""
    echo "GIT INTEGRATION:"
    echo "  commit              Commit changes with automatic task linking"
    echo "  add-file            Add file references to a task"
    echo "  assign-worktrees    Analyze commits to assign worktrees"
    echo ""
    echo "TRACKING & REPORTING:"
    echo "  create-summary      Create work summary with task link"
    echo "  track-validation    Track validation submission results"
    echo "  track-tests         Track test execution results"
    echo "  show-tracking       Show work summary tracking info"
    echo "  success-criteria    Manage task success criteria"
    echo ""
    echo "UTILITIES:"
    echo "  git-history-server  Start the Git History Analysis Server"
    echo "  health-check        Run health check for dev tasks pipeline"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  # Create task with git branch"
    echo "  $(basename "$0") create-with-branch \"Fix auth flow\" \"Users can't login\" --type bug"
    echo ""
    echo "  # Submit task to Claude"
    echo "  $(basename "$0") submit <task-id> --text \"# Task: Fix auth bug...\""
    echo ""
    echo "  # Commit with task linking"
    echo "  $(basename "$0") commit \"Fix authentication bug\""
}

# Main command handler
main() {
    case "${1:-help}" in
        help|--help|-h)
            show_help
            ;;
            
        health-check)
            cmd_health_check
            ;;
            
        # Task Management
        create)
            shift
            execute_ts_command "create" "$SCRIPT_DIR/create-task.ts" "$@"
            ;;
        create-with-branch)
            shift
            execute_ts_command "create-with-branch" "$SCRIPT_DIR/create-with-branch.ts" "$@"
            ;;
        dhg-research)
            shift
            execute_ts_command "dhg-research" "$SCRIPT_DIR/dhg-research.ts" "$@"
            ;;
        start-session)
            shift
            execute_ts_command "start-session" "$SCRIPT_DIR/start-session.ts" "$@"
            ;;
        list)
            shift
            execute_ts_command "list" "$SCRIPT_DIR/list-tasks.ts" "$@"
            ;;
        update)
            shift
            execute_ts_command "update" "$SCRIPT_DIR/update-task.ts" "$@"
            ;;
        complete)
            shift
            execute_ts_command "complete" "$SCRIPT_DIR/complete-task.ts" "$@"
            ;;
        show)
            shift
            execute_ts_command "show" "$SCRIPT_DIR/show-task.ts" "$@"
            ;;
            
        # Claude Code Integration
        submit)
            shift
            execute_ts_command "submit" "$SCRIPT_DIR/submit-task.ts" "$@"
            ;;
        copy-request)
            shift
            execute_ts_command "copy-request" "$SCRIPT_DIR/copy-request.ts" "$@"
            ;;
        backfill-submissions)
            shift
            execute_ts_command "backfill-submissions" "$SCRIPT_DIR/backfill-claude-submissions.ts" "$@"
            ;;
            
        # Git Integration
        commit)
            shift
            execute_ts_command "commit" "$SCRIPT_DIR/commit-with-task.ts" "$@"
            ;;
        add-file)
            shift
            execute_ts_command "add-file" "$SCRIPT_DIR/add-file.ts" "$@"
            ;;
        assign-worktrees)
            shift
            execute_ts_command "assign-worktrees" "$SCRIPT_DIR/analyze-commits-assign-worktrees.ts" "$@"
            ;;
            
        # Tracking & Reporting
        create-summary)
            shift
            execute_ts_command "create-summary" "$SCRIPT_DIR/create-work-summary.ts" "$@"
            ;;
        track-validation)
            shift
            execute_ts_command "track-validation" "$SCRIPT_DIR/track-validation.ts" "$@"
            ;;
        track-tests)
            shift
            execute_ts_command "track-tests" "$SCRIPT_DIR/track-tests.ts" "$@"
            ;;
        show-tracking)
            shift
            execute_ts_command "show-tracking" "$SCRIPT_DIR/show-tracking.ts" "$@"
            ;;
        success-criteria)
            shift
            execute_ts_command "success-criteria" "$SCRIPT_DIR/success-criteria.ts" "$@"
            ;;
            
        # Utilities
        git-history-server)
            shift
            execute_ts_command "git-history-server" "$SCRIPT_DIR/git-history-server.ts" "$@"
            ;;
            
        *)
            log_error "Unknown command: $1"
            echo "Run '$(basename "$0") help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"