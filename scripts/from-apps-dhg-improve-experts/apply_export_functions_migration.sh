#!/bin/bash
# Apply export functions utility migration to Supabase

echo "Applying export functions utility migration..."

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if SUPABASE_URL and SUPABASE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_KEY must be set in your environment or .env file"
  exit 1
fi

# Read the migration SQL file
MIGRATION_PATH="../../supabase/migrations/20250615000000_create_export_functions_utility.sql"
MIGRATION_SQL=$(cat "$MIGRATION_PATH")

# Apply the migration
echo "Applying migration: 20250615000000_create_export_functions_utility.sql..."
curl -X POST \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(echo "$MIGRATION_SQL" | sed 's/"/\\"/g' | tr -d '\n')\"}" \
  "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  2>/dev/null

if [ $? -eq 0 ]; then
  echo "Migration applied successfully!"
else
  echo "Error applying migration. Check your credentials and try again."
  exit 1
fi

echo "Done!"