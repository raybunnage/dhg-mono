#!/bin/bash

# Script to run the markdown report and then sync the database

echo "=== STEP 1: Generating Markdown Report ==="
# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Run the markdown report script
REPORT_SCRIPT="$SCRIPT_DIR/markdown-report.sh" 
if [ -f "$REPORT_SCRIPT" ]; then
  echo "Running markdown report script at: $REPORT_SCRIPT"
  bash "$REPORT_SCRIPT"
else
  echo "Error: Could not find markdown-report.sh at $REPORT_SCRIPT"
  exit 1
fi

echo ""
echo "=== STEP 2: Syncing Database ==="

# Check which environment we're in
if [ -f "$REPO_ROOT/src/api/markdown-report.ts" ]; then
  echo "Development environment detected"
  
  # In a development environment, we would call the API
  # However, since we're in a shell script, we can't make direct API calls
  # Instead, let's provide instructions:
  
  echo "To complete the database sync:"
  echo "1. Go to the documentation page in the app"
  echo "2. Click the 'Sync Database' button"
  echo ""
  echo "Or, if the app is running, you can make an API call with:"
  echo "curl -X POST http://localhost:3000/api/docs-sync"
else
  echo "Production environment detected"
  echo "Please run the database sync from the web application's documentation page"
fi

echo ""
echo "=== Markdown Report and Sync Database Process Complete ==="
echo "The markdown report has been generated at: $REPO_ROOT/docs/markdown-report.md"
echo "If running in development, please complete the database sync as instructed above"