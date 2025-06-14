#!/usr/bin/env bash

# Beta Group Daily Workflow Helper
source scripts/cli-pipeline/base-classes/multi-worktree-framework.sh

echo "🌅 Beta Group Daily Workflow"
echo "=========================="
echo ""

# Check current status
echo "📊 Current Pipeline Status:"
if [ -f temp/beta-progress.log ]; then
    tail -10 temp/beta-progress.log | column -t -s "|"
fi

echo ""
echo "🎯 Today's Focus:"
echo "1. Continue with current pipeline or start new one"
echo "2. Remember: Low complexity first!"
echo "3. Create checkpoints at each stage"
echo ""

# Show in-progress work
echo "🚧 In Progress:"
ls -la temp/beta-workspace/in-progress/ 2>/dev/null || echo "None"

echo ""
echo "✅ Completed:"
ls -la temp/beta-workspace/completed/ 2>/dev/null || echo "None"

echo ""
echo "🚫 Blocked:"
ls -la temp/beta-workspace/blocked/ 2>/dev/null || echo "None"

echo ""
echo "📝 Quick Commands:"
echo "  View assignments: cat temp/beta-pipeline-assignments.md"
echo "  View reference: cat temp/beta-quick-reference.md"
echo "  Update progress: update_pipeline_progress \"beta\" \"pipeline-name\" \"status\" \"notes\""
echo ""
