#!/bin/bash

# Worktree CLI - Git worktree management commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the common functions
source "$SCRIPT_DIR/../core/load-env.sh"

# Initialize command tracking
source "$SCRIPT_DIR/../core/command-history-tracker.sh"

# Help function
show_help() {
    cat << EOF
Worktree CLI - Git worktree management commands

Usage: $0 <command> [options]

Commands:
    copy-env [--app <name>]         Copy .env.development files from source worktree
                                    Options:
                                      --app <name>  Also copy app-specific .env.development
                                    Examples:
                                      copy-env                    # Copy root .env.development only
                                      copy-env --app dhg-audio   # Copy root and app .env.development
    
    list, list-worktrees            List all git worktrees with their status
    
    help                            Show this help message

Examples:
    $0 copy-env --app dhg-improve-experts
    $0 list-worktrees

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
        
    help|--help|-h|"")
        show_help
        ;;
        
    *)
        echo "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac