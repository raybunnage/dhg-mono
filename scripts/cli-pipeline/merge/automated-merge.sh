#!/bin/bash

# Automated Merge Workflow Script
# This script automates the sequential merge process for feature branches

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MERGE_CLI="$SCRIPT_DIR/merge-cli.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to run a merge workflow for a branch
run_merge_workflow() {
    local branch=$1
    local priority=${2:-0}
    
    print_status "$CYAN" "\\n=== Starting merge workflow for '$branch' ==="
    
    # Step 1: Add to queue if not already there
    print_status "$BLUE" "\\n1. Adding to merge queue..."
    $MERGE_CLI queue-add "$branch" --priority "$priority" 2>/dev/null || true
    
    # Step 2: Run pre-merge checks
    print_status "$BLUE" "\\n2. Running pre-merge checks..."
    if ! $MERGE_CLI run-checks "$branch"; then
        print_status "$RED" "Pre-merge checks failed. Fix issues and try again."
        return 1
    fi
    
    # Step 3: Check for conflicts
    print_status "$BLUE" "\\n3. Checking for conflicts..."
    if ! $MERGE_CLI check-conflicts "$branch"; then
        print_status "$RED" "Conflicts detected. Resolve conflicts and try again."
        return 1
    fi
    
    # Step 4: Get queue status
    print_status "$BLUE" "\\n4. Checking queue status..."
    $MERGE_CLI queue-status "$branch"
    
    # Ask for confirmation
    print_status "$YELLOW" "\\nReady to merge '$branch' to development?"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "$YELLOW" "Merge cancelled."
        return 0
    fi
    
    # Step 5: Start merge
    print_status "$BLUE" "\\n5. Starting merge..."
    if ! $MERGE_CLI start-merge "$branch"; then
        print_status "$RED" "Merge failed. Check git status and resolve issues."
        return 1
    fi
    
    # Step 6: Run post-merge tests
    print_status "$BLUE" "\\n6. Running post-merge integration tests..."
    # Add your integration test command here
    # For now, we'll just run the basic checks again
    pnpm tsc --noEmit
    
    # Step 7: Complete merge
    print_status "$BLUE" "\\n7. Completing merge..."
    $MERGE_CLI complete-merge "$branch"
    
    print_status "$GREEN" "\\n✓ Successfully merged '$branch' to development!"
}

# Function to process all ready branches
process_ready_branches() {
    print_status "$CYAN" "Processing all branches marked as 'ready' in the queue..."
    
    # This would query the database for ready branches
    # For now, we'll use a placeholder
    $MERGE_CLI queue-list | grep -E "ready|READY" | grep -oE "feature/[^ ]+" | while read -r branch; do
        run_merge_workflow "$branch"
    done
}

# Main script logic
case "${1:-help}" in
    "single")
        if [ -z "$2" ]; then
            print_status "$RED" "Error: Branch name required"
            echo "Usage: $0 single <branch-name> [priority]"
            exit 1
        fi
        run_merge_workflow "$2" "${3:-0}"
        ;;
    
    "all-ready")
        process_ready_branches
        ;;
    
    "help"|"--help"|"-h")
        echo "Automated Merge Workflow Script"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  single <branch> [priority]  Run merge workflow for a single branch"
        echo "  all-ready                   Process all branches marked as 'ready'"
        echo "  help                        Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 single feature/my-feature 5"
        echo "  $0 all-ready"
        ;;
    
    *)
        print_status "$RED" "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac