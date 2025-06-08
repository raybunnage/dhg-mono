#!/bin/bash
echo "🏥 Running deprecation analysis pipeline health check..."

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing required environment variables"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$SCRIPT_DIR/deprecation-cli.sh" ]; then
  echo "❌ CLI script not found"
  exit 1
fi

echo "✅ Deprecation analysis pipeline is healthy"
exit 0
