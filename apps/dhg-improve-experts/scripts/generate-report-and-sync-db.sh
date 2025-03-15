#\!/bin/bash

# This script generates the markdown report and syncs it with the database
# It's designed to be called directly from the browser or via API

# Set headers for browser compatibility
echo "Content-Type: text/plain"
echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
echo "Access-Control-Allow-Headers: Content-Type"
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Running from directory: $SCRIPT_DIR"
echo "Repository root: $REPO_ROOT"

# Step 1: Generate markdown report
echo "Generating markdown report..."
"$SCRIPT_DIR/markdown-report.sh"
REPORT_STATUS=$?

if [ $REPORT_STATUS -ne 0 ]; then
  echo "ERROR: Failed to generate markdown report (exit code $REPORT_STATUS)"
  exit 1
fi

# Step 2: Update the database with the report data
echo "Syncing documentation to database..."
"$SCRIPT_DIR/update-docs-database.sh"
SYNC_STATUS=$?

if [ $SYNC_STATUS -ne 0 ]; then
  echo "ERROR: Failed to sync documentation to database (exit code $SYNC_STATUS)"
  exit 1
fi

echo "Successfully generated report and synced with database"
exit 0
