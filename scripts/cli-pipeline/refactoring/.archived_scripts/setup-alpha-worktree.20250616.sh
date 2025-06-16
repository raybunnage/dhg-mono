#!/usr/bin/env bash

# Setup script for CLI Pipeline Refactoring - Group ALPHA
# This script prepares the improve-suite worktree for Group ALPHA work
# Compatible with both bash and zsh

set -e

echo "🚀 Setting up Group ALPHA worktree for CLI pipeline refactoring"
echo "============================================================="

# Get the directory of this script
SETUP_DIR="$(cd "$(dirname "$0")" && pwd)"

# Navigate to the base-classes directory
cd "$SETUP_DIR/scripts/cli-pipeline/base-classes"

# Source the framework in a bash subshell if we're in zsh
if [ -n "$ZSH_VERSION" ]; then
    echo "📦 Loading framework in bash compatibility mode..."
    bash -c "
        source ./multi-worktree-framework.sh
        register_worktree_group 'alpha' '$SETUP_DIR' 'all-pipelines,deployment,database,proxy,servers,monitoring,shared-services,service-dependencies,refactor-tracking,deprecation,utilities,system,services,dev-tasks,views,logging,testing'
    "
else
    # We're in bash, source directly
    echo "📦 Loading multi-worktree framework..."
    source ./multi-worktree-framework.sh
    register_worktree_group "alpha" "$SETUP_DIR" "all-pipelines,deployment,database,proxy,servers,monitoring,shared-services,service-dependencies,refactor-tracking,deprecation,utilities,system,services,dev-tasks,views,logging,testing"
fi

# Display group assignment
echo ""
echo "✅ Group ALPHA Setup Complete!"
echo "============================="
echo "📋 Focus: Infrastructure & System Management"
echo ""
echo "🔴 High Complexity Pipelines (3):"
echo "  1. all-pipelines-cli.sh - System orchestration (do last)"
echo "  2. deployment-cli.sh - Deployment operations"
echo "  3. database-cli.sh - Database operations"
echo ""
echo "🟡 Medium Complexity Pipelines (7):"
echo "  4. proxy-cli.sh"
echo "  5. servers-cli.sh"
echo "  6. monitoring-cli.sh"
echo "  7. shared-services-cli.sh"
echo "  8. service-dependencies-cli.sh"
echo "  9. refactor-tracking-cli.sh"
echo "  10. deprecation-cli.sh"
echo ""
echo "🟢 Low Complexity Pipelines (7):"
echo "  11. utilities-cli.sh"
echo "  12. system-cli.sh"
echo "  13. services-cli.sh"
echo "  14. dev-tasks-cli.sh"
echo "  15. views-cli.sh"
echo "  16. logging-cli.sh"
echo "  17. testing-cli.sh"
echo ""
echo "📊 Recommended Approach:"
echo "  1. Start with testing-cli.sh (low complexity) to validate process"
echo "  2. Move to medium complexity pipelines"
echo "  3. Tackle high complexity pipelines"
echo "  4. Complete all-pipelines-cli.sh last (depends on others)"
echo ""
echo "🔧 Key Commands:"
echo "  - Check existing issues: cat docs/living-docs/cli-service-integration-issues.md"
echo "  - View assignments: cat docs/living-docs/cli-pipeline-worktree-group-assignments.md"
echo "  - Track progress: echo 'alpha/testing-cli.sh: analyzing' >> /tmp/cli-refactor-alpha.json"
echo ""
echo "💡 For zsh users: This script runs the framework in bash compatibility mode"
echo "   To use framework functions directly, run them in a bash subshell"