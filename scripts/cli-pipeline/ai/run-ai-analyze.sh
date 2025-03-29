#!/bin/bash

# This script runs the AI-enabled script analysis pipeline

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLI_DIST="$MONO_ROOT/packages/cli/dist"
SCAN_OUTPUT="$MONO_ROOT/script-scan-results.json"
ANALYSIS_DIR="$MONO_ROOT/script-analysis-results"
IMPROVE_EXPERTS_DIR="$MONO_ROOT/apps/dhg-improve-experts"

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create the analysis directory if it doesn't exist
mkdir -p "$ANALYSIS_DIR"

# Load environment variables using the shared helper script
. "$SCRIPT_DIR/load-env.sh" --verbose

# Check if critical variables are set
if [ -z "$CLI_CLAUDE_API_KEY" ] || [ -z "$CLI_SUPABASE_URL" ] || [ -z "$CLI_SUPABASE_KEY" ]; then
  echo -e "${RED}Error: Required environment variables are not set${NC}"
  echo "Please make sure the following variables are defined in .env.local:"
  echo "  - CLI_CLAUDE_API_KEY (currently: ${CLI_CLAUDE_API_KEY:0:3}...)"
  echo "  - CLI_SUPABASE_URL (currently: ${CLI_SUPABASE_URL:-not set})"
  echo "  - CLI_SUPABASE_KEY (currently: ${CLI_SUPABASE_KEY:0:3}...)"
  exit 1
fi

# Create CLI dist directory if it doesn't exist
if [ ! -d "$CLI_DIST" ]; then
  echo -e "${YELLOW}CLI dist directory doesn't exist. Creating it now...${NC}"
  mkdir -p "$CLI_DIST/commands" "$CLI_DIST/utils"
  echo -e "${GREEN}Running fix-permissions.sh to set up CLI tools...${NC}"
  "$SCRIPT_DIR/fix-permissions.sh"
fi

echo -e "${GREEN}Starting AI Script Analysis Pipeline${NC}"
echo "-----------------------------------"

# Step 1: Scan for script files
echo -e "${YELLOW}Step 1: Scanning for script files...${NC}"

# Create a simplified script scanning function
scan_scripts() {
  local output_file="$1"
  local extensions="$2"
  local exclude_patterns="$3"
  local directory="$4"
  
  echo "Finding shell scripts in $directory..."
  
  # Use find command to locate script files
  find "$directory" -type f -name "*.sh" | grep -v -E "(node_modules|dist|build|\.git|coverage)" > "$output_file"
  
  echo "Found $(wc -l < "$output_file") script files"
  
  # Add basic JSON structure around the file list
  local temp_file="${output_file}.temp"
  echo "{" > "$temp_file"
  echo "  \"scripts\": [" >> "$temp_file"
  
  local first=true
  while IFS= read -r file; do
    if [ "$first" = true ]; then
      first=false
    else
      echo "," >> "$temp_file"
    fi
    echo "    {" >> "$temp_file"
    echo "      \"path\": \"${file#$directory/}\"," >> "$temp_file"
    echo "      \"type\": \"shell\"," >> "$temp_file"
    echo "      \"description\": \"Shell script\"" >> "$temp_file"
    echo -n "    }" >> "$temp_file"
  done < "$output_file"
  
  echo "" >> "$temp_file"
  echo "  ]" >> "$temp_file"
  echo "}" >> "$temp_file"
  
  mv "$temp_file" "$output_file"
  echo "Script scan results saved to $output_file"
}

# Execute script scanning
scan_scripts "$SCAN_OUTPUT" "sh" "node_modules,dist,build,.git,coverage" "$MONO_ROOT"

echo -e "${GREEN}Successfully scanned script files. Results saved to:${NC} $SCAN_OUTPUT"
echo "-----------------------------------"

# Step 2: Analyze script files with simplified approach
echo -e "${YELLOW}Step 2: Analyzing script files...${NC}"

# Run the batch analyze script
"$SCRIPT_DIR/fix-batch-analyze.sh" "$SCAN_OUTPUT" "$ANALYSIS_DIR"

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
