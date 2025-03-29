#!/bin/bash
# Script to run the full sync

# Load environment variables
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Now check if SUPABASE_KEY is already set in the environment
if [ -z "${SUPABASE_KEY}" ]; then
  # Prompt for the key only if it's not already set
  echo "Enter your Supabase key:"
  read -s SUPABASE_KEY
  export SUPABASE_KEY
fi

# Set the path to the script-pipeline-main.sh script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_SCRIPT="${SCRIPT_DIR}/script-pipeline-main.sh"

# Make the script executable
chmod +x "${MAIN_SCRIPT}"

# Run the sync command with the SUPABASE_KEY environment variable
echo "Running script sync with database credentials..."
"${MAIN_SCRIPT}" sync