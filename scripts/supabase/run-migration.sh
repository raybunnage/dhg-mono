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
elif [ "$COMMAND" = "repair" ]; then
  echo "Repairing migration..."
  echo "Attempting to clear migrations table..."
  # First clear the migrations table
  PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql -h "db.${SUPABASE_PROJECT_ID}.supabase.co" \
    -U postgres -d postgres -p 5432 -c "TRUNCATE supabase_migrations.schema_migrations;"
  if [ $? -eq 0 ]; then
    echo "Successfully cleared migrations table"
  else
    echo "Failed to clear migrations table"
    exit 1
  fi
  
  # Verify table is empty
  echo "Verifying table is empty..."
  PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql -h "db.${SUPABASE_PROJECT_ID}.supabase.co" \
    -U postgres -d postgres -p 5432 -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations;"
  
  VERSION=$2
  if [ -n "$VERSION" ]; then
    # Repair specific version
    echo "Repairing specific version: $VERSION"
    pnpm supabase migration repair "$VERSION" --status applied
  else
    # Then repair with all current migrations
    echo "Repairing all current migrations..."
    pnpm supabase migration repair --status applied --no-verify
  fi
elif [ "$COMMAND" = "repair-applied" ]; then
  echo "Marking migration as applied..."
  pnpm supabase migration repair --db-url "$DB_URL" --status applied 20250210215604
elif [ "$COMMAND" = "check" ]; then
  echo "Checking schema_migrations table..."
  pnpm supabase migration list --db-url "$DB_URL" --workdir .
elif [ "$COMMAND" = "down" ]; then
  echo "Rolling back last migration..."
  # Get the last migration version from REMOTE column (handle aligned output)
  LAST_VERSION=$(pnpm supabase migration list --db-url "$DB_URL" --workdir . | 
    grep -v "LOCAL.*REMOTE.*TIME" | 
    grep -v "─.*─.*─" |
    awk '{gsub(/[[:space:]]+/, " "); if ($3 != "") last=$3} END {print last}')
  echo "Found last version: $LAST_VERSION"
  if [ -n "$LAST_VERSION" ]; then
    echo "Rolling back to version before $LAST_VERSION..."
    # Find and execute the down migration file
    DOWN_FILE="supabase/migrations/${LAST_VERSION}_add_last_synced_column_down.sql"
    echo "Looking for down file: $DOWN_FILE"
    if [ -f "$DOWN_FILE" ]; then
      echo "Executing down migration: $DOWN_FILE"
      echo "Down migration content:"
      cat "$DOWN_FILE"
      # First try to remove from schema_migrations if it exists
      echo "Removing from schema_migrations if exists..."
      pnpm supabase migration repair --db-url "$DB_URL" --status reverted "$LAST_VERSION"
      # Execute the SQL directly
      echo "Executing down SQL..."
      PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql -h "db.${SUPABASE_PROJECT_ID}.supabase.co" \
        -U postgres -d postgres -p 5432 -f "$DOWN_FILE"
      if [ $? -eq 0 ]; then
        echo "Successfully executed down migration SQL"
      else
        echo "Failed to execute down migration SQL"
        exit 1
      fi
    else
      echo "Down migration file not found!"
    fi
  else
    echo "No migrations to roll back"
  fi
else
  echo "Running migration ${COMMAND}..."
  pnpm supabase migration ${COMMAND} --db-url "$DB_URL" --workdir .
fi 