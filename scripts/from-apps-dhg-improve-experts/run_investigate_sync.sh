#!/bin/bash

# Script to run the SQL queries for investigating unexpected sync files

# Get the folder path where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# SQL file path
SQL_FILE="$SCRIPT_DIR/investigate_sync_files.sql"

# Create a timestamp for the output file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$SCRIPT_DIR/sync_investigation_results_$TIMESTAMP.txt"

# Check if SQL file exists
if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file not found at $SQL_FILE"
  exit 1
fi

# Make sure the SQL file is executable
chmod +x "$SQL_FILE"

echo "Running SQL investigation queries..."
echo "Results will be saved to $OUTPUT_FILE"

# Get the Supabase connection details
DB_URL=$(grep -o 'SUPABASE_URL=[^ ]*' .env | cut -d= -f2)
DB_KEY=$(grep -o 'SUPABASE_KEY=[^ ]*' .env | cut -d= -f2)

if [ -z "$DB_URL" ] || [ -z "$DB_KEY" ]; then
  echo "Error: Could not find Supabase connection details in .env"
  echo "Please provide your Supabase URL and KEY in the .env file"
  exit 1
fi

# Run the SQL file and save the output to the output file
echo "=== Sync Files Investigation Results ($(date)) ===" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Run each query separately so we can see the results of each query
while IFS= read -r line; do
  # Skip comments and empty lines
  if [[ "$line" =~ ^--.*$ ]] || [[ -z "$line" ]]; then
    echo "$line" >> "$OUTPUT_FILE"
    continue
  fi
  
  # If the line contains a query (ends with a semicolon), execute it
  if [[ "$line" =~ .*;$ ]]; then
    echo "Executing: $line"
    echo "Executing: $line" >> "$OUTPUT_FILE"
    # You'll need to replace this with your actual method to run SQL against Supabase
    # Example using psql if you have direct DB access:
    # psql "$DB_URL" -c "$line" >> "$OUTPUT_FILE" 2>&1
    echo "Query results would appear here" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
  fi
done < "$SQL_FILE"

echo "Investigation complete. Results saved to $OUTPUT_FILE"
echo "Please review the results and take appropriate actions."
echo ""
echo "If you need to clean up unwanted files, use the cleanup queries at the end of the SQL file."