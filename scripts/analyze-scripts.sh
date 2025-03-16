#!/bin/bash

# Script Analysis Pipeline
# This script runs the complete pipeline for script analysis and document type classification

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONO_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$MONO_ROOT/apps/dhg-improve-experts"
CLI_DIR="$MONO_ROOT/packages/cli"
SCAN_OUTPUT="$MONO_ROOT/script-scan-results.json"
ANALYSIS_DIR="$MONO_ROOT/script-analysis-results"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create the analysis directory if it doesn't exist
mkdir -p "$ANALYSIS_DIR"

echo -e "${GREEN}Starting Script Analysis Pipeline${NC}"
echo "-----------------------------------"

# Step 1: Scan for script files
echo -e "${YELLOW}Step 1: Scanning for script files...${NC}"
cd "$MONO_ROOT" && \
node "$CLI_DIR/dist/index.js" scan-scripts \
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

# Step 2: Batch analyze script files
echo -e "${YELLOW}Step 2: Analyzing script files...${NC}"
cd "$MONO_ROOT" && \
node "$CLI_DIR/dist/index.js" batch-analyze-scripts \
  --input "$SCAN_OUTPUT" \
  --output-dir "$ANALYSIS_DIR" \
  --prompt-name "script-analysis-prompt" \
  --check-references \
  --update-database \
  --batch-size 5 \
  --concurrency 2 \
  --verbose

if [ $? -ne 0 ]; then
  echo -e "${RED}Error analyzing script files${NC}"
  exit 1
fi

echo -e "${GREEN}Successfully analyzed script files. Results saved to:${NC} $ANALYSIS_DIR"
echo "-----------------------------------"

# Step 3: Summary
echo -e "${YELLOW}Script Analysis Pipeline completed successfully${NC}"
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