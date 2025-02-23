#!/bin/bash

# Usage: ./scripts/supabase/complete-migration.sh <migration-name>
# Example: ./scripts/supabase/complete-migration.sh 20240321000001_add_last_synced_column

MIGRATION=$1

if [ -z "$MIGRATION" ]; then
  echo "Usage: ./scripts/supabase/complete-migration.sh <migration-name>"
  exit 1
fi

mkdir -p supabase/migrations/applied
mv "supabase/migrations/planned/${MIGRATION}.sql" "supabase/migrations/applied/"
mv "supabase/migrations/planned/${MIGRATION}_down.sql" "supabase/migrations/applied/"

echo "Moved ${MIGRATION} to applied migrations" 