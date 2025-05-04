#!/bin/bash
# sync-scripts.sh - A convenient wrapper for database script synchronization

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Define common paths
DIRECT_SYNC_SCRIPT="${PROJECT_ROOT}/scripts/root/final-sync.js"
PIPELINE_SCRIPT="${PROJECT_ROOT}/scripts/cli-pipeline/script-pipeline-main.sh"

# Process command-line arguments
MODE="pipeline"
if [ "$1" == "--direct" ]; then
  MODE="direct"
elif [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --direct    Use direct Node.js sync script"
  echo "  --pipeline  Use the pipeline script [default]"
  echo "  --help, -h  Show this help message"
  echo ""
  echo "Environment variables:"
  echo "  SUPABASE_URL  URL of the Supabase instance"
  echo "  SUPABASE_KEY  API key for Supabase authentication"
  echo ""
  echo "Note: If environment variables are not set, you will be prompted for the Supabase key."
  exit 0
fi

# Display header
echo "🔄 Script Database Synchronization"
echo "=================================="
echo "Mode: $MODE"
echo ""

# Ensure the scripts directory exists and contains the final-sync.js file
"${SCRIPT_DIR}/ensure-sync-script.sh" > /dev/null

# Run the appropriate sync command
if [ "$MODE" == "direct" ]; then
  # Run the direct sync script using Node.js
  echo "Running direct Node.js sync script..."
  node "${DIRECT_SYNC_SCRIPT}"
else
  # Run the pipeline script
  echo "Running pipeline script..."
  "${PIPELINE_SCRIPT}" sync
fi

# Display completion message
echo ""
echo "✅ Script synchronization complete"