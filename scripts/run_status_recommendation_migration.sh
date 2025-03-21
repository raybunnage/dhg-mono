#!/bin/bash

# Script to run the status_recommendation migration SQL
echo "Running migration script to populate status_recommendation field..."

# Change to the project root directory
cd "$(dirname "$0")/.." || exit 1

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  set -a
  source .env
  set +a
else
  echo "Error: .env file not found."
  exit 1
fi

# Check that we have Supabase credentials
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file."
  exit 1
fi

# Create a temporary script to run the SQL with the Supabase JS client
TEMP_DIR=$(mktemp -d)
SCRIPT_FILE="$TEMP_DIR/migrate_status.js"

cat > "$SCRIPT_FILE" << 'EOL'
const { createClient } = require('@supabase/supabase-js');

async function runMigration() {
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Connected to Supabase');
  
  // First update from direct status_recommendation in metadata
  console.log('Migrating status_recommendation from metadata root level...');
  const { data: directResult, error: directError } = await supabase.rpc('execute_sql', {
    sql: `
    UPDATE documentation_files 
    SET status_recommendation = metadata->>'status_recommendation'
    WHERE metadata->>'status_recommendation' IS NOT NULL
    AND status_recommendation IS NULL;
    
    SELECT COUNT(*) as count FROM documentation_files 
    WHERE status_recommendation IS NOT NULL;
    `
  });
  
  if (directError) {
    console.error('Error updating from direct metadata:', directError);
  } else {
    console.log('Updated from direct metadata, current count:', directResult?.[0]?.count || 'unknown');
  }
  
  // Then update from ai_assessment nested structure
  console.log('Migrating status_recommendation from metadata.ai_assessment...');
  const { data: aiResult, error: aiError } = await supabase.rpc('execute_sql', {
    sql: `
    UPDATE documentation_files 
    SET status_recommendation = metadata->'ai_assessment'->>'status_recommendation'
    WHERE metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL
    AND status_recommendation IS NULL;
    
    SELECT COUNT(*) as count FROM documentation_files 
    WHERE status_recommendation IS NOT NULL;
    `
  });
  
  if (aiError) {
    console.error('Error updating from ai_assessment:', aiError);
  } else {
    console.log('Updated from ai_assessment, current count:', aiResult?.[0]?.count || 'unknown');
  }
  
  // Finally update from processed_content nested structure
  console.log('Migrating status_recommendation from metadata.processed_content...');
  const { data: processedResult, error: processedError } = await supabase.rpc('execute_sql', {
    sql: `
    UPDATE documentation_files 
    SET status_recommendation = metadata->'processed_content'->'assessment'->>'status_recommendation'
    WHERE metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL
    AND status_recommendation IS NULL;
    
    SELECT COUNT(*) as count FROM documentation_files 
    WHERE status_recommendation IS NOT NULL;
    `
  });
  
  if (processedError) {
    console.error('Error updating from processed_content:', processedError);
  } else {
    console.log('Updated from processed_content, current count:', processedResult?.[0]?.count || 'unknown');
  }
  
  // Get final stats
  const { data: finalResult, error: finalError } = await supabase.rpc('execute_sql', {
    sql: `
    SELECT 
      (SELECT COUNT(*) FROM documentation_files) as total_files,
      (SELECT COUNT(*) FROM documentation_files WHERE status_recommendation IS NOT NULL) as with_status,
      (SELECT COUNT(*) FROM documentation_files WHERE status_recommendation = 'KEEP') as keep_count,
      (SELECT COUNT(*) FROM documentation_files WHERE status_recommendation = 'UPDATE') as update_count,
      (SELECT COUNT(*) FROM documentation_files WHERE status_recommendation = 'ARCHIVE') as archive_count,
      (SELECT COUNT(*) FROM documentation_files WHERE status_recommendation = 'DELETE') as delete_count
    `
  });
  
  if (finalError) {
    console.error('Error getting stats:', finalError);
  } else if (finalResult?.[0]) {
    console.log('\nMigration complete. Final statistics:');
    console.log(`Total files: ${finalResult[0].total_files}`);
    console.log(`Files with status_recommendation: ${finalResult[0].with_status} (${Math.round(finalResult[0].with_status / finalResult[0].total_files * 100)}%)`);
    console.log(`\nStatus breakdown:`);
    console.log(`KEEP: ${finalResult[0].keep_count}`);
    console.log(`UPDATE: ${finalResult[0].update_count}`);
    console.log(`ARCHIVE: ${finalResult[0].archive_count}`);
    console.log(`DELETE: ${finalResult[0].delete_count}`);
  }
  
  console.log('\nMigration completed successfully');
}

runMigration().catch(err => {
  console.error('Error running migration:', err);
  process.exit(1);
});
EOL

# Install dependencies if needed
echo "Setting up dependencies..."
npm list @supabase/supabase-js >/dev/null 2>&1 || npm install --no-save @supabase/supabase-js >/dev/null 2>&1

# Run the migration script
echo "Executing migration script..."
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" node "$SCRIPT_FILE"

# Clean up
rm -rf "$TEMP_DIR"

echo "Migration script execution complete"
exit 0