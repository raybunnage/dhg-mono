#!/usr/bin/env bash

# git-cli.sh - Migrated to CLI Pipeline Framework
# Git Management CLI - worktrees and merge operations

# Source the base class
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../base-classes/ServiceCLIPipeline.sh"

# Pipeline configuration
PIPELINE_NAME="git"
PIPELINE_DESCRIPTION="Git Management CLI - worktrees and merge operations"
PIPELINE_VERSION="2.0.0"

# Initialize pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Service setup
setup_service_integrations() {
    # Check for git operations service
    if check_service_available "git-operations-service"; then
        log_success "Git operations service available"
    else
        log_warn "Git operations service not available - using direct git commands"
    fi
}

# Initialize services
setup_service_integrations

# Command: list-worktrees - List all git worktrees
command_list_worktrees() {
    local description="List all git worktrees"
    
    track_and_execute "list_worktrees" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/list-worktrees.ts" "$@"
}

# Command: create-worktree - Create a new worktree
command_create_worktree() {
    local description="Create a new worktree"
    
    track_and_execute "create_worktree" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/create-worktree.ts" "$@"
}

# Command: remove-worktree - Remove an existing worktree
command_remove_worktree() {
    local description="Remove an existing worktree"
    
    track_and_execute "remove_worktree" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/remove-worktree.ts" "$@"
}

# Command: worktree-status - Check status of all worktrees
command_worktree_status() {
    local description="Check status of all worktrees"
    
    track_and_execute "worktree_status" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/worktree-status.ts" "$@"
}

# Command: merge-queue-add - Add branch to merge queue
command_merge_queue_add() {
    local description="Add branch to merge queue"
    
    track_and_execute "merge_queue_add" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/merge-queue-add.ts" "$@"
}

# Command: merge-queue-list - List branches in merge queue
command_merge_queue_list() {
    local description="List branches in merge queue"
    
    track_and_execute "merge_queue_list" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/merge-queue-list.ts" "$@"
}

# Command: merge-queue-status - Check merge queue status
command_merge_queue_status() {
    local description="Check merge queue status"
    
    track_and_execute "merge_queue_status" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/merge-queue-status.ts" "$@"
}

# Command: run-merge-checks - Run checks for a merge
command_run_merge_checks() {
    local description="Run checks for a merge"
    
    track_and_execute "run_merge_checks" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/run-merge-checks.ts" "$@"
}

# Command: start-merge - Start merge process
command_start_merge() {
    local description="Start merge process"
    
    track_and_execute "start_merge" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/start-merge.ts" "$@"
}

# Command: update-from-source - Update branch from source
command_update_from_source() {
    local description="Update branch from source"
    
    track_and_execute "update_from_source" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/update-from-source.ts" "$@"
}

# Command: check-conflicts - Check for merge conflicts
command_check_conflicts() {
    local description="Check for merge conflicts"
    
    track_and_execute "check_conflicts" "$description" \
        node --loader ts-node/esm "$SCRIPT_DIR/commands/check-conflicts.ts" "$@"
}

# Command: health-check - Run health check on git CLI
command_health_check() {
    local description="Run health check on git CLI"
    
    if [[ -f "$SCRIPT_DIR/health-check.sh" ]]; then
        track_and_execute "health_check" "$description" \
            "$SCRIPT_DIR/health-check.sh" "$@"
    else
        # Basic health check
        log_info "🏥 Running health check for git pipeline..."
        
        # Check git availability
        if command -v git &> /dev/null; then
            log_success "Git command available"
        else
            log_error "Git command not found"
            return 1
        fi
        
        # Check if in git repository
        if git rev-parse --git-dir &> /dev/null; then
            log_success "In a git repository"
        else
            log_error "Not in a git repository"
            return 1
        fi
        
        log_success "✅ Git pipeline is healthy"
    fi
}

# Override show_help to add command-specific details
show_help() {
    echo -e "${BLUE}Git Management CLI${NC}"
    echo ""
    echo "USAGE:"
    echo "  $0 <command> [options]"
    echo ""
    echo "COMMANDS:"
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
    echo "GLOBAL OPTIONS:"
    echo "  --debug                      Enable debug mode"
    echo "  --verbose                    Enable verbose output"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 list-worktrees"
    echo "  $0 create-worktree --branch feature/new-feature"
    echo "  $0 merge-queue-add --branch feature/my-feature --priority 1"
}

# Handle hyphenated commands
case "$1" in
    list-worktrees)
        shift
        command_list_worktrees "$@"
        ;;
    create-worktree)
        shift
        command_create_worktree "$@"
        ;;
    remove-worktree)
        shift
        command_remove_worktree "$@"
        ;;
    worktree-status)
        shift
        command_worktree_status "$@"
        ;;
    merge-queue-add)
        shift
        command_merge_queue_add "$@"
        ;;
    merge-queue-list)
        shift
        command_merge_queue_list "$@"
        ;;
    merge-queue-status)
        shift
        command_merge_queue_status "$@"
        ;;
    run-merge-checks)
        shift
        command_run_merge_checks "$@"
        ;;
    start-merge)
        shift
        command_start_merge "$@"
        ;;
    update-from-source)
        shift
        command_update_from_source "$@"
        ;;
    check-conflicts)
        shift
        command_check_conflicts "$@"
        ;;
    health-check)
        shift
        command_health_check "$@"
        ;;
    *)
        # Let base class handle standard routing
        route_command "$@"
        ;;
esac