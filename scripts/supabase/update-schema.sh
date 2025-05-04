#!/bin/bash

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Ensure output directory exists
mkdir -p "$PROJECT_ROOT/supabase/schema"

# Run the schema dump command using linked project or database URL
echo "Fetching schema from Supabase..."

# Check if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    # Parse host and construct database URL
    SUPABASE_HOST=$(echo $SUPABASE_URL | sed -E 's/https:\/\/([^/]+).*/\1/')
    DB_URL="postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${SUPABASE_HOST}:5432/postgres"
    
    # Use db-url parameter which is the current approach
    echo "Using database URL for connection..."
    pnpm supabase db pull --db-url "$DB_URL" > "$PROJECT_ROOT/supabase/schema/schema.sql"
else
    # Try to use the linked project approach (requires prior supabase login)
    echo "No database URL found, trying linked project..."
    pnpm supabase db pull > "$PROJECT_ROOT/supabase/schema/schema.sql"
fi

# Check if the command was successful
if [ $? -eq 0 ]; then
    echo "Schema successfully updated at supabase/schema/schema.sql"
    
    # Create a JSON schema info file with timestamp
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    cat > "$PROJECT_ROOT/supabase/schema-info.json" << EOF
{
  "last_updated": "$TIMESTAMP",
  "schema_version": "$(md5sum "$PROJECT_ROOT/supabase/schema/schema.sql" | cut -d ' ' -f 1)"
}
EOF
    echo "Schema info updated at supabase/schema-info.json"
else
    echo "Error: Failed to update schema"
    echo "Try running 'pnpm supabase login' first or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables"
    exit 1
fi