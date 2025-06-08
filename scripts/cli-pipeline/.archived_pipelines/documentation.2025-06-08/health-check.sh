#!/bin/bash
echo "🏥 Running documentation pipeline health check..."

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing required environment variables"
  exit 1
fi

# Check for docs
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DOC_COUNT=$(find "$PROJECT_ROOT/docs" -name "*.md" -type f | wc -l)

if [ "$DOC_COUNT" -eq 0 ]; then
  echo "❌ No documentation files found"
  exit 1
fi

echo "✅ Documentation pipeline is healthy"
echo "  - Documentation files: $DOC_COUNT found"
exit 0
