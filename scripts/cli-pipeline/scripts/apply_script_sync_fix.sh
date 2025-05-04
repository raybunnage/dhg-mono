#!/bin/bash

# Script to apply the fix for script synchronization function

echo "Applying script sync fix migration..."

# Navigate to the root directory
cd "$(dirname "$0")/../../.."

# Current directory should be project root
echo "Current directory: $(pwd)"

# Run the migration
echo "Applying migration: 20250406123456_fix_sync_scripts_function.sql"
pnpm supabase migration up 20250406123456_fix_sync_scripts_function.sql

if [ $? -eq 0 ]; then
  echo "Migration applied successfully!"
else
  echo "Error applying migration. Trying alternative approach..."
  # Try the alternative approach using psql directly with SUPABASE_DB_URL
  if [ -n "$SUPABASE_DB_URL" ]; then
    echo "Applying migration using psql and SUPABASE_DB_URL..."
    psql "$SUPABASE_DB_URL" -f ./supabase/migrations/20250406123456_fix_sync_scripts_function.sql
  else
    echo "SUPABASE_DB_URL not set. Cannot apply migration directly."
    exit 1
  fi
fi

# Test the function by running the script sync
echo "Testing the fixed sync function..."
ts-node ./scripts/cli-pipeline/scripts/script-pipeline-main.ts sync

# Check if the sync was successful
if [ $? -eq 0 ]; then
  echo "Script sync test successful!"
else
  echo "Script sync test failed. Please check the logs for details."
  exit 1
fi

exit 0