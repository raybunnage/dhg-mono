#!/bin/bash

# Usage: ./scripts/supabase/start-psql.sh [optional SQL command]
# If SQL command is provided, executes it and exits
# If no command, starts interactive psql session

# Export environment variables
set -a
source .env
set +a

# Verify required environment variables
if [ -z "$SUPABASE_PROJECT_ID" ] || [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "Error: Missing required environment variables"
  echo "Please ensure SUPABASE_PROJECT_ID and SUPABASE_DB_PASSWORD are set in .env"
  exit 1
fi

# Build connection string
DB_HOST="db.$SUPABASE_PROJECT_ID.supabase.co"
CONN_STRING="postgres://postgres:${SUPABASE_DB_PASSWORD}@${DB_HOST}:5432/postgres"

if [ -n "$1" ]; then
  # Execute single command if provided
  PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h "$DB_HOST" \
    -U postgres -d postgres \
    -c "\x auto" \
    -c "$1"
else
  # Start interactive session
  echo "Connecting to Supabase PostgreSQL..."
  echo "Host: $DB_HOST"
  echo "Database: postgres"
  echo "User: postgres"
  echo ""
  echo "Type '\q' to exit"
  echo "-------------------"
  
  # Remove -c "\x auto" and let it run interactively
  PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
    "postgres://postgres:${SUPABASE_DB_PASSWORD}@${DB_HOST}:5432/postgres?sslmode=require"
fi 