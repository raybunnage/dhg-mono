#!/bin/bash

# Script to display file paths from documentation_files table
# Simple utility that extracts and displays file_path for each document record

echo "Display Documentation File Paths"
echo "==============================="

# Load environment variables
if [ -f .env ]; then
  source .env
fi
  
if [ -f .env.local ]; then
  source .env.local
fi

# Get the database connection details
DB_URL=${SUPABASE_URL:-""}
SERVICE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-""}

if [[ -z "$DB_URL" || -z "$SERVICE_KEY" ]]; then
  echo "Error: Missing database connection details."
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  exit 1
fi

echo "Fetching file paths from documentation_files table..."

# Execute query to get file paths using the RPC function execute_sql
response=$(curl -s -X POST \
  "${DB_URL}/rest/v1/rpc/execute_sql" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"sql\": \"SELECT file_path FROM documentation_files ORDER BY file_path\"}")

# Check if we got a valid response
if [[ "$response" == *"error"* ]]; then
  echo "Error retrieving data: $response"
  exit 1
fi

echo "File paths:"
echo "-------------------------------"

# Parse and display the file paths
if command -v jq &> /dev/null; then
  # Using jq if available for better JSON parsing
  echo "$response" | jq -r '.[] | .file_path' 2>/dev/null
else
  # Fallback to grep
  echo "$response" | grep -o '"file_path":"[^"]*"' | sed 's/"file_path":"//g' | sed 's/"//g'
fi

echo "-------------------------------"
echo "Done."