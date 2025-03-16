#!/bin/bash

# This script runs the scan-scripts command from the dhg-mono root directory

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLI_DIST="$MONO_ROOT/packages/cli/dist"
SCAN_OUTPUT="$MONO_ROOT/script-scan-results.json"

# Explicitly set SUPABASE_SERVICE_ROLE_KEY from .env.development if available
ENV_FILE="$SCRIPT_DIR/.env.development"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE"
  export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY "$ENV_FILE" | cut -d '=' -f2-)
  echo "SUPABASE_SERVICE_ROLE_KEY loaded from .env.development"
fi

# Check if the CLI dist directory exists
if [ ! -d "$CLI_DIST" ]; then
  echo "Error: CLI dist directory doesn't exist."
  echo "Please run the fix-permissions.sh script first."
  exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Running Script Scanner${NC}"
echo "-----------------------------------"

# Run the scan-scripts command
echo -e "${YELLOW}Scanning for script files...${NC}"
cd "$MONO_ROOT" && \
node "$CLI_DIST/index.js" scan-scripts \
  --dir "$MONO_ROOT" \
  --extensions "js,ts,sh,py,sql" \
  --exclude "node_modules,dist,build,.git,coverage" \
  --output "$SCAN_OUTPUT" \
  --verbose

if [ $? -ne 0 ]; then
  echo -e "${RED}Error scanning script files${NC}"
  exit 1
fi

echo -e "${GREEN}Successfully scanned script files. Results saved to:${NC} $SCAN_OUTPUT"
echo "-----------------------------------"

# Display file count
SCRIPT_COUNT=$(cat "$SCAN_OUTPUT" | jq length)
echo -e "${GREEN}Found $SCRIPT_COUNT script files.${NC}"

# Display sample
echo -e "${YELLOW}Sample of found scripts:${NC}"
cat "$SCAN_OUTPUT" | jq ".[0:5] | .[] | .file_path" | sort