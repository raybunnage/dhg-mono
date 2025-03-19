#!/bin/bash

# Main document pipeline script that orchestrates the document management process
# This script calls document-manager.sh with various options to manage documentation files

# Change to the project root directory (from cli-pipeline directory to project root)
cd "$(dirname "$0")/../.." || exit 1

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

# Define the document manager script path - use absolute path from current script location
DOC_MANAGER="$(dirname "$0")/document-manager.sh"

# Check if document manager script exists
if [ ! -f "$DOC_MANAGER" ]; then
  echo "Error: Document manager script not found at $DOC_MANAGER"
  exit 1
fi

# Function to display script usage
show_usage() {
  echo "Document Pipeline Main Script"
  echo "Usage: $0 [option]"
  echo "Options:"
  echo "  sync           - Synchronize database with files on disk (mark files as deleted/not deleted)"
  echo "  find-new       - Find and insert new files on disk into the database"
  echo "  show-untyped   - Show all documentation files without a document type"
  echo "  show-recent    - Show the 20 most recent files based on update date"
  echo "  classify-recent - Classify the 20 most recent files"
  echo "  all            - Run the complete pipeline (sync, find-new, classify-recent)"
  echo "  help           - Show this help message"
}

# Function to mark files as deleted/not deleted based on disk presence
sync_files() {
  echo "=== Synchronizing files with database ==="
  
  # Get all files from documentation_files
  echo "Getting all files from the database..."
  DB_FILES=$(SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    npx ts-node -e "
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient('$SUPABASE_URL', '$SUPABASE_SERVICE_ROLE_KEY');
    async function getFiles() {
      const { data, error } = await supabase
        .from('documentation_files')
        .select('id, file_path');
      if (error) console.error('Error fetching files:', error);
      else console.log(JSON.stringify(data));
    }
    getFiles();
  ")
  
  # Process each file
  echo "$DB_FILES" | jq -c '.[]' | while read -r file; do
    FILE_PATH=$(echo "$file" | jq -r '.file_path')
    FILE_ID=$(echo "$file" | jq -r '.id')
    
    # Check if file exists on disk
    if [ -f "$FILE_PATH" ]; then
      # Mark as not deleted
      echo "File exists on disk: $FILE_PATH - Marking as not deleted"
      SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
      npx ts-node -e "
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient('$SUPABASE_URL', '$SUPABASE_SERVICE_ROLE_KEY');
        async function updateFile() {
          const { data, error } = await supabase
            .from('documentation_files')
            .update({ is_deleted: false })
            .eq('id', '$FILE_ID');
          if (error) console.error('Error updating file:', error);
          else console.log('File updated successfully');
        }
        updateFile();
      "
    else
      # Mark as deleted
      echo "File does not exist on disk: $FILE_PATH - Marking as deleted"
      SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
      npx ts-node -e "
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient('$SUPABASE_URL', '$SUPABASE_SERVICE_ROLE_KEY');
        async function updateFile() {
          const { data, error } = await supabase
            .from('documentation_files')
            .update({ is_deleted: true })
            .eq('id', '$FILE_ID');
          if (error) console.error('Error updating file:', error);
          else console.log('File updated successfully');
        }
        updateFile();
      "
    fi
  done
  
  echo "File synchronization complete"
}

# Function to find new files on disk and insert them into the database
find_new_files() {
  echo "=== Finding new files on disk ==="
  
  # Get existing file paths from database
  echo "Getting existing file paths from the database..."
  EXISTING_FILES=$(SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    npx ts-node -e "
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient('$SUPABASE_URL', '$SUPABASE_SERVICE_ROLE_KEY');
    async function getFiles() {
      const { data, error } = await supabase
        .from('documentation_files')
        .select('file_path');
      if (error) console.error('Error fetching files:', error);
      else console.log(JSON.stringify(data.map(f => f.file_path)));
    }
    getFiles();
  ")
  
  # Find markdown files on disk
  echo "Finding markdown files on disk..."
  DISK_FILES=$(find . -type f -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*" | sed 's|^\./||')
  
  # Create a temporary file with all disk files
  echo "$DISK_FILES" > /tmp/disk_files.txt
  
  # Create a temporary file with existing DB files
  echo "$EXISTING_FILES" | jq -r '.[]' > /tmp/db_files.txt
  
  # Find new files
  echo "Identifying new files to insert into the database..."
  NEW_FILES=$(grep -Fxvf /tmp/db_files.txt /tmp/disk_files.txt)
  
  # Insert new files into database
  echo "$NEW_FILES" | while read -r file_path; do
    if [ -n "$file_path" ]; then
      echo "Checking file: $file_path"
      SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
      npx ts-node -e "
        const { createClient } = require('@supabase/supabase-js');
        const fs = require('fs');
        const crypto = require('crypto');
        const supabase = createClient('$SUPABASE_URL', '$SUPABASE_SERVICE_ROLE_KEY');
        
        async function processFile() {
          try {
            // First check if the file already exists in the database
            const { data: existingFile, error: checkError } = await supabase
              .from('documentation_files')
              .select('id')
              .eq('file_path', '$file_path')
              .maybeSingle();
              
            if (checkError) {
              console.error('Error checking existing file:', checkError);
              return;
            }
            
            if (existingFile) {
              console.log('File already exists in database, skipping: $file_path');
              return;
            }
            
            // Get file stats
            const filename = '$file_path'.split('/').pop();
            const now = new Date().toISOString();
            const stats = fs.statSync('$file_path');
            const fileContent = fs.readFileSync('$file_path', 'utf8');
            
            // Create a simple hash for file content tracking
            const fileHash = crypto.createHash('md5').update(fileContent).digest('hex') + '-' + stats.size;
            
            // Create metadata object
            const metadata = {
              size: stats.size,
              isPrompt: false,
              created: now,
              modified: now
            };
            
            console.log('Inserting new file into database: $file_path');
            
            // Insert record
            const { data, error } = await supabase
              .from('documentation_files')
              .insert({
                file_path: '$file_path',
                title: filename,
                is_deleted: false,
                last_indexed_at: now,
                last_modified_at: now,
                file_hash: fileHash,
                metadata: metadata
              });
              
            if (error) console.error('Error inserting file:', error);
            else console.log('File inserted successfully');
          } catch (err) {
            console.error('File processing error:', err);
          }
        }
        
        processFile();
      "
      # Rate limiting - small pause between API calls
      sleep 0.5
    fi
  done
  
  # Clean up temporary files
  rm /tmp/disk_files.txt /tmp/db_files.txt
  
  echo "New file insertion complete"
}

# Function to show all documentation files without a document type
show_untyped_files() {
  echo "=== Showing files without document types ==="
  
  # Run as a direct js function to avoid bash interpolation issues
  node -e "
    const { createClient } = require('@supabase/supabase-js');
    const fs = require('fs');
    
    async function showUntypedFiles() {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      try {
        console.log('Fetching files without document types...');
        
        const { data, error } = await supabase
          .from('documentation_files')
          .select('id, file_path, title, last_modified_at')
          .is('document_type_id', null)
          .eq('is_deleted', false)
          .order('last_modified_at', { ascending: false });
          
        if (error) {
          console.error('Error fetching files:', error);
          return;
        }
        
        if (!data || data.length === 0) {
          console.log('No files found without document types.');
          return;
        }
        
        console.log('Files without document types:');
        console.log('----------------------------');
        
        let existingFileCount = 0;
        
        for (const file of data) {
          // Check if file exists on disk
          if (fs.existsSync(file.file_path)) {
            existingFileCount++;
            console.log(\`ID: \${file.id}\`);
            console.log(\`Path: \${file.file_path}\`);
            console.log(\`Title: \${file.title || 'No title'}\`);
            console.log(\`Updated: \${file.last_modified_at ? new Date(file.last_modified_at).toLocaleString() : 'No update date'}\`);
            console.log('----------------------------');
          }
        }
        
        console.log(\`Total untyped files that exist on disk: \${existingFileCount}\`);
      } catch (err) {
        console.error('Error in showUntypedFiles:', err);
      }
    }
    
    showUntypedFiles();
  "
}

# Function to show the 20 most recent files
show_recent_files() {
  echo "=== Showing 20 most recent files ==="
  
  SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  npx ts-node -e "
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient('$SUPABASE_URL', '$SUPABASE_SERVICE_ROLE_KEY');
    
    async function showRecentFiles() {
      const { data, error } = await supabase
        .from('documentation_files')
        .select('id, file_path, file_name, document_type, updated_at')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(20);
        
      if (error) {
        console.error('Error fetching files:', error);
        return;
      }
      
      console.log('20 Most Recent Files:');
      console.log('----------------------------');
      
      for (const file of data) {
        console.log(`ID: ${file.id}`);
        console.log(`Path: ${file.file_path}`);
        console.log(`Name: ${file.file_name}`);
        console.log(`Type: ${file.document_type || 'UNCLASSIFIED'}`);
        console.log(`Updated: ${new Date(file.updated_at).toLocaleString()}`);
        console.log('----------------------------');
      }
    }
    
    showRecentFiles();
  "
}

# Function to classify the 20 most recent files
classify_recent_files() {
  echo "=== Classifying 20 most recent files ==="
  
  # Get 20 most recent files
  RECENT_FILES=$(SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    npx ts-node -e "
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient('$SUPABASE_URL', '$SUPABASE_SERVICE_ROLE_KEY');
    const fs = require('fs');
    
    async function getRecentFiles() {
      const { data, error } = await supabase
        .from('documentation_files')
        .select('id, file_path')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(20);
        
      if (error) {
        console.error('Error fetching files:', error);
        return;
      }
      
      // Filter for files that exist on disk
      const existingFiles = data.filter(f => fs.existsSync(f.file_path));
      console.log(JSON.stringify(existingFiles));
    }
    
    getRecentFiles();
  ")
  
  # Process each file with rate limiting
  echo "$RECENT_FILES" | jq -c '.[]' | while read -r file; do
    FILE_PATH=$(echo "$file" | jq -r '.file_path')
    
    echo "Classifying file: $FILE_PATH"
    "$DOC_MANAGER" classify "$FILE_PATH" "markdown-document-classification-prompt"
    
    # Rate limiting for API calls (30 seconds between classifications)
    echo "Waiting 30 seconds for rate limiting..."
    sleep 30
  done
  
  echo "Classification of recent files complete"
}

# Main script logic
case "$1" in
  "sync")
    sync_files
    ;;
  "find-new")
    find_new_files
    ;;
  "show-untyped")
    show_untyped_files
    ;;
  "show-recent")
    show_recent_files
    ;;
  "classify-recent")
    classify_recent_files
    ;;
  "all")
    echo "=== Running complete document pipeline ==="
    sync_files
    find_new_files
    classify_recent_files
    ;;
  "help"|*)
    show_usage
    ;;
esac

echo "Document pipeline process complete"