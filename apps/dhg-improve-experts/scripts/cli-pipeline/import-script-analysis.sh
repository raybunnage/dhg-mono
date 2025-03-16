#!/bin/bash

# Script to import and analyze script files
# Outputs analysis reports to the docs directory

GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}=== Running Script Analysis Importer ===${NC}\n"

# Get script directory and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
MONO_ROOT="$(cd "$APP_DIR/.." && pwd)"
DOCS_DIR="${MONO_ROOT}/docs"
REPORTS_DIR="${DOCS_DIR}/reports"
OUTPUT_FILE="${DOCS_DIR}/script-analysis-report.md"

# Create directories if they don't exist
mkdir -p "${REPORTS_DIR}"

# Source analysis parameters from environment variables
if [ -f "${APP_DIR}/.env.local" ]; then
  source "${APP_DIR}/.env.local"
elif [ -f "${APP_DIR}/.env" ]; then
  source "${APP_DIR}/.env"
fi

# Check for required environment variables
if [ -z "${SUPABASE_URL}" ] || [ -z "${SUPABASE_KEY}" ]; then
  echo -e "${BOLD}Error: Missing required environment variables SUPABASE_URL and SUPABASE_KEY${NC}"
  echo "Please set these in .env or .env.local file"
  exit 1
fi

# Process arguments
TARGET_DIR=""
if [ "$#" -gt 0 ]; then
  TARGET_DIR="$1"
else
  # Default target directory if none specified
  TARGET_DIR="${APP_DIR}/src"
fi

echo "Script analysis target directory: ${TARGET_DIR}"
echo "Output will be saved to: ${OUTPUT_FILE}"

# Create the report header
cat > "${OUTPUT_FILE}" << EOL
# Script Analysis Report

Generated: $(date)

This report contains analysis of JavaScript/TypeScript files in the project.

## Summary

EOL

# Run analysis
echo "Running script analysis..."

# Count files by type
TS_FILES=$(find "${TARGET_DIR}" -name "*.ts" -not -path "*/node_modules/*" | wc -l)
TSX_FILES=$(find "${TARGET_DIR}" -name "*.tsx" -not -path "*/node_modules/*" | wc -l)
JS_FILES=$(find "${TARGET_DIR}" -name "*.js" -not -path "*/node_modules/*" | wc -l)
JSX_FILES=$(find "${TARGET_DIR}" -name "*.jsx" -not -path "*/node_modules/*" | wc -l)

# Add summary to report
cat >> "${OUTPUT_FILE}" << EOL
- TypeScript (.ts) files: ${TS_FILES}
- TypeScript React (.tsx) files: ${TSX_FILES}
- JavaScript (.js) files: ${JS_FILES}
- JavaScript React (.jsx) files: ${JSX_FILES}
- Total script files: $(($TS_FILES + $TSX_FILES + $JS_FILES + $JSX_FILES))

## Analysis Details

EOL

# Import file structure information
cat >> "${OUTPUT_FILE}" << EOL
### Directory Structure

\`\`\`
EOL

find "${TARGET_DIR}" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "*/node_modules/*" | sort >> "${OUTPUT_FILE}"

cat >> "${OUTPUT_FILE}" << EOL
\`\`\`

EOL

# Add timestamp at the end
echo -e "\nReport generated: $(date)" >> "${OUTPUT_FILE}"

echo -e "\n${BOLD}${GREEN}=== Script Analysis Import Complete ===${NC}"
echo "Report saved to: ${OUTPUT_FILE}"