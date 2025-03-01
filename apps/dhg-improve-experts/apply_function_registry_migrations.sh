#!/bin/bash
# Apply function registry migrations to Supabase

echo "Applying function registry migrations..."

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if SUPABASE_URL and SUPABASE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_KEY must be set in your environment or .env file"
  exit 1
fi

# Apply the migrations
echo "Applying migrations from function_registry_migrations.sql..."
curl -X POST \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(sed 's/"/\\"/g' function_registry_migrations.sql | tr -d '\n')\"}" \
  "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  2>/dev/null

if [ $? -eq 0 ]; then
  echo "Migrations applied successfully!"
else
  echo "Error applying migrations. Check your credentials and try again."
  exit 1
fi

echo "Done!"