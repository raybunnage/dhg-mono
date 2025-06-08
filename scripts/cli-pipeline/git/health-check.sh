#!/bin/bash
echo "🏥 Running git management pipeline health check..."

# Check git is available
if ! command -v git &> /dev/null; then
  echo "❌ Git command not found"
  exit 1
fi

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing required environment variables"
  exit 1
fi

# Check if in git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Not in a git repository"
  exit 1
fi

echo "✅ Git management pipeline is healthy"
echo "  - Git: Available"
echo "  - Repository: Valid"
echo "  - Environment: Configured"
exit 0
