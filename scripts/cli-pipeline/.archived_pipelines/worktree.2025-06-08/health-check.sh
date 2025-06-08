#!/bin/bash
echo "🏥 Running worktree management pipeline health check..."

# Check git worktree support
if ! git worktree list &> /dev/null; then
  echo "❌ Git worktree command not available"
  exit 1
fi

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing required environment variables"
  exit 1
fi

# Count worktrees
WORKTREE_COUNT=$(git worktree list | wc -l)

echo "✅ Worktree management pipeline is healthy"
echo "  - Git worktree: Available"
echo "  - Active worktrees: $WORKTREE_COUNT"
exit 0
