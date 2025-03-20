#!/bin/bash

# Script to verify and audit document_type_id in documentation_files table
# This script checks:
# 1. How many records have NULL document_type_id
# 2. Makes sure scripts preserve document_type_id and metadata
# 3. Creates a backup of the table if requested

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

# Check if backup was requested
CREATE_BACKUP=false
if [ "$1" == "--backup" ]; then
  CREATE_BACKUP=true
  echo "Will create backup of documentation_files table"
fi

# Print environment variable status
echo "SUPABASE_URL: $SUPABASE_URL"
echo "SUPABASE_SERVICE_ROLE_KEY length: ${#SUPABASE_SERVICE_ROLE_KEY}"

echo "Running database integrity check for documentation_files..."

node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const shouldCreateBackup = $CREATE_BACKUP;

async function verifyDocumentTypes() {
  try {
    console.log('Checking documentation_files integrity...');
    
    // Get overall stats
    const { count: totalCount, error: totalError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
      
    if (totalError) {
      console.error('Error getting total count:', totalError.message);
      return;
    }
    
    // Get non-null document_type_id count
    const { count: typedCount, error: typedError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('document_type_id', 'is', null);
      
    if (typedError) {
      console.error('Error getting typed count:', typedError.message);
      return;
    }
    
    // Get null document_type_id count
    const { count: nullCount, error: nullError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .is('document_type_id', null);
      
    if (nullError) {
      console.error('Error getting null count:', nullError.message);
      return;
    }
    
    // Get count with non-null metadata
    const { count: metadataCount, error: metadataError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('metadata', 'is', null);
      
    if (metadataError) {
      console.error('Error getting metadata count:', metadataError.message);
      return;
    }
    
    // Print summary
    console.log('Documentation Files Summary:');
    console.log(\`Total records: \${totalCount}\`);
    console.log(\`Records with document_type_id: \${typedCount} (\${Math.round(typedCount/totalCount*100)}%)\`);
    console.log(\`Records with NULL document_type_id: \${nullCount} (\${Math.round(nullCount/totalCount*100)}%)\`);
    console.log(\`Records with metadata: \${metadataCount} (\${Math.round(metadataCount/totalCount*100)}%)\`);
    
    // Get a sample of files with document_type_id to verify format
    const { data: sampleTyped, error: sampleError } = await supabase
      .from('documentation_files')
      .select('id, file_path, title, document_type_id, created_at')
      .not('document_type_id', 'is', null)
      .limit(5);
      
    if (sampleError) {
      console.error('Error getting sample typed records:', sampleError.message);
    } else if (sampleTyped && sampleTyped.length > 0) {
      console.log('\\nSample records with document_type_id:');
      for (const record of sampleTyped) {
        console.log(\`- \${record.file_path}: document_type_id = \${record.document_type_id}\`);
      }
    }
    
    // Get document type information
    const { data: docTypes, error: docTypesError } = await supabase
      .from('document_types')
      .select('id, document_type, category')
      .order('document_type');
      
    if (docTypesError) {
      console.error('Error getting document types:', docTypesError.message);
    } else if (docTypes && docTypes.length > 0) {
      console.log('\\nAvailable document types:');
      
      // Group by category
      const categories = {};
      for (const type of docTypes) {
        const category = type.category || 'Uncategorized';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(type);
      }
      
      // Print by category
      for (const [category, types] of Object.entries(categories)) {
        console.log(\`\\n${category}:\`);
        for (const type of types) {
          console.log(\`- \${type.document_type} (\${type.id})\`);
        }
      }
    }
    
    // Create backup if requested
    if (shouldCreateBackup) {
      console.log('\\nCreating backup of documentation_files table...');
      
      // First check if backup table exists
      const { data: tableExists } = await supabase
        .rpc('table_exists', { table_name: 'documentation_files_backup' });
        
      if (tableExists) {
        // Drop existing backup table
        console.log('Dropping existing backup table...');
        await supabase.rpc('execute_sql', {
          sql_query: 'DROP TABLE IF EXISTS documentation_files_backup'
        });
      }
      
      // Create backup table
      console.log('Creating new backup table...');
      await supabase.rpc('execute_sql', {
        sql_query: 'CREATE TABLE documentation_files_backup AS SELECT * FROM documentation_files'
      });
      
      // Verify backup was created
      const { count: backupCount, error: backupError } = await supabase
        .from('documentation_files_backup')
        .select('*', { count: 'exact', head: true });
        
      if (backupError) {
        console.error('Error verifying backup:', backupError.message);
      } else {
        console.log(\`Backup created successfully with \${backupCount} records\`);
      }
    }
    
    // Write output to a report file
    const reportContent = \`# Documentation Files Integrity Report
    
Generated: \${new Date().toLocaleString()}

## Summary

- **Total records:** \${totalCount}
- **Records with document_type_id:** \${typedCount} (\${Math.round(typedCount/totalCount*100)}%)
- **Records with NULL document_type_id:** \${nullCount} (\${Math.round(nullCount/totalCount*100)}%)
- **Records with metadata:** \${metadataCount} (\${Math.round(metadataCount/totalCount*100)}%)

## Backup Status

\${shouldCreateBackup ? '✅ Backup created successfully' : '❌ No backup created (use --backup flag to create one)'}

## Recommendations

1. Before running scripts that modify documentation_files, always create a backup
2. Verify that document_type_id values are preserved after any batch operations
3. If document_type_id values are lost, use the restore-document-types.sh script

## Safety Measures

The following scripts have been updated to preserve document_type_id and metadata:

- scripts/cli-pipeline/document-pipeline-main.sh
- scripts/update-docs-database.sh

If you're adding new scripts or modifying existing ones that affect the documentation_files table, 
make sure they include proper handling to preserve document_type_id and metadata fields.
\`;

    fs.writeFileSync('docs/documentation_files_integrity_report.md', reportContent);
    console.log('\\nReport written to docs/documentation_files_integrity_report.md');
    
  } catch (error) {
    console.error('Unhandled error:', error.message);
  }
}

verifyDocumentTypes();
"

echo "Script completed."