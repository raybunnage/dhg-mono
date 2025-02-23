#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Updating Supabase schema information...${NC}"

# Update TypeScript types
echo "Generating TypeScript types..."
supabase gen types typescript --local > "$PROJECT_ROOT/supabase/types.ts"

# Update schema information
echo "Generating schema information..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/export_schema_info.sql" -t -A -o "$PROJECT_ROOT/supabase/schema-info.json"

# Format the JSON output to be more readable
if command -v jq &> /dev/null; then
    echo "Formatting schema-info.json..."
    jq '.' "$PROJECT_ROOT/supabase/schema-info.json" > "$PROJECT_ROOT/supabase/schema-info.tmp.json"
    mv "$PROJECT_ROOT/supabase/schema-info.tmp.json" "$PROJECT_ROOT/supabase/schema-info.json"
fi

echo -e "${GREEN}Schema information updated successfully!${NC}" 