#!/bin/bash
echo "🏥 Running merge queue pipeline health check..."

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing required environment variables"
  exit 1
fi

# Check git
if ! command -v git &> /dev/null; then
  echo "❌ Git command not found"
  exit 1
fi

echo "✅ Merge queue pipeline is healthy"
exit 0
