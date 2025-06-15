#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source common functions
source "$PROJECT_ROOT/scripts/cli-pipeline/common-functions.sh" 2>/dev/null || true

# Initialize command tracking
track_command() {
    local command_name="$1"
    shift
    "$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/cli.js" track-command \
        --pipeline "git_workflow" \
        --command "$command_name" \
        --args "$*" \
        --start-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        >/dev/null 2>&1 || true
}

case "$1" in
    # Health Check
    "health-check"|"health")
        track_command "health-check"
        cd "$SCRIPT_DIR" && npx ts-node health-check.ts ${@:2}
        ;;
    
    # Git Information Commands
    "info"|"git-info")
        track_command "git-info"
        if [ -f "$PROJECT_ROOT/scripts/root/get-git-info.sh" ]; then
            "$PROJECT_ROOT/scripts/root/get-git-info.sh"
        else
            # Use TypeScript version if available
            cd "$SCRIPT_DIR" && npx ts-node git-info-detailed.ts
        fi
        ;;
    
    "status"|"git-status")
        track_command "git-status"
        git status
        ;;
    
    "worktree"|"worktree-list")
        track_command "worktree-list"
        echo "Git Worktrees:"
        git worktree list
        ;;
    
    # Branch Management
    "branch"|"current-branch")
        track_command "current-branch"
        git branch --show-current
        ;;
    
    "branches"|"list-branches")
        track_command "list-branches"
        echo "Local branches:"
        git branch
        echo -e "\nRemote branches:"
        git branch -r
        ;;
    
    "create-branch")
        track_command "create-branch" "$2"
        if [ -z "$2" ]; then
            echo "Usage: $0 create-branch <branch-name>"
            exit 1
        fi
        git checkout -b "$2"
        ;;
    
    # Testing Commands
    "test"|"run-tests")
        track_command "run-tests"
        echo "Running tests..."
        cd "$PROJECT_ROOT" && pnpm test:run
        ;;
    
    "typecheck"|"check-types")
        track_command "check-types"
        echo "Checking TypeScript types..."
        cd "$PROJECT_ROOT" && tsc --noEmit
        ;;
    
    "lint"|"run-lint")
        track_command "run-lint"
        echo "Running linter..."
        cd "$PROJECT_ROOT" && pnpm lint
        ;;
    
    "check-all"|"pre-commit")
        track_command "pre-commit"
        echo "Running pre-commit checks..."
        cd "$PROJECT_ROOT"
        
        echo "1. TypeScript check..."
        tsc --noEmit || { echo "TypeScript check failed"; exit 1; }
        
        echo -e "\n2. Linting..."
        pnpm lint || { echo "Lint check failed"; exit 1; }
        
        echo -e "\n3. Running tests..."
        pnpm test:run || { echo "Tests failed"; exit 1; }
        
        echo -e "\n✅ All checks passed!"
        ;;
    
    # Promotion Workflow
    "merge-to-dev"|"promote-to-dev")
        track_command "promote-to-dev"
        current_branch=$(git branch --show-current)
        echo "Merging $current_branch to development..."
        
        # Create temporary branch for merge
        git checkout -b temp-merge-to-development origin/development
        git merge "$current_branch"
        git push origin temp-merge-to-development:development
        git checkout "$current_branch"
        git branch -d temp-merge-to-development
        ;;
    
    "merge-to-main"|"promote-to-main")
        track_command "promote-to-main"
        echo "This will merge development to main. Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            git checkout -b temp-merge-to-main origin/main
            git merge origin/development
            git push origin temp-merge-to-main:main
            git checkout development
            git branch -d temp-merge-to-main
        fi
        ;;
    
    # Environment Management
    "copy-env")
        track_command "copy-env" "$2"
        if [ -z "$2" ]; then
            echo "Usage: $0 copy-env <source-worktree-name>"
            echo "Example: $0 copy-env dhg-mono"
            exit 1
        fi
        
        # Find source worktree path
        source_path="/Users/raybunnage/Documents/github/$2"
        if [ ! -d "$source_path" ]; then
            echo "Error: Source worktree not found at $source_path"
            exit 1
        fi
        
        # Copy .env.development
        if [ -f "$source_path/.env.development" ]; then
            cp "$source_path/.env.development" "$PROJECT_ROOT/.env.development"
            echo "✅ Copied .env.development from $2"
        else
            echo "Error: .env.development not found in $source_path"
            exit 1
        fi
        ;;
    
    # Utility Commands
    "clean-branches"|"prune-branches")
        track_command "prune-branches"
        echo "Pruning merged branches..."
        git remote prune origin
        git branch --merged | grep -v "main\|development\|master" | xargs -n 1 git branch -d 2>/dev/null || true
        echo "✅ Cleaned up merged branches"
        ;;
    
    # Help
    "--help"|"-h"|"")
        echo "Git Workflow CLI Pipeline"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Git Information:"
        echo "  info, git-info          Show comprehensive git information"
        echo "  status, git-status      Show git status"
        echo "  worktree, worktree-list List all git worktrees"
        echo ""
        echo "Branch Management:"
        echo "  branch, current-branch  Show current branch"
        echo "  branches, list-branches List all branches (local and remote)"
        echo "  create-branch <name>    Create and checkout new branch"
        echo ""
        echo "Testing & Validation:"
        echo "  test, run-tests         Run test suite"
        echo "  typecheck, check-types  Check TypeScript types"
        echo "  lint, run-lint          Run linter"
        echo "  check-all, pre-commit   Run all pre-commit checks"
        echo ""
        echo "Promotion Workflow:"
        echo "  merge-to-dev            Merge current branch to development"
        echo "  merge-to-main           Merge development to main (with confirmation)"
        echo ""
        echo "Environment Management:"
        echo "  copy-env <worktree>     Copy .env.development from another worktree"
        echo ""
        echo "Utility Commands:"
        echo "  clean-branches          Remove merged branches"
        echo ""
        echo "Examples:"
        echo "  $0 check-all           # Run all pre-commit checks"
        echo "  $0 merge-to-dev        # Merge current branch to development"
        echo "  $0 copy-env dhg-mono   # Copy env from main worktree"
        ;;
    
    *)
        echo "Unknown command: $1"
        echo "Run '$0 --help' for usage information"
        exit 1
        ;;
  health-check)
    echo "🏥 Running health check for git_workflow pipeline..."
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
      echo "❌ Missing required environment variables"
      exit 1
    fi
    echo "✅ git_workflow pipeline is healthy"
    ;;
esac
