#!/bin/bash

# Script to connect to Supabase and query the documentation_files table
# Lists ALL records and checks if each file exists on disk

echo "Starting documentation database query..."

# Define important locations
REPO_ROOT="$(pwd)"
ENV_FILE="$REPO_ROOT/apps/dhg-improve-experts/.env.development"
REPORT_FILE="$REPO_ROOT/docs/documentation-files-report.md"

# Check if environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Environment file not found at $ENV_FILE"
  exit 1
fi

# Load environment variables from .env.development file - handle special characters properly
echo "Loading Supabase credentials from $ENV_FILE..."
set -a
source "$ENV_FILE"
set +a

# Check if required environment variables are loaded
if [[ -z "$VITE_SUPABASE_URL" || -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo "ERROR: Required Supabase environment variables not found"
  echo "Make sure VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are in $ENV_FILE"
  exit 1
fi

echo "Supabase URL: $VITE_SUPABASE_URL"

# Ensure docs directory exists
mkdir -p "$REPO_ROOT/docs"

# Create a Node.js script to query the database
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const repoRoot = '$REPO_ROOT';
const reportFile = '$REPORT_FILE';

async function queryDocumentationFiles() {
  try {
    console.log('Querying all documentation files...');
    
    // Get count of all records
    const { count: totalCount, error: totalError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      console.error('Error getting total count:', totalError.message);
      return;
    }
    
    // Get count of non-deleted records
    const { count: activeCount, error: activeError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);
    
    if (activeError) {
      console.error('Error getting active count:', activeError.message);
      return;
    }
    
    // Get count of deleted records
    const { count: deletedCount, error: deletedError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);
    
    if (deletedError) {
      console.error('Error getting deleted count:', deletedError.message);
      return;
    }
    
    console.log('Documentation Files Statistics:');
    console.log(\`- Total records: \${totalCount}\`);
    console.log(\`- Active records: \${activeCount}\`);
    console.log(\`- Deleted records: \${deletedCount}\`);
    
    // Get ALL records
    const { data: allFiles, error: allFilesError } = await supabase
      .from('documentation_files')
      .select('id, file_path, title, is_deleted, updated_at')
      .order('file_path', { ascending: true });
    
    if (allFilesError) {
      console.error('Error getting all files:', allFilesError.message);
      return;
    }
    
    console.log(\`\\nAll Documentation Files (\${allFiles ? allFiles.length : 0} records):\`);
    
    const filesList = [];
    const existsCount = { total: 0, exists: 0, notFound: 0 };
    const shouldBeActive = [];
    const shouldBeDeleted = [];
    
    if (allFiles && allFiles.length > 0) {
      allFiles.forEach((file, index) => {
        existsCount.total++;
        
        // Check if file exists on disk
        const fullPath = path.join(repoRoot, file.file_path);
        const exists = fs.existsSync(fullPath);
        
        if (exists) {
          existsCount.exists++;
        } else {
          existsCount.notFound++;
        }
        
        // Check if status is correct
        const correctStatus = exists ? !file.is_deleted : file.is_deleted;
        
        // Add to appropriate list for correction
        if (exists && file.is_deleted) {
          shouldBeActive.push(file.id);
        } else if (!exists && !file.is_deleted) {
          shouldBeDeleted.push(file.id);
        }
        
        const status = exists ? '✅ EXISTS' : '❌ NOT FOUND';
        const statusCorrect = correctStatus ? '✓' : '✗';
        const fileInfo = \`\${index + 1}. \${file.file_path} | \${status} | DB Status: \${file.is_deleted ? 'DELETED' : 'ACTIVE'} \${statusCorrect}\`;
        
        console.log(fileInfo);
        filesList.push(fileInfo);
      });
    } else {
      console.log('No files found');
    }
    
    // Create report content
    const reportContent = \`# Documentation Files Database Report

Generated: \${new Date().toLocaleString()}

## REAL Data from documentation_files Table

### Statistics
- **Total records:** \${totalCount}
- **Active records:** \${activeCount}
- **Deleted records:** \${deletedCount}
- **Files that exist on disk:** \${existsCount.exists}
- **Files not found on disk:** \${existsCount.notFound}

### Files that should be marked as ACTIVE (currently marked as deleted but exist on disk)
\${shouldBeActive.length} files

### Files that should be marked as DELETED (currently marked as active but don't exist on disk)
\${shouldBeDeleted.length} files

### All Documentation Files
\${filesList.length > 0 ? filesList.join('\\n') : 'No files found'}

## Next Steps

1. Update the database to correct the is_deleted status:
   - Mark \${shouldBeActive.length} files as ACTIVE (currently incorrectly marked as deleted)
   - Mark \${shouldBeDeleted.length} files as DELETED (currently incorrectly marked as active)

2. Implement the full update functionality to sync the database with files on disk
\`;

    // Write report to file
    fs.writeFileSync(reportFile, reportContent);
    console.log(\`\\nReport written to \${reportFile}\`);
    
    // Generate SQL to fix the database
    const sqlContent = \`-- SQL to fix documentation_files table

-- Mark files as ACTIVE (currently incorrectly marked as deleted but exist on disk)
UPDATE documentation_files
SET is_deleted = false, updated_at = NOW()
WHERE id IN (\${shouldBeActive.map(id => \`'\${id}'\`).join(', ')});

-- Mark files as DELETED (currently incorrectly marked as active but don't exist on disk)
UPDATE documentation_files
SET is_deleted = true, updated_at = NOW()
WHERE id IN (\${shouldBeDeleted.map(id => \`'\${id}'\`).join(', ')});
\`;

    // Write SQL to file
    fs.writeFileSync('docs/fix-documentation-files.sql', sqlContent);
    console.log('SQL to fix the database written to docs/fix-documentation-files.sql');
    
  } catch (error) {
    console.error('Unhandled error:', error.message);
  }
}

queryDocumentationFiles();
"

echo "Script completed." 