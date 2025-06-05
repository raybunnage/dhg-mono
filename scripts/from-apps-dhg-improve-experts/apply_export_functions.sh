#!/bin/bash
# Apply export functions utility by running the SQL directly

echo "Applying export functions utility..."

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Verify environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_KEY must be set in your environment or .env file."
  exit 1
fi

# Connect to Supabase and run the SQL directly
echo "Creating export_all_functions_to_json function..."

psql "$SUPABASE_URL" -c "$(cat fix_export_function.sql)" || {
  echo "Error: Failed to apply SQL directly."
  echo "You will need to manually run the SQL in your database using the Supabase SQL editor."
  echo "The SQL is available in 'fix_export_function.sql'."
  exit 1
}

echo "Export function created successfully!"
echo "You can now run 'pnpm db:export-functions' to generate the functions.json file."