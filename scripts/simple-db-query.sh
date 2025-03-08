#!/bin/bash

# Very simple script to connect to Supabase and query the documentation_files table
# This script avoids complex operations and focuses on just getting the data

echo "Starting simple database query..."

# Define important locations
REPO_ROOT="$(pwd)"
ENV_FILE="$REPO_ROOT/apps/dhg-improve-experts/.env.development"

# Check if environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Environment file not found at $ENV_FILE"
  exit 1
fi

# Load environment variables from .env.development file
echo "Loading Supabase credentials from $ENV_FILE..."
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Check if required environment variables are loaded
if [[ -z "$VITE_SUPABASE_URL" || -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "ERROR: Required Supabase environment variables not found"
  echo "Make sure VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are in $ENV_FILE"
  exit 1
fi

echo "Supabase URL: $VITE_SUPABASE_URL"

# Create a simple Node.js script inline
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function queryDatabase() {
  try {
    // Get count of all records
    const { count, error } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error querying database:', error.message);
      return;
    }
    
    console.log('Total records in documentation_files:', count);
    
    // Get active and deleted counts
    const { count: activeCount, error: activeError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);
      
    const { count: deletedCount, error: deletedError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);
    
    console.log('Active records:', activeCount);
    console.log('Deleted records:', deletedCount);
    
    // Get a sample of deleted records
    const { data: deletedFiles, error: deletedFilesError } = await supabase
      .from('documentation_files')
      .select('id, file_path, title')
      .eq('is_deleted', true)
      .limit(3);
    
    if (!deletedFilesError && deletedFiles.length > 0) {
      console.log('\\nSample of deleted files:');
      deletedFiles.forEach(file => {
        console.log(\`- \${file.title || 'No title'} (\${file.file_path})\`);
      });
    }
    
    // Write results to a file
    const reportContent = \`# Database Query Results
    
## REAL Data from documentation_files Table

- Total records: \${count}
- Active records: \${activeCount}
- Deleted records: \${deletedCount}

\${deletedFiles && deletedFiles.length > 0 ? '## Sample of Deleted Files\\n\\n' + 
  deletedFiles.map(file => \`- \${file.title || 'No title'} (\${file.file_path})\`).join('\\n') : ''}
\`;

    fs.writeFileSync('docs/simple-db-results.md', reportContent);
    console.log('\\nResults written to docs/simple-db-results.md');
    
  } catch (error) {
    console.error('Unhandled error:', error.message);
  }
}

queryDatabase();
"

echo "Script completed." 