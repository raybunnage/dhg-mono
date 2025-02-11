#!/bin/bash

# Usage: ./scripts/supabase/run-migration.sh up|down|list
# Must be run from root directory

COMMAND=$1

if [ -z "$COMMAND" ]; then
  echo "Usage: ./scripts/supabase/run-migration.sh up|down|list"
  exit 1
fi

# Hardcode the URL for now until we fix env loading
DB_URL="postgresql://postgres:iZRA1bV4HnOtSgcX@db.jdksnfkupzywjdfefkyj.supabase.co:5432/postgres"

if [ "$COMMAND" = "list" ]; then
  echo "Listing migrations..."
  pnpm supabase migration list --db-url "$DB_URL" --workdir .
else
  echo "Running migration ${COMMAND}..."
  pnpm supabase migration ${COMMAND} --db-url "$DB_URL" --workdir .
fi 