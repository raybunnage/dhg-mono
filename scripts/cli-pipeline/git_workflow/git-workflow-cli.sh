#!/bin/bash

# Git Workflow CLI Pipeline
# Critical git operations and workflow management

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Source the ManagementCLIPipeline base class
source "$SCRIPT_DIR/../base-classes/ManagementCLIPipeline.sh"

# Define pipeline-specific variables
PIPELINE_NAME="git_workflow"
PIPELINE_DESCRIPTION="Git Workflow CLI Pipeline - Critical git operations and workflow management"
PIPELINE_VERSION="3.0.0"

# Git workflow-specific commands array
declare -a GIT_WORKFLOW_COMMANDS=(
    "info:Show comprehensive git information"
    "status:Show git status"
    "worktree:List all git worktrees"
    "branch:Show current branch"
    "branches:List all branches (local and remote)"
    "create-branch:Create and checkout new branch"
    "test:Run test suite"
    "typecheck:Check TypeScript types"
    "lint:Run linter"
    "check-all:Run all pre-commit checks"
    "merge-to-dev:Merge current branch to development"
    "merge-to-main:Merge development to main (with confirmation)"
    "copy-env:Copy .env.development from another worktree"
    "clean-branches:Remove merged branches"
    "health-check:Check pipeline health"
)

# Initialize the pipeline
init_management_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" \
    --workflow-type "git" \
    --critical-operations "merge-to-main,merge-to-dev" \
    --validation-required "true"

# Command implementations
command_info() {
    print_info "Showing comprehensive git information..."
    
    if [ -f "$PROJECT_ROOT/scripts/root/get-git-info.sh" ]; then
        "$PROJECT_ROOT/scripts/root/get-git-info.sh"
    elif [ -f "$SCRIPT_DIR/git-info-detailed.ts" ]; then
        cd "$SCRIPT_DIR" && npx ts-node git-info-detailed.ts
    else
        # Fallback to basic git info
        echo "Branch: $(git branch --show-current)"
        echo "Status:"
        git status --short
    fi
}

command_status() {
    print_info "Git status:"
    git status
}

command_worktree() {
    print_info "Git Worktrees:"
    git worktree list
}

command_branch() {
    local current_branch=$(git branch --show-current)
    print_success "Current branch: $current_branch"
}

command_branches() {
    echo "Local branches:"
    git branch
    echo -e "\nRemote branches:"
    git branch -r
}

command_create_branch() {
    local branch_name="$1"
    
    if [ -z "$branch_name" ]; then
        print_error "Usage: $0 create-branch <branch-name>"
        return 1
    fi
    
    print_info "Creating and checking out branch: $branch_name"
    git checkout -b "$branch_name"
    print_success "Created and switched to branch: $branch_name"
}

command_test() {
    print_info "Running tests..."
    cd "$PROJECT_ROOT" && pnpm test:run
}

command_typecheck() {
    print_info "Checking TypeScript types..."
    cd "$PROJECT_ROOT" && tsc --noEmit
}

command_lint() {
    print_info "Running linter..."
    cd "$PROJECT_ROOT" && pnpm lint
}

command_check_all() {
    print_info "Running pre-commit checks..."
    cd "$PROJECT_ROOT"
    
    echo "1. TypeScript check..."
    if ! tsc --noEmit; then
        print_error "TypeScript check failed"
        return 1
    fi
    
    echo -e "\n2. Linting..."
    if ! pnpm lint; then
        print_error "Lint check failed"
        return 1
    fi
    
    echo -e "\n3. Running tests..."
    if ! pnpm test:run; then
        print_error "Tests failed"
        return 1
    fi
    
    print_success "All checks passed!"
}

command_merge_to_dev() {
    local current_branch=$(git branch --show-current)
    
    # Validate operation
    if ! validate_workflow_operation "merge-to-dev" "$current_branch"; then
        return 1
    fi
    
    print_info "Merging $current_branch to development..."
    
    # Create temporary branch for merge
    git checkout -b temp-merge-to-development origin/development
    git merge "$current_branch"
    git push origin temp-merge-to-development:development
    git checkout "$current_branch"
    git branch -d temp-merge-to-development
    
    print_success "Successfully merged $current_branch to development"
}

command_merge_to_main() {
    # Validate critical operation
    if ! validate_workflow_operation "merge-to-main" "development"; then
        return 1
    fi
    
    print_warning "This will merge development to main. Are you sure? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        git checkout -b temp-merge-to-main origin/main
        git merge origin/development
        git push origin temp-merge-to-main:main
        git checkout development
        git branch -d temp-merge-to-main
        print_success "Successfully merged development to main"
    else
        print_info "Merge cancelled"
    fi
}

command_copy_env() {
    local source_worktree="$1"
    
    if [ -z "$source_worktree" ]; then
        print_error "Usage: $0 copy-env <source-worktree-name>"
        echo "Example: $0 copy-env dhg-mono"
        return 1
    fi
    
    # Find source worktree path
    local source_path="/Users/raybunnage/Documents/github/$source_worktree"
    
    if [ ! -d "$source_path" ]; then
        print_error "Source worktree not found at $source_path"
        return 1
    fi
    
    # Copy .env.development
    if [ -f "$source_path/.env.development" ]; then
        cp "$source_path/.env.development" "$PROJECT_ROOT/.env.development"
        print_success "Copied .env.development from $source_worktree"
    else
        print_error ".env.development not found in $source_path"
        return 1
    fi
}

command_clean_branches() {
    print_info "Pruning merged branches..."
    git remote prune origin
    git branch --merged | grep -v "main\|development\|master" | xargs -n 1 git branch -d 2>/dev/null || true
    print_success "Cleaned up merged branches"
}

command_health_check() {
    print_info "Running health check for git_workflow pipeline..."
    
    # Check git availability
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed"
        return 1
    fi
    
    # Check if in git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        return 1
    fi
    
    # Check environment variables
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        print_warning "Missing Supabase environment variables"
    fi
    
    # Run base health check
    health_check
    
    print_success "git_workflow pipeline is healthy"
}

# Override show_help to add git workflow-specific information
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Git Information:"
    for cmd_desc in "${GIT_WORKFLOW_COMMANDS[@]}"; do
        IFS=':' read -r cmd desc <<< "$cmd_desc"
        case "$cmd" in
            info|status|worktree|branch|branches)
                printf "  %-20s %s\n" "$cmd" "$desc"
                ;;
        esac
    done
    
    echo ""
    echo "Branch Management:"
    printf "  %-20s %s\n" "create-branch" "Create and checkout new branch"
    
    echo ""
    echo "Testing & Validation:"
    for cmd_desc in "${GIT_WORKFLOW_COMMANDS[@]}"; do
        IFS=':' read -r cmd desc <<< "$cmd_desc"
        case "$cmd" in
            test|typecheck|lint|check-all)
                printf "  %-20s %s\n" "$cmd" "$desc"
                ;;
        esac
    done
    
    echo ""
    echo "Promotion Workflow:"
    printf "  %-20s %s\n" "merge-to-dev" "Merge current branch to development"
    printf "  %-20s %s\n" "merge-to-main" "Merge development to main (with confirmation)"
    
    echo ""
    echo "Environment Management:"
    printf "  %-20s %s\n" "copy-env" "Copy .env.development from another worktree"
    
    echo ""
    echo "Utility Commands:"
    printf "  %-20s %s\n" "clean-branches" "Remove merged branches"
    printf "  %-20s %s\n" "health-check" "Check pipeline health"
    
    echo ""
    echo "Examples:"
    echo "  $0 check-all           # Run all pre-commit checks"
    echo "  $0 merge-to-dev        # Merge current branch to development"
    echo "  $0 copy-env dhg-mono   # Copy env from main worktree"
}

# Main command routing
case "${1:-help}" in
    # Git information commands
    info|git-info)
        shift
        track_and_execute "info" command_info "$@"
        ;;
    status|git-status)
        shift
        track_and_execute "status" command_status "$@"
        ;;
    worktree|worktree-list)
        shift
        track_and_execute "worktree" command_worktree "$@"
        ;;
    branch|current-branch)
        shift
        track_and_execute "branch" command_branch "$@"
        ;;
    branches|list-branches)
        shift
        track_and_execute "branches" command_branches "$@"
        ;;
    create-branch)
        shift
        track_and_execute "create-branch" command_create_branch "$@"
        ;;
    # Testing commands
    test|run-tests)
        shift
        track_and_execute "test" command_test "$@"
        ;;
    typecheck|check-types)
        shift
        track_and_execute "typecheck" command_typecheck "$@"
        ;;
    lint|run-lint)
        shift
        track_and_execute "lint" command_lint "$@"
        ;;
    check-all|pre-commit)
        shift
        track_and_execute "check-all" command_check_all "$@"
        ;;
    # Promotion workflow
    merge-to-dev|promote-to-dev)
        shift
        track_and_execute "merge-to-dev" command_merge_to_dev "$@"
        ;;
    merge-to-main|promote-to-main)
        shift
        track_and_execute "merge-to-main" command_merge_to_main "$@"
        ;;
    # Environment management
    copy-env)
        shift
        track_and_execute "copy-env" command_copy_env "$@"
        ;;
    # Utility commands
    clean-branches|prune-branches)
        shift
        track_and_execute "clean-branches" command_clean_branches "$@"
        ;;
    health-check|health)
        shift
        track_and_execute "health-check" command_health_check "$@"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac