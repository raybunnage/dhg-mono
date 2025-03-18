#!/bin/bash

# SUPER SIMPLE SCRIPT - DISPLAY DOCUMENTATION FILE PATHS
# This script uses direct REST API call to Supabase

echo "===== DOCUMENTATION FILE PATHS ====="
echo ""

# Check for environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  # Load from env files if needed
  if [ -f .env ]; then
    echo "Loading from .env file"
    source .env
  fi
  
  if [ -f .env.local ]; then
    echo "Loading from .env.local file"
    source .env.local
  fi
fi

# Verify we have what we need
if [ -z "$SUPABASE_URL" ]; then
  echo "ERROR: SUPABASE_URL is not set!"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY is not set!"
  exit 1
fi

echo "Using Supabase URL: $SUPABASE_URL"
echo "Service role key is set: YES"
echo ""
echo "Retrieving file paths from documentation_files table..."
echo ""

# Direct API call - no RPC, just simple REST
result=$(curl -s -X GET \
  "$SUPABASE_URL/rest/v1/documentation_files?select=file_path" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

# Check if we got an error
if [[ "$result" == *"error"* ]]; then
  echo "ERROR: Failed to retrieve documentation files:"
  echo "$result"
  exit 1
fi

# Check if we got an empty array
if [[ "$result" == "[]" ]]; then
  echo "No documentation files found in the database."
  exit 0
fi

# Extract and display file paths
echo "FILE PATHS:"
echo "---------------------------------------"

# Try parsing with jq if available
if command -v jq &> /dev/null; then
  echo "$result" | jq -r '.[].file_path'
else
  # Fallback to grep/sed
  echo "$result" | grep -o '"file_path":"[^"]*"' | sed 's/"file_path":"//g' | sed 's/"//g'
fi

# Count files
count=$(echo "$result" | grep -o '"file_path"' | wc -l | tr -d ' ')
echo "---------------------------------------"
echo "Total: $count file path(s) found"