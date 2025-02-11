#!/bin/bash

# Usage: ./scripts/supabase/run-migration.sh up|down|list
# Must be run from root directory

COMMAND=$1

if [ -z "$COMMAND" ]; then
  echo "Usage: ./scripts/supabase/run-migration.sh up|down|list"
  exit 1
fi

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
  echo "Found .env file"
  set -a
  source .env
  set +a
else
  echo "No .env file found in $(pwd)"
fi

# Verify required environment variables
if [ -z "$SUPABASE_DB_PASSWORD" ] || [ -z "$SUPABASE_PROJECT_ID" ]; then
  echo "Current directory: $(pwd)"
  echo "SUPABASE_PROJECT_ID: ${SUPABASE_PROJECT_ID:-not set}"
  echo "SUPABASE_DB_PASSWORD: ${SUPABASE_DB_PASSWORD:-not set}"
  echo "Error: Required environment variables not set"
  echo "Please ensure SUPABASE_DB_PASSWORD and SUPABASE_PROJECT_ID are set in .env"
  exit 1
fi

# Construct database URL safely
DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres"

if [ "$COMMAND" = "list" ]; then
  echo "Listing migrations..."
  pnpm supabase migration list --db-url "$DB_URL" --workdir .
else
  echo "Running migration ${COMMAND}..."
  pnpm supabase migration ${COMMAND} --db-url "$DB_URL" --workdir .
fi 