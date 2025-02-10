#!/bin/bash

# Reset sources_google table
echo "Resetting sources_google table..."

# Change to the app directory where supabase is configured
cd apps/dhg-improve-experts

# Link to project first (if not already linked)
pnpm supabase link --project-ref jdksnfkupzywjdfefkyj --password "vIv157HuINuDSMZz"

# Disable RLS
pnpm supabase db remote query "
  -- Truncate just the sources_google table
  TRUNCATE TABLE sources_google CASCADE;

  -- Disable RLS for this table only
  ALTER TABLE sources_google DISABLE ROW LEVEL SECURITY;
"

# Return to root
cd ../..

echo "Table reset complete!" 