#!/bin/bash

# Worktree CLI - Git worktree and merge management commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the common functions
source "$SCRIPT_DIR/../core/load-env.sh"

# Initialize command tracking
source "$SCRIPT_DIR/../core/command-history-tracker.sh"

# Help function
show_help() {
    cat << EOF
Worktree CLI - Git worktree and merge management commands

Usage: $0 <command> [options]

Worktree Commands:
    copy-env [--app <name>]         Copy .env.development files from source worktree
                                    Options:
                                      --app <name>  Also copy app-specific .env.development
                                    Examples:
                                      copy-env                    # Copy root .env.development only
                                      copy-env --app dhg-audio   # Copy root and app .env.development
    
    list, list-worktrees            List all git worktrees with their status

Merge Management Commands:
    merge-status [-b <branch>]      Check merge readiness for branches
                                    Options:
                                      -b <branch>  Check specific branch (default: current)
                                      -a, --all    Check all branches
                                      --json       Output in JSON format
    
    prepare-merge [-b <branch>]     Prepare branch for merge (update, test, etc.)
                                    Options:
                                      -b <branch>      Branch to prepare (default: current)
                                      --skip-tests     Skip running tests
                                      --skip-lint      Skip linter
                                      --skip-typecheck Skip TypeScript check
    
    merge-queue <action>            Manage the merge queue
                                    Actions:
                                      list             List queue (default)
                                      add              Add branch to queue
                                      remove           Remove from queue
                                      prioritize       Update priority
                                      next             Show next merge candidate
                                      dependencies     Manage dependencies
    
    execute-merge [-b <branch>]     Execute the merge into development
                                    Options:
                                      -b <branch>  Specific branch (default: next in queue)
                                      -y           Skip confirmations
    
    help                            Show this help message

Examples:
    $0 copy-env --app dhg-improve-experts
    $0 merge-status --all
    $0 prepare-merge
    $0 merge-queue add --branch feature/new-ui --priority 10
    $0 execute-merge

EOF
}

# Main command handling
case "$1" in
    copy-env)
        shift
        track_command "worktree" "copy-env" "$@"
        ts-node "$SCRIPT_DIR/copy-env.ts" "$@"
        ;;
        
    list|list-worktrees)
        shift
        track_command "worktree" "list-worktrees" "$@"
        ts-node "$SCRIPT_DIR/list-worktrees.ts" "$@"
        ;;
        
    merge-status)
        shift
        track_command "worktree" "merge-status" "$@"
        ts-node "$SCRIPT_DIR/merge-status.ts" "$@"
        ;;
        
    prepare-merge)
        shift
        track_command "worktree" "prepare-merge" "$@"
        ts-node "$SCRIPT_DIR/prepare-merge.ts" "$@"
        ;;
        
    merge-queue)
        shift
        track_command "worktree" "merge-queue" "$@"
        ts-node "$SCRIPT_DIR/merge-queue.ts" "$@"
        ;;
        
    execute-merge)
        shift
        track_command "worktree" "execute-merge" "$@"
        ts-node "$SCRIPT_DIR/execute-merge.ts" "$@"
        ;;
        
    help|--help|-h|"")
        show_help
        ;;
        
    *)
        echo "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac