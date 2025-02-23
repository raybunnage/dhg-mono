#!/bin/bash

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Ensure output directory exists
mkdir -p "$PROJECT_ROOT/supabase/schema"

# Run the schema dump command using db-url instead of project-id
echo "Fetching schema from Supabase..."
pnpm supabase db pull --project-id jdksnfkupzywjdfefkyj > "$PROJECT_ROOT/supabase/schema/schema.sql"

# Check if the command was successful
if [ $? -eq 0 ]; then
    echo "Schema successfully updated at supabase/schema/schema.sql"
else
    echo "Error: Failed to update schema"
    exit 1
fi 