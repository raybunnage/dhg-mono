#!/usr/bin/env bash

# Setup script for CLI Pipeline Refactoring - Group A
# This script prepares the improve-suite worktree for Group A work

set -e

echo "🚀 Setting up Group A worktree for CLI pipeline refactoring"
echo "=========================================================="

# Navigate to the base-classes directory
cd "$(dirname "$0")/scripts/cli-pipeline/base-classes"

# Source the framework
echo "📦 Loading multi-worktree framework..."
source ./multi-worktree-framework.sh

# Register this worktree as Group A
echo "📝 Registering Group A worktree..."
register_worktree_group "group-a" "$(dirname "$0")" "ai,monitoring,testing,all_pipelines,code,write"

# Display group assignment
echo ""
echo "✅ Group A Setup Complete!"
echo "========================="
echo "📋 Assigned Pipelines:"
echo "  1. ai - AI processing pipelines"
echo "  2. monitoring - System monitoring tools"
echo "  3. testing - Testing framework"
echo "  4. all_pipelines - Meta-pipeline management"
echo "  5. code - Code processing utilities"
echo "  6. write - Write/output pipelines"
echo ""
echo "📊 Framework Commands Available:"
echo "  - check_shared_issues           # Check for documented issues"
echo "  - log_shared_issue             # Document new integration issues"
echo "  - update_pipeline_progress     # Update refactoring progress"
echo "  - check_pipeline_dependencies  # Check cross-pipeline dependencies"
echo "  - coordinate_with_groups       # Coordinate with other groups"
echo ""
echo "🔧 Next Steps:"
echo "  1. Review pipeline assignments in: docs/living-docs/cli-pipeline-worktree-group-assignments.md"
echo "  2. Check existing issues in: docs/living-docs/cli-service-integration-issues.md"
echo "  3. Start with priority pipelines (ai, monitoring, testing)"
echo "  4. Use checkpoint system: analyzing -> migrating -> testing -> completed"
echo ""
echo "💡 Tip: Source this script in your shell to access all framework functions:"
echo "  source $(dirname "$0")/setup-group-a-worktree.sh"