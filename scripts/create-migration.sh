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

# Verify clean state before starting
echo "Verifying clean state..."
pnpm db:check

# Create new migration
name=$1
echo "Creating new migration: $name"
pnpm supabase migration new "$name"

# Get the created migration file
up_file=$(ls -t supabase/migrations/*.sql | head -1)

# Verify only one new migration was created
if [ ! -f "$up_file" ]; then
  echo "Error: Migration file not created"
  exit 1
fi

down_file="${up_file%.*}_down.sql"

# Create down migration
echo "Creating down migration..."
cat > "$down_file" << EOF
-- Migration: Revert ${name}
-- Created at: $(date -u "+%Y-%m-%d %H:%M:%S")
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