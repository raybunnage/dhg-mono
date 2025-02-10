#!/bin/bash

# Reset sources_google table
echo "Resetting sources_google table..."

PGPASSWORD="vIv157HuINuDSMZz" psql -h db.jdksnfkupzywjdfefkyj.supabase.co -U postgres -d postgres -c "
  -- Disable RLS
  ALTER TABLE sources_google DISABLE ROW LEVEL SECURITY;

  -- Drop existing policies
  DROP POLICY IF EXISTS \"Enable read access for all authenticated users\" ON sources_google;
  DROP POLICY IF EXISTS \"Enable insert for authenticated users\" ON sources_google;
  DROP POLICY IF EXISTS \"Enable update for authenticated users\" ON sources_google;

  -- Truncate the table
  TRUNCATE TABLE sources_google CASCADE;
"

echo "Table reset complete!" 