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
  echo "  clean-script-results - Remove script-analysis-results files from the database"
  echo "  all            - Run the complete pipeline (sync, find-new, classify-recent)"
  echo "  help           - Show this help message"
}

# Function to mark files as deleted/not deleted based on disk presence
sync_files() {
  echo "=== Synchronizing files with database ==="
  
  # Make sure supabase module is installed
  npm list @supabase/supabase-js >/dev/null 2>&1 || npm install --no-save @supabase/supabase-js >/dev/null 2>&1
  
  # Get all files from documentation_files with their hashes to detect changes
  echo "Getting all files from the database..."
  DB_FILES=$(SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    npx ts-node --compilerOptions '{"module":"NodeNext","moduleResolution":"NodeNext"}' -e "
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient('$SUPABASE_URL', '$SUPABASE_SERVICE_ROLE_KEY');
    async function getFiles() {
      const { data, error } = await supabase
        .from('documentation_files')
        .select('id, file_path, file_hash');
      if (error) console.error('Error fetching files:', error);
      else console.log(JSON.stringify(data));
    }
    getFiles();
  ")
  
  # Create batch update scripts for faster processing
  TEMP_DIR=$(mktemp -d)
  EXIST_BATCH="$TEMP_DIR/exist_batch.js"
  DELETED_BATCH="$TEMP_DIR/deleted_batch.js"
  
  # Create package.json for batch scripts
  cat > "$TEMP_DIR/package.json" << 'EOL'
{
  "name": "temp-batch-script",
  "version": "1.0.0",
  "description": "Temporary batch script for file synchronization",
  "main": "index.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.48.1"
  }
}
EOL

  # Install dependencies
  (cd "$TEMP_DIR" && npm install --silent @supabase/supabase-js >/dev/null 2>&1)
  
  # Create JS file for batch updating existing files (no changes)
  cat > "$EXIST_BATCH" << 'EOL'
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function batchUpdate() {
  const fileIds = process.argv.slice(2);
  if (fileIds.length === 0) return;
  
  console.log(`Batch updating ${fileIds.length} files as not deleted`);
  
  // Split into chunks of 50 for better performance
  for (let i = 0; i < fileIds.length; i += 50) {
    const chunk = fileIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('documentation_files')
      .update({ is_deleted: false })
      .in('id', chunk);
      
    if (error) console.error('Error batch updating files:', error);
    else console.log(`Updated ${chunk.length} files successfully`);
  }
}

batchUpdate();
EOL

  cat > "$DELETED_BATCH" << 'EOL'
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function batchUpdate() {
  const fileIds = process.argv.slice(2);
  if (fileIds.length === 0) return;
  
  console.log(`Batch updating ${fileIds.length} files as deleted`);
  
  // Split into chunks of 50 for better performance
  for (let i = 0; i < fileIds.length; i += 50) {
    const chunk = fileIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('documentation_files')
      .update({ is_deleted: true })
      .in('id', chunk);
      
    if (error) console.error('Error batch updating files:', error);
    else console.log(`Updated ${chunk.length} files successfully`);
  }
}

batchUpdate();
EOL

  # Create batch update script for modified files
  UPDATED_BATCH="$TEMP_DIR/updated_batch.js"
  cat > "$UPDATED_BATCH" << 'EOL'
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Function to calculate file hash - same as in batch processor
async function quickFileHash(filePath) {
  try {
    const stats = fs.statSync(filePath);
    
    // Always include the full content hash to ensure changes are detected
    const content = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    
    // Return just the content hash to ensure content changes are detected
    return hash;
  } catch (err) {
    console.error(`Error hashing file ${filePath}:`, err.message);
    return null;
  }
}

async function batchUpdate() {
  // Format: id|file_path|old_hash
  const files = process.argv.slice(2);
  if (files.length === 0) return;
  
  console.log(`Processing ${files.length} files for updates`);
  const updates = [];
  
  for (const fileInfo of files) {
    const [fileId, filePath, oldHash] = fileInfo.split('|');
    
    // Skip if file doesn't exist or we can't get info
    try {
      if (!fs.existsSync(filePath)) continue;
      
      // Calculate new hash
      const newHash = await quickFileHash(filePath);
      if (!newHash) continue;
      
      // If hash changed or is empty, prepare update
      // Console.log actual contents for debugging
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`File ${filePath}: First 100 chars: "${content.substring(0, 100).replace(/\n/g, '\\n')}..."`);
      
      if (!oldHash || newHash !== oldHash) {
        console.log(`File ${filePath} changed: old hash "${oldHash}", new hash "${newHash}"`);
        const now = new Date().toISOString();
        const filename = path.basename(filePath);
        const stats = fs.statSync(filePath);
        
        try {
          // Get current metadata if any
          let currentMetadata = {};
          try {
            const { data } = await supabase
              .from('documentation_files')
              .select('metadata')
              .eq('id', fileId)
              .single();
            
            if (data && data.metadata) {
              currentMetadata = data.metadata;
            }
          } catch (e) {
            console.log(`Could not get existing metadata for ${filePath}: ${e.message}`);
          }
          
          // Preserve existing metadata fields, just update size and modified
          const updatedMetadata = {
            ...currentMetadata,
            size: stats.size,
            modified: now
          };
          
          // Add to updates
          updates.push({
            id: fileId,
            file_path: filePath,
            title: filename,
            is_deleted: false,
            last_modified_at: now,
            last_indexed_at: now,
            file_hash: newHash,
            metadata: updatedMetadata
          });
        } catch (err) {
          console.error(`Error preparing update for ${filePath}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err.message);
    }
  }
  
  // Process updates in batches of 25
  if (updates.length > 0) {
    console.log(`Updating ${updates.length} modified files...`);
    
    for (let i = 0; i < updates.length; i += 25) {
      const batch = updates.slice(i, i + 25);
      
      // Update each file individually for accurate metadata
      for (const item of batch) {
        const { id, ...updateData } = item;
        const { error } = await supabase
          .from('documentation_files')
          .update(updateData)
          .eq('id', id);
          
        if (error) {
          console.error(`Error updating file ${item.file_path}:`, error);
        }
      }
      
      console.log(`Batch ${Math.floor(i/25) + 1}: Updated ${batch.length} files`);
    }
  } else {
    console.log('No files were modified');
  }
}

batchUpdate();
EOL

  # Temporary files to store file IDs - using files to avoid subshell issues with arrays
  EXIST_IDS_FILE="$TEMP_DIR/exist_ids.txt"
  DELETED_IDS_FILE="$TEMP_DIR/deleted_ids.txt"
  UPDATED_FILES_FILE="$TEMP_DIR/updated_files.txt"
  
  # Create empty files
  touch "$EXIST_IDS_FILE" "$DELETED_IDS_FILE" "$UPDATED_FILES_FILE"
  
  # Process each file and add to appropriate file
  echo "$DB_FILES" | jq -c '.[]' | while read -r file; do
    FILE_PATH=$(echo "$file" | jq -r '.file_path')
    FILE_ID=$(echo "$file" | jq -r '.id')
    FILE_HASH=$(echo "$file" | jq -r '.file_hash // ""')
    
    # Check if file exists on disk
    if [ -f "$FILE_PATH" ]; then
      echo "File exists: $FILE_PATH"
      echo "$FILE_ID" >> "$EXIST_IDS_FILE"
      
      # Store file info for hash checking
      echo "$FILE_ID|$FILE_PATH|$FILE_HASH" >> "$UPDATED_FILES_FILE"
    else
      echo "File missing: $FILE_PATH"
      echo "$FILE_ID" >> "$DELETED_IDS_FILE"
    fi
  done
  
  # Count files in each category
  EXIST_COUNT=$(wc -l < "$EXIST_IDS_FILE")
  DELETED_COUNT=$(wc -l < "$DELETED_IDS_FILE")
  
  # Update existing files in batch (just mark as not deleted)
  if [ $EXIST_COUNT -gt 0 ]; then
    echo "Updating $EXIST_COUNT existing files in batch..."
    (cd "$TEMP_DIR" && SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
      node "$EXIST_BATCH" $(cat "$EXIST_IDS_FILE"))
  fi
  
  # Update deleted files in batch
  if [ $DELETED_COUNT -gt 0 ]; then
    echo "Updating $DELETED_COUNT deleted files in batch..."
    (cd "$TEMP_DIR" && SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
      node "$DELETED_BATCH" $(cat "$DELETED_IDS_FILE"))
  fi
  
  # Check for modified files by comparing hashes
  echo "Checking for modified files..."
  (cd "$TEMP_DIR" && SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    node "$UPDATED_BATCH" $(cat "$UPDATED_FILES_FILE"))
  
  # Clean up
  rm -rf "$TEMP_DIR"
  
  echo "File synchronization complete"
}

# Function to find new files on disk and insert them into the database
find_new_files() {
  # Check if DRY_RUN mode is enabled
  if [ -n "$DRY_RUN" ]; then
    echo "=== Finding new files on disk (DRY RUN MODE - WILL NOT INSERT) ==="
  else
    echo "=== Finding new files on disk ==="
  fi
  
  # Get existing file paths from database - doing this in one shot
  echo "Getting existing file paths from the database..."
  EXISTING_FILES=$(SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    npx ts-node --transpile-only --compilerOptions '{"module":"NodeNext","moduleResolution":"NodeNext"}' -e "
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
  
  # Create a temporary directory for all our temp files
  TEMP_DIR=$(mktemp -d)
  
  # Make sure supabase module is installed
  npm list @supabase/supabase-js >/dev/null 2>&1 || npm install --no-save @supabase/supabase-js >/dev/null 2>&1
  
  # Create a package.json in the temp directory to help with dependency installation
  cat > "$TEMP_DIR/package.json" << 'EOL'
{
  "name": "temp-file-processor",
  "version": "1.0.0",
  "description": "Temporary file processor",
  "main": "file_processor.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.48.1"
  }
}
EOL

  # Pre-install dependencies in the temp directory
  (cd "$TEMP_DIR" && npm install --silent >/dev/null 2>&1)
  
  # Directly print file paths to avoid problems with linebreaks in filenames
  # Use -type f first to avoid traversing non-file paths (much faster)
  echo "Finding markdown files on disk (excluding system, archive, and backup directories)..."
  
  # Get absolute path to current directory
  ABS_PWD=$(pwd)
  
  # Use find with absolute paths but store paths relative to project root
  find "$ABS_PWD" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" \
    -not -path "*/script-analysis-results/*" -not -path "*/script-analysis-results/*" \
    -not -path "*/archive/*" -not -path "*/_archive/*" -not -path "*/backup/*" -not -path "*/file_types/*" \
    -not -path "*/dist/*" \
    -name "*.md" | sed "s|$ABS_PWD/||" > "$TEMP_DIR/all_files.txt"
  
  # Log the first few files found for verification
  echo "First 10 files found:"
  head -10 "$TEMP_DIR/all_files.txt"
  
  DISK_FILES=$(cat "$TEMP_DIR/all_files.txt")
  DISK_FILES_PATH="$TEMP_DIR/disk_files.txt"
  DB_FILES_PATH="$TEMP_DIR/db_files.txt"
  
  # Create a temporary file with all disk files
  echo "$DISK_FILES" > "$DISK_FILES_PATH"
  
  # Create a temporary file with existing DB files
  echo "$EXISTING_FILES" | jq -r '.[]' > "$DB_FILES_PATH"
  
  # Find new files
  echo "Identifying new files to insert into the database..."
  NEW_FILES=$(grep -Fxvf "$DB_FILES_PATH" "$DISK_FILES_PATH")
  
  # Optimize with improved batch processing and parallelization
  MAX_PARALLEL_JOBS=4  # Number of parallel processes to run
  BATCH_SIZE=50        # Increased batch size for better throughput
  FILE_COUNT=$(echo "$NEW_FILES" | wc -l)
  PROCESSOR_SCRIPT="$TEMP_DIR/file_processor.js"
  
  echo "Processing $FILE_COUNT new files in parallel batches of $BATCH_SIZE..."
  
  # Create a more efficient TypeScript script for batch processing using CommonJS
  cat > "$PROCESSOR_SCRIPT" << 'EOL'
// Using CommonJS style to avoid module resolution issues
// First make sure we have the dependency installed
try {
  require('@supabase/supabase-js');
} catch (e) {
  console.log('Installing @supabase/supabase-js...');
  require('child_process').execSync('npm install --no-save @supabase/supabase-js', {stdio: 'inherit'});
}

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { promisify } = require('util');

// Function to generate a UUID v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);

// Removed TypeScript interfaces for plain JS compatibility

// Faster hashing function - only hash first 8KB of the file plus size/mtime
async function quickFileHash(filePath, stats) {
  // Get project root from environment variable and ensure filePath is absolute
  const projectRoot = process.env.PROJECT_ROOT || process.cwd();
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
  
  try {
    // For small files, hash entire content
    if (stats.size <= 8192) {
      const content = await readFileAsync(absolutePath, 'utf8');
      return crypto.createHash('md5').update(content).digest('hex') + '-' + stats.size;
    }
    
    // For larger files, hash first 8KB + file stats for a quick fingerprint
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(absolutePath, { start: 0, end: 8191 });
      const hash = crypto.createHash('md5');
      
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => {
        // Add file size and mtime to ensure uniqueness
        hash.update(`${stats.size}-${stats.mtimeMs}`);
        resolve(hash.digest('hex') + '-' + stats.size);
      });
      stream.on('error', (err) => {
        console.error(`Error reading file ${absolutePath}:`, err.message);
        reject(err);
      });
    });
  } catch (err) {
    console.error(`Error processing file ${absolutePath}:`, err.message);
    throw err;
  }
}

async function processFiles() {
  // Get batch index and file paths
  const batchIndex = parseInt(process.argv[2], 10);
  const filePaths = process.argv.slice(3);
  
  // Validate environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  // Create supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log(`[Batch ${batchIndex}] Processing ${filePaths.length} files`);
  
  try {
    // First check which files already exist to avoid processing them
    const { data: existingFiles, error: checkError } = await supabase
      .from('documentation_files')
      .select('file_path')
      .in('file_path', filePaths);
      
    if (checkError) {
      console.error(`[Batch ${batchIndex}] Error checking existing files:`, checkError);
      process.exit(1);
    }
    
    // Create a set of existing file paths for faster lookups
    const existingPathsSet = new Set(existingFiles.map(f => f.file_path));
    const newFilePaths = filePaths.filter(path => !existingPathsSet.has(path));
    
    if (newFilePaths.length === 0) {
      console.log(`[Batch ${batchIndex}] All files already exist in database, nothing to process`);
      process.exit(0);
    }
    
    console.log(`[Batch ${batchIndex}] Processing ${newFilePaths.length} new files...`);
    
    // Process files in parallel with Promise.all for maximum performance
    const now = new Date().toISOString();
    const filePromises = newFilePaths.map(async (filePath) => {
      try {
        // Get project root from environment variable
        const projectRoot = process.env.PROJECT_ROOT || process.cwd();
        console.log(`Using project root: ${projectRoot}`);
        // Create absolute path using project root
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
        
        console.log(`[Batch ${batchIndex}] Processing file: ${filePath}`);
        
        // Check if file exists and get stats
        if (!fs.existsSync(absolutePath)) {
          console.error(`[Batch ${batchIndex}] File does not exist: ${absolutePath}`);
          return null;
        }
        
        const stats = await statAsync(absolutePath);
        
        // Get file info
        const filename = path.basename(absolutePath);
        
        // Generate quick hash
        const fileHash = await quickFileHash(absolutePath, stats);
        
        // First check if this file already exists in the database but with a different path
        // This is critical to preserve metadata and document_type_id when files are moved
        const { data: existingFile } = await supabase
          .from('documentation_files')
          .select('*')
          .eq('title', filename)
          .eq('is_deleted', true) // Look in deleted files for possible moves
          .maybeSingle();
        
        // If we found a match, use its metadata and other fields
        if (existingFile && existingFile.metadata) {
          console.log(`[Batch ${batchIndex}] Found existing file in database with title: ${filename}`);
          console.log(`[Batch ${batchIndex}] Using existing metadata and document_type_id: ${existingFile.document_type_id || 'null'}`);
          
          // Update the existing metadata with new size and modified time
          const updatedMetadata = {
            ...existingFile.metadata,
            size: stats.size,
            modified: now
          };
          
          // Use relative path for storage - this is very important
          return {
            id: uuidv4(), // Generate a new UUID for this record
            file_path: filePath, // Store the relative path, not the absolute path
            title: filename,
            is_deleted: false,
            last_indexed_at: now,
            last_modified_at: now,
            file_hash: fileHash,
            metadata: updatedMetadata,
            document_type_id: existingFile.document_type_id // Preserve document type ID
          };
        }
        
        // If no existing file found, create new metadata
        console.log(`[Batch ${batchIndex}] No existing file found with title: ${filename}, creating new record`);
        const metadata = {
          size: stats.size,
          isPrompt: false,
          created: now,
          modified: now
        };
        
        // Important: Check if this file exists in database but with a different path
        // This could happen if files were moved but kept same name
        const basename = path.basename(absolutePath);
        let existingDocumentTypeId = null;
        
        try {
          // Query to see if we have a file with same basename but different path
          // and get its document_type_id if available
          const { data } = await supabase
            .from('documentation_files')
            .select('document_type_id, is_deleted')
            .eq('title', filename)
            .eq('is_deleted', true) // Look in deleted files for possible moves
            .maybeSingle();
          
          if (data && data.document_type_id) {
            console.log(`[Batch ${batchIndex}] Found existing document_type_id: ${data.document_type_id} for file: ${basename}`);
            existingDocumentTypeId = data.document_type_id;
          }
        } catch (err) {
          console.log(`[Batch ${batchIndex}] No matching document_type_id found for ${basename}`);
        }
        
        // Return the record, preserving document_type_id if found
        // IMPORTANT: Use relative path, not absolute path
        // CRITICAL: Generate a UUID for the id field to ensure Supabase constraint is satisfied
        return {
          id: uuidv4(), // Generate a UUID for new records
          file_path: filePath, // Store the relative path, not absolute
          title: filename,
          is_deleted: false,
          last_indexed_at: now,
          last_modified_at: now,
          file_hash: fileHash,
          metadata: metadata,
          document_type_id: existingDocumentTypeId // Preserve document type ID if found
        };
      } catch (err) {
        console.error(`[Batch ${batchIndex}] Error processing ${filePath}:`, err.message);
        return null;
      }
    });
    
    // Wait for all file processing to complete
    const processedRecords = (await Promise.all(filePromises)).filter(Boolean);
    
    if (processedRecords.length === 0) {
      console.log(`[Batch ${batchIndex}] No valid files to insert`);
      process.exit(0);
    }
    
    console.log(`[Batch ${batchIndex}] Inserting ${processedRecords.length} files...`);
    
    // Just log the files in dry-run mode (don't insert)
    console.log(`[Batch ${batchIndex}] DRY RUN - Would insert ${processedRecords.length} files...`);
    
    // Log each file that would be inserted
    for (const record of processedRecords) {
      // Get file path relative to project root for display
      const relPath = record.file_path.replace(process.cwd(), '').replace(/^\//, '');
      console.log(`[Batch ${batchIndex}] Would insert: ${relPath} (with ${record.document_type_id ? 'document_type_id: ' + record.document_type_id : 'no document_type_id'})`);
      
      // Make sure the path format is correct
      if (!relPath.match(/^(docs|packages|apps|prompts|scripts)/)) {
        console.log(`[Batch ${batchIndex}] WARNING: Path may not be relative to project root: ${relPath}`);
      }
    }
    
    // Insert records in the database - uncomment to actually insert
    for (let i = 0; i < processedRecords.length; i += 25) {
      const chunk = processedRecords.slice(i, i + 25);
      
      // Verify that all records have UUIDs before inserting
      const validChunk = chunk.map(record => {
        if (!record.id) {
          console.log(`[Batch ${batchIndex}] Adding missing UUID for record: ${record.file_path}`);
          record.id = uuidv4();
        }
        return record;
      });
      
      const { data, error } = await supabase
        .from('documentation_files')
        .insert(validChunk);
        
      if (error) {
        console.error(`[Batch ${batchIndex}] Error inserting chunk ${i}:`, error);
        console.error(`[Batch ${batchIndex}] Error details: ${JSON.stringify(error)}`);
      } else {
        console.log(`[Batch ${batchIndex}] Successfully inserted ${validChunk.length} files (chunk ${Math.floor(i/25) + 1})`);
      }
    }
    
    console.log(`[Batch ${batchIndex}] Completed processing ${processedRecords.length} files`);
  } catch (err) {
    console.error(`[Batch ${batchIndex}] Batch processing error:`, err);
    process.exit(1);
  }
}

// Execute the batch processing
processFiles();
EOL
  
  # Prepare batches for parallel processing
  if [ -n "$NEW_FILES" ]; then
    # Split files into temporary batch files for parallel processing
    BATCH_COUNT=0
    SPLIT_CMD="split -l $BATCH_SIZE"
    echo "$NEW_FILES" | $SPLIT_CMD - "$TEMP_DIR/batch_"
    
    # Start parallel processing of batches
    for BATCH_FILE in "$TEMP_DIR"/batch_*; do
      # Process each batch file in parallel
      BATCH_COUNT=$((BATCH_COUNT + 1))
      (
        # Read file paths from batch file
        BATCH_PATHS=()
        while IFS= read -r filepath; do
          [ -n "$filepath" ] && BATCH_PATHS+=("$filepath")
        done < "$BATCH_FILE"
        
        # Only process if we have files
        if [ ${#BATCH_PATHS[@]} -gt 0 ]; then
          echo "Starting batch $BATCH_COUNT with ${#BATCH_PATHS[@]} files..."
          
          # Create a simpler script for listing files
          echo "Checking the relative paths for all files in batch $BATCH_COUNT"
          # Create a simpler script that just lists the files
          LIST_SCRIPT="$TEMP_DIR/list_files.js"
          cat > "$LIST_SCRIPT" << 'EOLL'
const fs = require('fs');
const path = require('path');

// Just list all files to confirm they exist and show their paths
async function listFiles() {
  const filePaths = process.argv.slice(2);
  console.log(`Checking ${filePaths.length} files:`);
  
  for (const filePath of filePaths) {
    // Check if file exists
    const fullPath = path.join(process.cwd(), filePath);
    const exists = fs.existsSync(fullPath);
    const fileInfo = exists 
      ? `EXISTS - ${filePath}` 
      : `MISSING - ${filePath} (full path: ${fullPath})`;
    
    console.log(fileInfo);
  }
}

listFiles();
EOLL
          
          # Run the simplified script
          node "$LIST_SCRIPT" "${BATCH_PATHS[@]}"
          
          # Also run the actual processor that will insert to the database
          if [ -z "$DRY_RUN" ]; then
            # Install dependencies if needed
            npm list @supabase/supabase-js >/dev/null 2>&1 || npm install --no-save @supabase/supabase-js >/dev/null 2>&1
            
            # Run the processor from within the temp directory where dependencies are installed
            # Pass the project root directory as an environment variable
            (cd "$TEMP_DIR" && PROJECT_ROOT="$ABS_PWD" SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
              node "file_processor.js" "$BATCH_COUNT" "${BATCH_PATHS[@]}")
          fi
        fi
      ) &
      
      # Limit the number of parallel jobs
      RUNNING_JOBS=$(jobs -p | wc -l)
      if [ $RUNNING_JOBS -ge $MAX_PARALLEL_JOBS ]; then
        # Wait for one job to complete before starting another
        wait -n
      fi
    done
    
    # Wait for all remaining jobs to complete
    echo "Waiting for all file processing jobs to complete..."
    wait
  else
    echo "No new files found to process"
  fi
  
  # Clean up
  rm -rf "$TEMP_DIR"
  
  echo "New file insertion complete"
}

# Function to show all documentation files without a document type
show_untyped_files() {
  echo "=== Showing files without document types ==="
  
  # Make sure supabase module is installed
  npm list @supabase/supabase-js >/dev/null 2>&1 || npm install --no-save @supabase/supabase-js >/dev/null 2>&1
  
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
  
  # Make sure supabase module is installed
  npm list @supabase/supabase-js >/dev/null 2>&1 || npm install --no-save @supabase/supabase-js >/dev/null 2>&1
  
  # Run as direct node execution to avoid bash interpolation issues
  node -e "
    const { createClient } = require('@supabase/supabase-js');
    const fs = require('fs');
    
    async function showRecentFiles() {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        console.log('Fetching 20 most recent files...');
        
        const { data, error } = await supabase
          .from('documentation_files')
          .select('id, file_path, title, document_type_id, last_modified_at')
          .eq('is_deleted', false)
          .order('last_modified_at', { ascending: false })
          .limit(20);
          
        if (error) {
          console.error('Error fetching files:', error);
          return;
        }
        
        if (!data || data.length === 0) {
          console.log('No recent files found.');
          return;
        }
        
        console.log('20 Most Recent Files:');
        console.log('----------------------------');
        
        for (const file of data) {
          // Check if file exists on disk
          const fileExists = fs.existsSync(file.file_path);
          const fileStatus = fileExists ? 'EXISTS' : 'MISSING';
          
          console.log(\`ID: \${file.id}\`);
          console.log(\`Path: \${file.file_path}\`);
          console.log(\`Title: \${file.title || 'No title'}\`);
          console.log(\`Type: \${file.document_type_id || 'UNCLASSIFIED'}\`);
          console.log(\`Status: \${fileStatus}\`);
          console.log(\`Updated: \${file.last_modified_at ? new Date(file.last_modified_at).toLocaleString() : 'No update date'}\`);
          console.log('----------------------------');
        }
      } catch (err) {
        console.error('Error in showRecentFiles:', err);
      }
    }
    
    showRecentFiles();
  "
}

# Function to classify the 20 most recent files
classify_recent_files() {
  echo "=== Classifying 20 most recent files ==="
  
  # Make sure supabase module is installed
  npm list @supabase/supabase-js >/dev/null 2>&1 || npm install --no-save @supabase/supabase-js >/dev/null 2>&1
  
  # Get 20 most recent files using node directly to avoid bash interpolation issues
  RECENT_FILES=$(node -e "
    const { createClient } = require('@supabase/supabase-js');
    const fs = require('fs');
    
    async function getRecentFiles() {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const { data, error } = await supabase
          .from('documentation_files')
          .select('id, file_path')
          .eq('is_deleted', false)
          .order('last_modified_at', { ascending: false })
          .limit(20);
          
        if (error) {
          console.error('Error fetching files:', error);
          return '[]';
        }
        
        if (!data || data.length === 0) {
          console.log('No recent files found for classification.');
          return '[]';
        }
        
        // Filter for files that exist on disk
        const existingFiles = data.filter(f => fs.existsSync(f.file_path));
        
        if (existingFiles.length === 0) {
          console.log('No files found on disk for classification.');
          return '[]';
        }
        
        console.log(\`Found \${existingFiles.length} files to classify\`);
        return JSON.stringify(existingFiles);
      } catch (err) {
        console.error('Error in getRecentFiles:', err);
        return '[]';
      }
    }
    
    // Run the async function and output the result
    getRecentFiles().then(result => {
      process.stdout.write(result);
    });
  ")
  
  # Check if we have files to process
  if [ "$RECENT_FILES" = "[]" ] || [ -z "$RECENT_FILES" ]; then
    echo "No files found for classification"
    return
  fi
  
  # Process files in batches with parallel execution
  # Create a temporary directory for batch files
  BATCH_DIR=$(mktemp -d)
  BATCH_SIZE=5  # Process 5 files in parallel
  COUNTER=0
  BATCH_NUM=1
  
  echo "$RECENT_FILES" | jq -c '.[]' | while read -r file; do
    FILE_PATH=$(echo "$file" | jq -r '.file_path')
    
    if [ -f "$FILE_PATH" ]; then
      # Add file to current batch
      echo "$FILE_PATH" >> "$BATCH_DIR/batch_$BATCH_NUM.txt"
      COUNTER=$((COUNTER + 1))
      
      # If batch is full, start a new batch
      if [ $COUNTER -ge $BATCH_SIZE ]; then
        COUNTER=0
        BATCH_NUM=$((BATCH_NUM + 1))
      fi
    else
      echo "File does not exist on disk, skipping: $FILE_PATH"
    fi
  done
  
  # Process all batches in parallel with a reasonable rate limit per batch
  echo "Starting parallel classification of $(find $BATCH_DIR -type f | wc -l) batches..."
  
  find "$BATCH_DIR" -type f | while read -r batch_file; do
    (
      echo "Processing batch: $batch_file"
      cat "$batch_file" | while read -r doc_path; do
        echo "Classifying file: $doc_path"
        "$DOC_MANAGER" classify "$doc_path" "markdown-document-classification-prompt"
        # Reduced rate limiting per file in batch (10 seconds instead of 30)
        sleep 10
      done
    ) &
  done
  
  # Wait for all background processes to finish
  echo "Waiting for all classification processes to complete..."
  wait
  
  # Clean up
  rm -rf "$BATCH_DIR"
  
  echo "Classification of recent files complete"
}

# Function to clean script-analysis-results files from the database
clean_script_results() {
  echo "=== Removing script-analysis-results files from the database ==="
  
  # Make sure supabase module is installed
  npm list @supabase/supabase-js >/dev/null 2>&1 || npm install --no-save @supabase/supabase-js >/dev/null 2>&1
  
  # Use npx ts-node approach instead of a standalone Node.js script
  # This ensures all required dependencies are available
  echo "Finding and removing script-analysis-results files from database..."
  
  SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  npx ts-node --transpile-only --compilerOptions '{"module":"NodeNext","moduleResolution":"NodeNext"}' -e "
    const { createClient } = require('@supabase/supabase-js');
    
    // Define file interface for type safety
    interface DocumentFile {
      id: string;
      file_path: string;
    }
    
    async function cleanScriptResults() {
      try {
        // Create client using environment variables for consistency
        const supabase = createClient(
          process.env.SUPABASE_URL as string,
          process.env.SUPABASE_SERVICE_ROLE_KEY as string
        );
        
        console.log('Finding script-analysis-results files in database...');
        
        // Find files with script-analysis-results in the path
        const { data, error } = await supabase
          .from('documentation_files')
          .select('id, file_path')
          .or('file_path.ilike.%script-analysis-results%');
          
        if (error) {
          console.error('Error finding files:', error);
          return;
        }
        
        if (!data || data.length === 0) {
          console.log('No script-analysis-results files found in the database.');
          return;
        }
        
        console.log(\`Found \${data.length} script-analysis-results files to remove:\`);
        
        // Show files to be removed with proper typing
        data.forEach((file: DocumentFile) => {
          console.log(\`  - \${file.file_path}\`);
        });
        
        // Get all file IDs with proper typing
        const fileIds = data.map((file: DocumentFile) => file.id);
        
        console.log(\`Removing \${fileIds.length} files in batch...\`);
        
        // Process in batches of 50
        for (let i = 0; i < fileIds.length; i += 50) {
          const batchIds = fileIds.slice(i, i + 50);
          
          const { error: deleteError } = await supabase
            .from('documentation_files')
            .delete()
            .in('id', batchIds);
            
          if (deleteError) {
            console.error(\`Error deleting batch \${i}:\`, deleteError);
          } else {
            console.log(\`Successfully removed batch \${Math.floor(i/50) + 1} (\${batchIds.length} files)\`);
          }
        }
        
        console.log('Script-analysis-results files have been removed from the database.');
      } catch (err) {
        console.error('Error in cleanScriptResults:', err);
      }
    }
    
    cleanScriptResults();
  "
  
  echo "Clean up complete"
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
  "clean-script-results")
    clean_script_results
    ;;
  "all")
    echo "=== Running complete document pipeline ==="
    clean_script_results
    sync_files
    find_new_files
    classify_recent_files
    ;;
  "help"|*)
    show_usage
    ;;
esac

echo "Document pipeline process complete"