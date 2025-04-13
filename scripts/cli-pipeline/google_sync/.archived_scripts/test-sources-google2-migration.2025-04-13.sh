#!/bin/bash
# Simple test script to verify migration functionality

# Check for environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Missing required environment variables. Checking for .env file..."
  
  # Check if we have a .env file in the current directory
  if [ -f ".env" ]; then
    echo "Found .env file, loading environment variables..."
    export $(grep -v '^#' .env | xargs)
  else
    echo "No .env file found. Please set the following environment variables:"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_KEY"
    echo "You can create a .env file in the current directory with these variables."
    exit 1
  fi
fi

echo "Available environment variables:"
if [ -n "$SUPABASE_URL" ]; then
  echo "SUPABASE_URL: ${SUPABASE_URL:0:10}..."
else
  echo "SUPABASE_URL: not set"
fi

if [ -n "$SUPABASE_KEY" ]; then
  echo "SUPABASE_KEY: ${SUPABASE_KEY:0:10}..."
else
  echo "SUPABASE_KEY: not set"
fi

# Test migrate-table command with dry-run
echo -e "\nTesting migrate-table with --dry-run..."
ts-node google-drive-manager.ts migrate-table --dry-run

# Test validate-only option
echo -e "\nTesting validate-only option..."
ts-node google-drive-manager.ts migrate-table --validate-only --dry-run

# Test phase 1 with dry run
echo -e "\nTesting phase 1 with dry run..."
ts-node google-drive-manager.ts migrate-table --phase 1 --dry-run

# Test phase 2 with dry run
echo -e "\nTesting phase 2 with dry run..."
ts-node google-drive-manager.ts migrate-table --phase 2 --dry-run

# Test finalize with dry run
echo -e "\nTesting finalize with dry run..."
ts-node google-drive-manager.ts migrate-table --finalize --dry-run

echo -e "\nAll tests completed!"