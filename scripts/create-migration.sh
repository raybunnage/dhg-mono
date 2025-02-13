#!/bin/bash
set -e  # Exit on any error

# Function to check for duplicates
check_duplicates() {
  local pattern=$1
  local count=$(ls supabase/migrations/*.sql 2>/dev/null | grep -c "$pattern")
  if [ "$count" -gt 0 ]; then
    echo "Error: Found existing migrations with pattern: $pattern"
    echo "Existing files:"
    ls supabase/migrations/*.sql | grep "$pattern"
    exit 1
  fi
}

# Usage check
if [ -z "$1" ]; then
  echo "Error: Migration name required"
  echo "Usage: ./scripts/create-migration.sh <migration_name>"
  exit 1
fi

# Get current timestamp and next second to handle CLI delay
current_timestamp=$(date -u +%Y%m%d%H%M%S)
next_timestamp=$(date -u -v+1S +%Y%m%d%H%M%S)
echo "Checking for duplicate migrations..."
check_duplicates "$current_timestamp"
check_duplicates "$next_timestamp"

# Verify clean state
echo "Verifying clean state..."
pnpm db:check

# Create new migration
name=$1
echo "Creating new migration: $name"
pnpm supabase migration new "$name"

# Get the created migration file
up_file=$(ls -t supabase/migrations/*.sql | head -1)

# Verify the migration was created with expected timestamp
if ! echo "$up_file" | grep -q "$current_timestamp\|$next_timestamp"; then
  echo "Error: Created migration file doesn't match expected timestamp"
  echo "Expected: $current_timestamp or $next_timestamp"
  echo "Got: $up_file"
  exit 1
fi

down_file="${up_file%.*}_down.sql"

# Create down migration
echo "Creating down migration..."
cat > "$down_file" << EOF
-- Migration: Revert ${name}
-- Created at: $(date -u +"%Y-%m-%d %H:%M:%S")
-- Status: planned
-- Dependencies: ${up_file##*/}

BEGIN;

-- Verify current state
DO \$\$ 
BEGIN
  -- Add verification here
END \$\$;

-- Revert changes here

COMMIT;
EOF

echo "Created migration files:"
echo "  Up:   ${up_file##*/}"
echo "  Down: ${down_file##*/}"

# Final verification
echo "Verifying final state..."
pnpm db:check 