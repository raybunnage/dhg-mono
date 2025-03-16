#!/bin/bash

# This script runs the AI-enabled script analysis pipeline

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_DIST="$MONO_ROOT/packages/cli/dist"
SCAN_OUTPUT="$MONO_ROOT/script-scan-results.json"
ANALYSIS_DIR="$MONO_ROOT/ai-script-analysis-results"
IMPROVE_EXPERTS_DIR="$MONO_ROOT/apps/dhg-improve-experts"

# Create the analysis directory if it doesn't exist
mkdir -p "$ANALYSIS_DIR"

# Load environment variables from .env.development if available
ENV_FILE="$IMPROVE_EXPERTS_DIR/.env.development"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE"
  export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY "$ENV_FILE" | cut -d '=' -f2-)
  export ANTHROPIC_API_KEY=$(grep VITE_ANTHROPIC_API_KEY "$ENV_FILE" | cut -d '=' -f2-)
  echo "SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY loaded from .env.development"
fi

# Make sure Claude API key is set
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$VITE_ANTHROPIC_API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY not set. Please set it in .env.development"
  exit 1
fi

# Check if CLI dist exists
if [ ! -d "$CLI_DIST" ]; then
  echo "Error: CLI dist directory doesn't exist."
  echo "Please run the fix scripts from packages/cli/scripts first:"
  echo "  - fix-permissions.sh"
  echo "  - fix-batch-analyze.sh"
  echo "  - fix-ai-integration.sh"
  exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting AI Script Analysis Pipeline${NC}"
echo "-----------------------------------"

# Step 1: Scan for script files
echo -e "${YELLOW}Step 1: Scanning for script files...${NC}"
cd "$MONO_ROOT" && \
node "$CLI_DIST/index.js" scan-scripts \
  --dir "$MONO_ROOT" \
  --extensions "sh" \
  --exclude "node_modules,dist,build,.git,coverage" \
  --output "$SCAN_OUTPUT" \
  --verbose

if [ $? -ne 0 ]; then
  echo -e "${RED}Error scanning script files${NC}"
  exit 1
fi

echo -e "${GREEN}Successfully scanned script files. Results saved to:${NC} $SCAN_OUTPUT"
echo "-----------------------------------"

# Step 2: Analyze script files with AI
echo -e "${YELLOW}Step 2: Analyzing script files with Claude AI...${NC}"
cd "$MONO_ROOT" && \
node "$CLI_DIST/index.js" batch-analyze-scripts \
  --input "$SCAN_OUTPUT" \
  --output-dir "$ANALYSIS_DIR" \
  --extensions "sh" \
  --max-scripts 5 \
  --use-ai \
  --verbose

if [ $? -ne 0 ]; then
  echo -e "${RED}Error analyzing script files${NC}"
  exit 1
fi

echo -e "${GREEN}Successfully analyzed script files with AI. Results saved to:${NC} $ANALYSIS_DIR"
echo "-----------------------------------"

# Step 3: Summary
echo -e "${YELLOW}AI Script Analysis Pipeline completed successfully${NC}"
echo "Summary report available at: $ANALYSIS_DIR/script-analysis-report.md"
echo "Category summary available at: $ANALYSIS_DIR/category-summary.md"

# Display a preview of the category summary if available
if [ -f "$ANALYSIS_DIR/category-summary.md" ]; then
  echo -e "${GREEN}Category Summary Preview:${NC}"
  echo "-----------------------------------"
  head -n 20 "$ANALYSIS_DIR/category-summary.md"
  echo "..."
fi

echo -e "${GREEN}Done!${NC}"
exit 0
