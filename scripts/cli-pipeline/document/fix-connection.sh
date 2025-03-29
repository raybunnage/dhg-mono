#!/bin/bash
# fix-connection.sh - Diagnose and fix Supabase connection issues

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables from .env files
if [ -f "${ROOT_DIR}/.env.development" ]; then
  echo "Loading environment variables from .env.development..."
  set -a # automatically export all variables
  source "${ROOT_DIR}/.env.development"
  set +a
fi

if [ -f "${ROOT_DIR}/.env.local" ]; then
  echo "Loading environment variables from .env.local..."
  set -a
  source "${ROOT_DIR}/.env.local"
  set +a
fi

# Ensure we have a valid CLAUDE_API_KEY (copy from ANTHROPIC_API_KEY if needed)
if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY"
  export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
fi

# Check environment variables
echo "Checking environment variables..."
echo "SUPABASE_URL: ${SUPABASE_URL:0:20}..."
echo "SUPABASE_SERVICE_ROLE_KEY length: ${#SUPABASE_SERVICE_ROLE_KEY}"

# Run the TypeScript connection fix script
cd "${ROOT_DIR}"
echo "Running connection diagnostic script..."
npx ts-node --transpile-only "${SCRIPT_DIR}/supabase-connection-fix.ts"

# Set permissions on the document-pipeline-service-cli.sh
echo "Setting executable permissions on CLI script..."
chmod +x "${SCRIPT_DIR}/document-pipeline-service-cli.sh"

echo "Connection check complete. Try running test-connection again with:"
echo "./scripts/cli-pipeline/document/document-pipeline-service-cli.sh test-connection"