#!/bin/bash

# This script fixes the metadata fields in the documentation_files table
# It converts 'size' to 'file_size' and ensures all records have a created date

# Change to the project root directory (from cli-pipeline directory to project root)
cd "$(dirname "$0")/../.." || exit 1

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  set -a
  source .env
  set +a
else
  echo "Error: .env file not found."
  exit 1
fi

# Make sure supabase module is installed
npm list @supabase/supabase-js >/dev/null 2>&1 || npm install --no-save @supabase/supabase-js

# Run the JavaScript script with the correct environment variables
echo "Running metadata field fixer..."
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  node ./scripts/cli-pipeline/fix-metadata-fields.js

echo "Metadata field fixing complete"