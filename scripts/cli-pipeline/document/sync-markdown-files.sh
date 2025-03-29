#!/bin/bash
# Markdown Files Synchronization Script for CLI Pipeline
# Synchronizes markdown files with the documentation_files table in Supabase

# Get script directory and repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "==== Markdown Files Synchronization ===="
echo -e "${YELLOW}This script synchronizes markdown files with the documentation_files table.${NC}"
echo ""

# Load environment variables from cli-pipeline directory
if [ -f "$SCRIPT_DIR/load-env.sh" ]; then
  echo -e "${YELLOW}Loading environment variables...${NC}"
  source "$SCRIPT_DIR/load-env.sh" --quiet
  echo ""
else
  echo -e "${RED}Warning: load-env.sh not found in $SCRIPT_DIR${NC}"
  echo "Proceeding with existing environment variables."
  echo ""
fi

# Check if ts-node is installed
if ! command -v ts-node &> /dev/null; then
  echo -e "${RED}Error: ts-node is not installed. Installing...${NC}"
  npm install -g ts-node typescript
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install ts-node. Please install it manually:${NC}"
    echo "npm install -g ts-node typescript"
    exit 1
  fi
fi

# Check required environment variables
if [ -z "$CLI_SUPABASE_URL" ] || [ -z "$CLI_SUPABASE_KEY" ]; then
  echo -e "${RED}Error: Required environment variables are not set.${NC}"
  echo "Make sure the following variables are set:"
  echo "- CLI_SUPABASE_URL"
  echo "- CLI_SUPABASE_KEY"
  exit 1
fi

# Run the TypeScript script
echo -e "${YELLOW}Running markdown files synchronization...${NC}"
ts-node "$SCRIPT_DIR/sync-markdown-files.ts"
RESULT=$?

if [ $RESULT -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ Markdown files synchronization completed successfully!${NC}"
  echo ""
else
  echo ""
  echo -e "${RED}✗ Markdown files synchronization failed with exit code $RESULT.${NC}"
  echo "Please check the logs for more details."
  echo ""
  exit $RESULT
fi

echo "To view the documentation files in Supabase:"
echo "1. Log in to the Supabase dashboard"
echo "2. Navigate to the Table Editor"
echo "3. Select the 'documentation_files' table"
echo ""
echo "==== Synchronization Complete ===="