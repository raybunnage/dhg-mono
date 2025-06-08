#\!/bin/bash
# Presentations Pipeline Health Check

echo "🏥 Running presentations pipeline health check..."

# Check environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing required environment variables"
  exit 1
fi

# Check for key directories and files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ \! -f "$SCRIPT_DIR/presentations-cli.sh" ]; then
  echo "❌ CLI script not found"
  exit 1
fi

# Check for TypeScript files
TS_COUNT=$(find "$SCRIPT_DIR" -name "*.ts" -type f | wc -l)
if [ "$TS_COUNT" -eq 0 ]; then
  echo "❌ No TypeScript files found"
  exit 1
fi

# Check for commands directory
if [ \! -d "$SCRIPT_DIR/commands" ]; then
  echo "❌ Commands directory not found"
  exit 1
fi

echo "✅ Presentations pipeline is healthy"
echo "  - Environment variables: OK"
echo "  - CLI script: Found"
echo "  - TypeScript files: $TS_COUNT found"
echo "  - Commands directory: Found"
exit 0
