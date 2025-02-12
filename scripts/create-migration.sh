#!/bin/bash
# Usage: ./scripts/create-migration.sh migration_name

name=$1
timestamp=$(date -u +%Y%m%d%H%M%S)

# Create up migration
pnpm supabase migration new $name

# Create matching down migration
latest=$(ls -t supabase/migrations/*.sql | head -1)
down_file="${latest%.*}_down.sql"
touch "$down_file" 