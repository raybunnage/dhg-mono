#!/bin/bash
# Script to run direct database sync

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Set working directory to project root
cd "$PROJECT_ROOT"

# Check if SUPABASE_URL is set
if [ -z "${SUPABASE_URL}" ]; then
  echo "SUPABASE_URL is not set. Using default URL from the environment."
  export SUPABASE_URL="https://jdksnfkupzywjdfefkyj.supabase.co"
fi

# Check if SUPABASE_KEY is set
if [ -z "${SUPABASE_KEY}" ]; then
  echo "SUPABASE_KEY is not set. Please enter your Supabase key:"
  read -s SUPABASE_KEY
  export SUPABASE_KEY
fi

# Run the direct sync script
echo "Running script sync with Supabase credentials..."
node "$PROJECT_ROOT/scripts/root/direct-db-sync.js"