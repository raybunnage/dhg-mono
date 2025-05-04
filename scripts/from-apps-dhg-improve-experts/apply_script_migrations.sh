#!/bin/bash

# Script to apply script tracking table migrations to the Supabase database
# This creates the necessary database schema for script analysis

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_FILE="$SCRIPT_DIR/supabase/script_tracking/scripts-table-sql.sql"

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set${NC}"
  echo "Please set these variables before running this script:"
  echo "  export SUPABASE_URL=your_supabase_url"
  echo "  export SUPABASE_KEY=your_supabase_key"
  exit 1
fi

echo -e "${YELLOW}Applying script tracking table migrations...${NC}"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
  exit 1
fi

# Apply migrations using psql
PGPASSWORD=$SUPABASE_DB_PASSWORD psql \
  --host=$SUPABASE_DB_HOST \
  --port=$SUPABASE_DB_PORT \
  --username=$SUPABASE_DB_USER \
  --dbname=$SUPABASE_DB_NAME \
  -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Script tracking table migrations applied successfully!${NC}"
else
  echo -e "${RED}Error applying script tracking table migrations${NC}"
  exit 1
fi

echo -e "${GREEN}Done!${NC}"
exit 0