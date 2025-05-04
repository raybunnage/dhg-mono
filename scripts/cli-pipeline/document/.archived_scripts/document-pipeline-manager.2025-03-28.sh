#!/bin/bash
# document-pipeline-manager.sh - Core document management functionality

# Set environment variables
export NODE_ENV="${NODE_ENV:-development}"

# Define paths and directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DOCUMENT_REPORTS_DIR="${ROOT_DIR}/reports"
DOCUMENT_LOGS_DIR="${ROOT_DIR}/document-analysis-results"
SUPABASE_CONNECT="${ROOT_DIR}/scripts/fix/supabase-connect.js"

# Create directories if they don't exist
mkdir -p "${DOCUMENT_REPORTS_DIR}"
mkdir -p "${DOCUMENT_LOGS_DIR}"

# Log configuration
LOG_FILE="${DOCUMENT_LOGS_DIR}/document-pipeline-$(date +%Y-%m-%d_%H-%M-%S).log"
exec > >(tee -a "${LOG_FILE}") 2>&1

# First, check if supabase-connect.js exists
if [ ! -f "${SUPABASE_CONNECT}" ]; then
  echo "Error: Cannot find supabase-connect.js at ${SUPABASE_CONNECT}"
  exit 1
fi

# Function to run a command with Supabase environment
function run_with_supabase() {
  echo "Running command with fixed Supabase environment: $@"
  node "${SUPABASE_CONNECT}" testSupabaseConnection
  
  if [ $? -ne 0 ]; then
    echo "❌ Supabase connection failed. Check your credentials."
    return 1
  fi
  
  # Run the command using runCommand from supabase-connect.js
  node "${SUPABASE_CONNECT}" runCommand "$@"
  return $?
}

# Function to synchronize database with files on disk
function sync_files() {
  echo "🔄 Syncing documentation files database with files on disk..."
  
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
  
  # Create JS file for standardizing metadata in all existing files
  cat > "$EXIST_BATCH" << 'EOL'
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rootDir = process.env.ROOT_DIR;
const dbFiles = JSON.parse(process.env.DB_FILES || '[]');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to calculate file hash
function calculateFileHash(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileContent).digest('hex');
  } catch (error) {
    console.error(`Error calculating hash for ${filePath}:`, error);
    return null;
  }
}

// Function to standardize metadata
async function standardizeMetadata() {
  console.log(`Processing ${dbFiles.length} files...`);
  let existCount = 0;
  let notExistCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  
  // Process files in batches to improve performance
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < dbFiles.length; i += batchSize) {
    batches.push(dbFiles.slice(i, i + batchSize));
  }
  
  console.log(`Processing ${batches.length} batches of files...`);
  
  for (const [batchIndex, batch] of batches.entries()) {
    console.log(`Processing batch ${batchIndex + 1}/${batches.length}...`);
    
    // Process each file in the batch
    for (const file of batch) {
      const filePath = path.join(rootDir, file.file_path);
      
      // Check if file exists
      if (fs.existsSync(filePath)) {
        existCount++;
        
        try {
          // Get file stats
          const stats = fs.statSync(filePath);
          const fileSize = stats.size;
          const mtime = stats.mtime;
          
          // Calculate hash
          const newHash = calculateFileHash(filePath);
          
          // Check if hash changed
          if (newHash !== file.file_hash) {
            // Hash changed, update record with new hash and metadata
            const { error } = await supabase
              .from('documentation_files')
              .update({
                file_hash: newHash,
                file_size: fileSize,
                last_modified_at: mtime,
                updated_at: new Date()
              })
              .eq('id', file.id);
            
            if (error) {
              console.error(`Error updating ${file.file_path}:`, error);
              errorCount++;
            } else {
              console.log(`Updated ${file.file_path} with new hash and metadata`);
              updatedCount++;
            }
          } else {
            // Ensure size field is standardized as file_size
            if (!file.file_size) {
              const { error } = await supabase
                .from('documentation_files')
                .update({
                  file_size: fileSize,
                  last_modified_at: mtime
                })
                .eq('id', file.id);
              
              if (error) {
                console.error(`Error standardizing metadata for ${file.file_path}:`, error);
                errorCount++;
              } else {
                console.log(`Standardized metadata for ${file.file_path}`);
                updatedCount++;
              }
            }
          }
        } catch (error) {
          console.error(`Error processing ${file.file_path}:`, error);
          errorCount++;
        }
      } else {
        // File doesn't exist, mark for deletion
        notExistCount++;
        console.log(`File ${file.file_path} no longer exists on disk`);
        
        // Hard delete from the database
        const { error } = await supabase
          .from('documentation_files')
          .delete()
          .eq('id', file.id);
        
        if (error) {
          console.error(`Error deleting ${file.file_path}:`, error);
          errorCount++;
        } else {
          console.log(`Deleted ${file.file_path} from database`);
        }
      }
    }
  }
  
  console.log(`\nSync Results:`);
  console.log(`- ${existCount} files exist on disk`);
  console.log(`- ${notExistCount} files no longer exist and were removed from database`);
  console.log(`- ${updatedCount} files had their metadata updated`);
  console.log(`- ${errorCount} errors occurred during processing`);
}

// Run the standardization process
standardizeMetadata()
  .then(() => {
    console.log('File synchronization completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error in sync process:', error);
    process.exit(1);
  });
EOL

  # Execute the standardization script
  echo "Running file synchronization..."
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  ROOT_DIR="$ROOT_DIR" \
  DB_FILES="$DB_FILES" \
  node "$EXIST_BATCH"
  
  SYNC_EXIT_CODE=$?
  
  # Clean up temporary directory
  rm -rf "$TEMP_DIR"
  
  if [ $SYNC_EXIT_CODE -eq 0 ]; then
    echo "✅ File synchronization completed successfully"
    return 0
  else
    echo "❌ File synchronization failed (exit code: $SYNC_EXIT_CODE)"
    return 1
  fi
}

# Function to find and insert new files
function find_new_files() {
  echo "🔍 Finding new document files..."
  
  # Create a temporary directory for our script
  TEMP_DIR=$(mktemp -d)
  FIND_SCRIPT="$TEMP_DIR/find_new_files.js"
  
  # Create package.json for find script
  cat > "$TEMP_DIR/package.json" << 'EOL'
{
  "name": "find-new-files",
  "version": "1.0.0",
  "description": "Find new documentation files",
  "main": "find_new_files.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.48.1"
  }
}
EOL

  # Install dependencies
  (cd "$TEMP_DIR" && npm install --silent @supabase/supabase-js >/dev/null 2>&1)
  
  # Create JS file for finding new files
  cat > "$FIND_SCRIPT" << 'EOL'
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rootDir = process.env.ROOT_DIR;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to walk directory recursively and find all markdown/documentation files
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // Skip node_modules, git, archive, backup, and other non-documentation directories
    if (stat.isDirectory()) {
      // List of directories to exclude
      const excludedDirs = [
        'node_modules', 'dist', 'build', '.git',
        'file_types', 'backup', 'archive', '_archive',
        'script-analysis-results', 'reports'
      ];
      
      if (
        !file.startsWith('.') &&
        !excludedDirs.includes(file) &&
        !filePath.includes('backup') &&
        !filePath.includes('archive')
      ) {
        walkDir(filePath, fileList);
      }
    } else if (stat.isFile()) {
      // Include markdown, txt, and common documentation formats
      const ext = path.extname(file).toLowerCase();
      if (['.md', '.txt', '.pdf', '.docx', '.doc', '.rtf'].includes(ext)) {
        // Get relative path from root directory
        const relativePath = path.relative(rootDir, filePath);
        fileList.push({
          path: relativePath,
          file_size: stat.size,
          mtime: stat.mtime
        });
      }
    }
  }
  
  return fileList;
}

// Function to calculate file hash
function calculateFileHash(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileContent).digest('hex');
  } catch (error) {
    console.error(`Error calculating hash for ${filePath}:`, error);
    return null;
  }
}

// Function to find new files
async function findNewFiles() {
  try {
    // First, get all existing file paths from the database
    const { data: existingFiles, error: fetchError } = await supabase
      .from('documentation_files')
      .select('file_path');
    
    if (fetchError) {
      throw new Error(`Error fetching existing files: ${fetchError.message}`);
    }
    
    // Create a Set of existing file paths for faster lookup
    const existingPaths = new Set(existingFiles.map(file => file.file_path));
    
    // Find all documentation files on disk
    console.log('Scanning directories for documentation files...');
    const allFiles = walkDir(rootDir);
    console.log(`Found ${allFiles.length} potential documentation files on disk`);
    
    // Filter for only new files
    const newFiles = allFiles.filter(file => !existingPaths.has(file.path));
    console.log(`Found ${newFiles.length} new documentation files to add to the database`);
    
    if (newFiles.length === 0) {
      console.log('No new files to add.');
      return { added: 0, errors: 0 };
    }
    
    // Process new files in batches
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < newFiles.length; i += batchSize) {
      batches.push(newFiles.slice(i, i + batchSize));
    }
    
    let addedCount = 0;
    let errorCount = 0;
    
    // Process each batch
    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`Processing batch ${batchIndex + 1}/${batches.length}...`);
      
      // Process files in this batch
      for (const file of batch) {
        const fullPath = path.join(rootDir, file.path);
        
        try {
          // Calculate file hash
          const fileHash = calculateFileHash(fullPath);
          
          if (!fileHash) {
            console.error(`Could not calculate hash for ${file.path}, skipping`);
            errorCount++;
            continue;
          }
          
          // Get file extension and try to determine language/type
          const ext = path.extname(file.path).toLowerCase();
          let language = 'unknown';
          
          switch (ext) {
            case '.md':
              language = 'markdown';
              break;
            case '.txt':
              language = 'text';
              break;
            case '.pdf':
              language = 'pdf';
              break;
            case '.docx':
            case '.doc':
              language = 'msword';
              break;
            case '.rtf':
              language = 'rtf';
              break;
          }
          
          // Extract filename without extension for title
          const title = path.basename(file.path, ext);
          
          // Generate a UUID for the new file
          const fileId = crypto.randomUUID();
          
          // Add new file to the database
          const { error: insertError } = await supabase
            .from('documentation_files')
            .insert({
              id: fileId,
              file_path: file.path,
              title: title,
              file_hash: fileHash,
              file_size: file.file_size, // Using the proper field name
              language: language,
              created_at: new Date(),
              updated_at: new Date(),
              last_modified_at: file.mtime
            });
          
          if (insertError) {
            console.error(`Error inserting ${file.path}:`, insertError);
            errorCount++;
          } else {
            console.log(`Added ${file.path} to the database`);
            addedCount++;
          }
        } catch (error) {
          console.error(`Error processing ${file.path}:`, error);
          errorCount++;
        }
      }
    }
    
    return { added: addedCount, errors: errorCount };
  } catch (error) {
    console.error('Error in find new files process:', error);
    return { added: 0, errors: 1 };
  }
}

// Run the find new files process
findNewFiles()
  .then(({ added, errors }) => {
    console.log(`\nFind New Files Results:`);
    console.log(`- ${added} new files added to the database`);
    console.log(`- ${errors} errors occurred during processing`);
    process.exit(errors > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fatal error in find new files process:', error);
    process.exit(1);
  });
EOL

  # Execute the find new files script
  echo "Running find new files..."
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  ROOT_DIR="$ROOT_DIR" \
  node "$FIND_SCRIPT"
  
  FIND_EXIT_CODE=$?
  
  # Clean up temporary directory
  rm -rf "$TEMP_DIR"
  
  if [ $FIND_EXIT_CODE -eq 0 ]; then
    echo "✅ Find new files completed successfully"
    return 0
  else
    echo "❌ Find new files failed (exit code: $FIND_EXIT_CODE)"
    return 1
  fi
}

# Function to show untyped files
function show_untyped_files() {
  echo "📋 Showing untyped document files..."
  
  # Create temporary location
  TEMP_DIR=$(mktemp -d)
  UNTYPED_SCRIPT="$TEMP_DIR/show_untyped.js"
  
  # Create package.json for the script
  cat > "$TEMP_DIR/package.json" << 'EOL'
{
  "name": "show-untyped",
  "version": "1.0.0",
  "description": "Show untyped document files",
  "main": "show_untyped.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.48.1"
  }
}
EOL

  # Install dependencies
  (cd "$TEMP_DIR" && npm install --silent @supabase/supabase-js >/dev/null 2>&1)
  
  # Create a standalone version that doesn't require shared services
  cat > "$UNTYPED_SCRIPT" << 'EOL'
/**
 * Show Untyped Documents
 * 
 * Displays documents that don't have a document type assigned
 */

const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Get optional limit
const limit = parseInt(process.env.LIMIT || '20', 10);

/**
 * Get untyped documents
 */
async function getUntypedDocuments(supabaseUrl, supabaseKey, limit = 20) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('documentation_files')
      .select(`
        id, 
        file_path, 
        title, 
        language, 
        document_type_id,
        created_at, 
        updated_at
      `)
      .is('document_type_id', null)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching untyped documents:', error);
      return [];
    }
    
    return data;
  } catch (error) {
    console.error('Error in getUntypedDocuments:', error);
    return [];
  }
}

/**
 * Show untyped documents
 */
async function showUntypedFiles() {
  try {
    console.log(`Fetching up to ${limit} untyped document files...`);
    
    // Get untyped documents
    const documents = await getUntypedDocuments(supabaseUrl, supabaseKey, limit);
    
    if (!documents || documents.length === 0) {
      console.log('No untyped files found.');
      return { success: true, count: 0 };
    }
    
    console.log(`Found ${documents.length} untyped document files:`);
    console.log('----------------------------------------------');
    
    // Format the data as a table
    console.log('ID         | Title                    | Path                                    | Updated At');
    console.log('-----------|--------------------------|----------------------------------------|------------------');
    
    documents.forEach((file, index) => {
      const id = file.id ? file.id.substring(0, 8) + '...' : 'No ID'; // Show only first 8 chars of UUID
      const title = (file.title || 'No title').padEnd(24).substring(0, 24);
      const path = (file.file_path || 'No path').padEnd(39).substring(0, 39);
      const updated = file.updated_at ? new Date(file.updated_at).toISOString().split('T')[0] : 'No date';
      
      console.log(`${id} | ${title} | ${path} | ${updated}`);
    });
    
    console.log('----------------------------------------------');
    console.log(`Total: ${documents.length} untyped documents`);
    
    return { success: true, count: documents.length };
  } catch (error) {
    console.error('Error in show untyped files process:', error);
    return { success: false, count: 0 };
  }
}

// Run the show untyped files process
showUntypedFiles()
  .then(({ success, count }) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error in show untyped files process:', error);
    process.exit(1);
  });
EOL

  # Execute the show untyped files script
  echo "Querying database for untyped document files..."
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  LIMIT=20 \
  node "$UNTYPED_SCRIPT"
  
  UNTYPED_EXIT_CODE=$?
  
  # Clean up temporary directory
  rm -rf "$TEMP_DIR"
  
  if [ $UNTYPED_EXIT_CODE -eq 0 ]; then
    echo "✅ Show untyped files completed successfully"
    return 0
  else
    echo "❌ Show untyped files failed (exit code: $UNTYPED_EXIT_CODE)"
    return 1
  fi
}

# Function to show recent files
function show_recent_files() {
  echo "📋 Showing recent document files..."
  
  # Create temporary location
  TEMP_DIR=$(mktemp -d)
  RECENT_SCRIPT="$TEMP_DIR/show_recent.js"
  
  # Create directories for shared modules
  mkdir -p "$TEMP_DIR/shared"
  
  # Create package.json for the script
  cat > "$TEMP_DIR/package.json" << 'EOL'
{
  "name": "show-recent",
  "version": "1.0.0",
  "description": "Show recent document files",
  "main": "show_recent.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.48.1"
  }
}
EOL

  # Install dependencies
  (cd "$TEMP_DIR" && npm install --silent @supabase/supabase-js >/dev/null 2>&1)
  
  # Create a standalone version that doesn't require shared services
  cat > "$RECENT_SCRIPT" << 'EOL'
/**
 * Show Recent Documents
 * 
 * Displays the most recent documents updated in the system
 */

const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Get optional limit
const limit = parseInt(process.env.LIMIT || '20', 10);

/**
 * Get recent documents with document type info
 */
async function getRecentDocuments(supabaseUrl, supabaseKey, limit = 20) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch documents without using foreign key relationship
    const { data, error } = await supabase
      .from('documentation_files')
      .select(`
        id, 
        file_path, 
        title, 
        language, 
        document_type_id,
        created_at, 
        updated_at
      `)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching recent documents:', error);
      return [];
    }
    
    // Enhance with document type information
    const enhancedDocs = await enhanceDocumentsWithTypes(data, supabase);
    
    return enhancedDocs;
  } catch (error) {
    console.error('Error in getRecentDocuments:', error);
    return [];
  }
}

/**
 * Helper function to enhance documents with their types
 */
async function enhanceDocumentsWithTypes(documents, supabase) {
  if (!documents || documents.length === 0) {
    return [];
  }
  
  // Get all unique document type IDs
  const typeIds = [...new Set(
    documents
      .filter(doc => doc.document_type_id)
      .map(doc => doc.document_type_id)
  )];
  
  // If there are no type IDs, return the original documents
  if (typeIds.length === 0) {
    return documents.map(doc => ({
      ...doc,
      document_type: { name: 'Untyped' }
    }));
  }
  
  // Fetch document types
  const { data: typeData, error } = await supabase
    .from('document_types')
    .select('id, document_type')
    .in('id', typeIds);
  
  if (error) {
    console.error('Error fetching document types:', error);
    return documents;
  }
  
  // Create a map of typeId to type name
  const typeMap = {};
  typeData.forEach(type => {
    typeMap[type.id] = type.document_type;
  });
  
  // Enhance documents with type information
  return documents.map(doc => {
    const typeName = doc.document_type_id && typeMap[doc.document_type_id] 
      ? typeMap[doc.document_type_id] 
      : 'Untyped';
    
    return {
      ...doc,
      document_type: { name: typeName }
    };
  });
}

/**
 * Show recent documents
 */
async function showRecentFiles() {
  try {
    console.log(`Fetching up to ${limit} recent document files...`);
    
    // Get recent documents
    const documents = await getRecentDocuments(supabaseUrl, supabaseKey, limit);
    
    if (!documents || documents.length === 0) {
      console.log('No recent files found.');
      return { success: true, count: 0 };
    }
    
    console.log(`Found ${documents.length} recent document files:`);
    console.log('----------------------------------------------');
    
    // Format the data as a table
    console.log('ID         | Title                    | Type                     | Path                                    | Updated At');
    console.log('-----------|--------------------------|--------------------------|----------------------------------------|------------------');
    
    documents.forEach((file, index) => {
      const id = file.id ? file.id.substring(0, 8) + '...' : 'No ID'; // Show only first 8 chars of UUID
      const title = (file.title || 'No title').padEnd(24).substring(0, 24);
      const type = ((file.document_type && file.document_type.name) || 'Untyped').padEnd(24).substring(0, 24);
      const path = (file.file_path || 'No path').padEnd(39).substring(0, 39);
      const updated = file.updated_at ? new Date(file.updated_at).toISOString().split('T')[0] : 'No date';
      
      console.log(`${id} | ${title} | ${type} | ${path} | ${updated}`);
    });
    
    console.log('----------------------------------------------');
    console.log(`Total: ${documents.length} recent documents`);
    
    return { success: true, count: documents.length };
  } catch (error) {
    console.error('Error in show recent files process:', error);
    return { success: false, count: 0 };
  }
}

// Run the show recent files process
showRecentFiles()
  .then(({ success, count }) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error in show recent files process:', error);
    process.exit(1);
  });
EOL

  # Execute the show recent files script
  echo "Querying database for recent document files..."
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  LIMIT=20 \
  node "$RECENT_SCRIPT"
  
  RECENT_EXIT_CODE=$?
  
  # Clean up temporary directory
  rm -rf "$TEMP_DIR"
  
  if [ $RECENT_EXIT_CODE -eq 0 ]; then
    echo "✅ Show recent files completed successfully"
    return 0
  else
    echo "❌ Show recent files failed (exit code: $RECENT_EXIT_CODE)"
    return 1
  fi
}

# Function to classify recent files
function classify_recent_files() {
  local count=${1:-20}
  echo "🧠 Classifying ${count} recent document files..."
  
  # Check if Claude API key is available
  if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️ No Claude API key found in environment variables."
    
    # Try loading from .env.local if it exists
    if [ -f "${ROOT_DIR}/.env.local" ]; then
      echo "🔍 Checking .env.local for API keys..."
      if grep -q "CLAUDE_API_KEY=" "${ROOT_DIR}/.env.local"; then
        echo "✅ Found CLAUDE_API_KEY in .env.local, loading environment variables"
        source "${ROOT_DIR}/.env.local"
      elif grep -q "ANTHROPIC_API_KEY=" "${ROOT_DIR}/.env.local"; then
        echo "✅ Found ANTHROPIC_API_KEY in .env.local, loading environment variables"
        source "${ROOT_DIR}/.env.local"
      else
        echo "❌ Missing Claude API key in .env.local"
      fi
    fi
    
    # If we still don't have any API keys, fail
    if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
      echo "❌ Missing Claude API key. Please set one of these environment variables:"
      echo "   - CLAUDE_API_KEY"
      echo "   - ANTHROPIC_API_KEY"
      echo "Example: export CLAUDE_API_KEY=your_api_key"
      return 1
    fi
  fi
  
  # If ANTHROPIC_API_KEY is set but CLAUDE_API_KEY isn't, use it
  if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "ℹ️ Using ANTHROPIC_API_KEY as CLAUDE_API_KEY"
    export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
  fi
  
  # Make sure ANTHROPIC_API_KEY is also set for the config service
  if [ -n "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ℹ️ Setting ANTHROPIC_API_KEY from CLAUDE_API_KEY"
    export ANTHROPIC_API_KEY="$CLAUDE_API_KEY"
  fi
  
  # Path to our document classifier
  CLASSIFY_SCRIPT="${SCRIPT_DIR}/classify-document-with-prompt.sh"
  
  # Check if the script exists
  if [ ! -f "${CLASSIFY_SCRIPT}" ]; then
    echo "❌ Error: Document classifier not found at ${CLASSIFY_SCRIPT}"
    return 1
  fi
  
  # Run the document classifier with the specified count
  echo "🚀 Classifying ${count} recent documents using classify-document-with-prompt.sh..."
  cd "${ROOT_DIR}"
  
  # Execute the document classifier with the appropriate count
  NODE_ENV="${NODE_ENV}" \
  CLAUDE_API_KEY="$CLAUDE_API_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  "${CLASSIFY_SCRIPT}" "${count}"
  
  local script_exit_code=$?
  
  if [ $script_exit_code -eq 0 ]; then
    echo "✅ Successfully classified recent documents"
    return 0
  else
    echo "❌ Failed to classify recent documents (exit code: $script_exit_code)"
    return 1
  fi
}

# Function to classify untyped files
function classify_untyped_files() {
  local count=${1:-10}
  echo "🧠 Classifying ${count} untyped document files..."
  
  # Check if Claude API key is available
  if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️ No Claude API key found in environment variables."
    
    # Try loading from .env.local if it exists
    if [ -f "${ROOT_DIR}/.env.local" ]; then
      echo "🔍 Checking .env.local for API keys..."
      if grep -q "CLAUDE_API_KEY=" "${ROOT_DIR}/.env.local"; then
        echo "✅ Found CLAUDE_API_KEY in .env.local, loading environment variables"
        source "${ROOT_DIR}/.env.local"
      elif grep -q "ANTHROPIC_API_KEY=" "${ROOT_DIR}/.env.local"; then
        echo "✅ Found ANTHROPIC_API_KEY in .env.local, loading environment variables"
        source "${ROOT_DIR}/.env.local"
      else
        echo "❌ Missing Claude API key in .env.local"
      fi
    fi
    
    # If we still don't have any API keys, fail
    if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
      echo "❌ Missing Claude API key. Please set one of these environment variables:"
      echo "   - CLAUDE_API_KEY"
      echo "   - ANTHROPIC_API_KEY"
      echo "Example: export CLAUDE_API_KEY=your_api_key"
      return 1
    fi
  fi
  
  # If ANTHROPIC_API_KEY is set but CLAUDE_API_KEY isn't, use it
  if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "ℹ️ Using ANTHROPIC_API_KEY as CLAUDE_API_KEY"
    export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
  fi
  
  # Make sure ANTHROPIC_API_KEY is also set for the config service
  if [ -n "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ℹ️ Setting ANTHROPIC_API_KEY from CLAUDE_API_KEY"
    export ANTHROPIC_API_KEY="$CLAUDE_API_KEY"
  fi
  
  # Path to our document classifier
  CLASSIFY_SCRIPT="${SCRIPT_DIR}/classify-document-with-prompt.sh"
  
  # Check if the script exists
  if [ ! -f "${CLASSIFY_SCRIPT}" ]; then
    echo "❌ Error: Document classifier not found at ${CLASSIFY_SCRIPT}"
    return 1
  fi
  
  # Run the document classifier with the specified count for untyped documents
  echo "🚀 Classifying ${count} untyped documents using classify-document-with-prompt.sh..."
  cd "${ROOT_DIR}"
  
  # Execute the document classifier with the appropriate count and untyped flag
  NODE_ENV="${NODE_ENV}" \
  CLAUDE_API_KEY="$CLAUDE_API_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  "${CLASSIFY_SCRIPT}" "${count}" "untyped"
  
  local script_exit_code=$?
  
  if [ $script_exit_code -eq 0 ]; then
    echo "✅ Successfully classified untyped documents"
    return 0
  else
    echo "❌ Failed to classify untyped documents (exit code: $script_exit_code)"
    return 1
  fi
}

# Function to clean script analysis results
function clean_script_results() {
  echo "🧹 Cleaning script analysis results from document database..."
  
  # Create a temporary script to clean the database
  TEMP_DIR=$(mktemp -d)
  CLEAN_SCRIPT="$TEMP_DIR/clean_script_results.js"
  
  # Create package.json for the script
  cat > "$TEMP_DIR/package.json" << 'EOL'
{
  "name": "clean-script-results",
  "version": "1.0.0",
  "description": "Clean script analysis results from document database",
  "main": "clean_script_results.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.48.1"
  }
}
EOL

  # Install dependencies
  (cd "$TEMP_DIR" && npm install --silent @supabase/supabase-js >/dev/null 2>&1)
  
  # Create JS file for cleaning script results
  cat > "$CLEAN_SCRIPT" << 'EOL'
const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to clean script analysis results
async function cleanScriptResults() {
  try {
    // Find document files with paths containing 'script-analysis-results'
    const { data, error } = await supabase
      .from('documentation_files')
      .select('id, file_path')
      .like('file_path', '%script-analysis-results%');
    
    if (error) {
      console.error('Error fetching script analysis results:', error);
      return { success: false, count: 0 };
    }
    
    if (!data || data.length === 0) {
      console.log('No script analysis results found in the database.');
      return { success: true, count: 0 };
    }
    
    console.log(`Found ${data.length} script analysis results to clean:`);
    
    // Delete each script analysis result
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const file of data) {
      console.log(`Deleting ${file.file_path} from the database...`);
      
      const { error: deleteError } = await supabase
        .from('documentation_files')
        .delete()
        .eq('id', file.id);
      
      if (deleteError) {
        console.error(`Error deleting ${file.file_path}:`, deleteError);
        errorCount++;
      } else {
        console.log(`Deleted ${file.file_path} from the database`);
        deletedCount++;
      }
    }
    
    console.log(`\nCleaning Results:`);
    console.log(`- ${deletedCount} script analysis results deleted from database`);
    console.log(`- ${errorCount} errors occurred during processing`);
    
    return { success: true, count: deletedCount };
  } catch (error) {
    console.error('Error in clean script results process:', error);
    return { success: false, count: 0 };
  }
}

// Run the clean script results process
cleanScriptResults()
  .then(({ success, count }) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error in clean script results process:', error);
    process.exit(1);
  });
EOL

  # Execute the clean script results script
  echo "Cleaning script analysis results from document database..."
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  node "$CLEAN_SCRIPT"
  
  CLEAN_EXIT_CODE=$?
  
  # Clean up temporary directory
  rm -rf "$TEMP_DIR"
  
  if [ $CLEAN_EXIT_CODE -eq 0 ]; then
    echo "✅ Clean script results completed successfully"
    return 0
  else
    echo "❌ Clean script results failed (exit code: $CLEAN_EXIT_CODE)"
    return 1
  fi
}

# Function to generate summary report
function generate_summary() {
  local count=${1:-50}
  local include_deleted=${2:-false}
  local report_file="${DOCUMENT_REPORTS_DIR}/document-summary-$(date +%Y-%m-%d).md"
  
  echo "📊 Generating summary report for ${count} documents (include deleted: ${include_deleted})..."
  
  # Check if we have Node.js available
  if ! command -v node &> /dev/null; then
    echo "⚠️ Node.js not found. Cannot generate a proper summary report."
    return 1
  fi
  
  # Make sure @supabase/supabase-js is installed at the project level
  if ! npm list @supabase/supabase-js &> /dev/null; then
    echo "Installing @supabase/supabase-js at the project level..."
    npm install --no-save @supabase/supabase-js &> /dev/null
  fi
  
  # Create a temporary directory
  TEMP_DIR=$(mktemp -d)
  SUMMARY_SCRIPT="${TEMP_DIR}/generate_document_summary.js"
  
  # Create package.json in temp directory to ensure local installation
  cat > "$TEMP_DIR/package.json" << 'EOL'
{
  "name": "temp-document-summary",
  "version": "1.0.0",
  "description": "Temporary script for document summary generation",
  "main": "generate_document_summary.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.48.1"
  }
}
EOL

  # Install dependencies in the temp directory
  echo "Installing dependencies in temporary directory..."
  (cd "$TEMP_DIR" && npm install --silent &> /dev/null)
  
  # Create the script for generating the report
  cat > "$SUMMARY_SCRIPT" << 'EOL'
// First check and install required dependencies
try {
  require('@supabase/supabase-js');
} catch (e) {
  console.log('Installing @supabase/supabase-js...');
  require('child_process').execSync('npm install --no-save @supabase/supabase-js', {stdio: 'inherit'});
}

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get parameters from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputPath = process.env.OUTPUT_PATH;
const documentLimit = parseInt(process.env.DOCUMENT_LIMIT || '50', 10);
const includeDeleted = process.env.INCLUDE_DELETED === 'true';

// Function to group documents by category
function categorizeDocument(document) {
  // Default to 'General' if no category is found
  let category = 'General';
  
  const docType = document.document_type ? document.document_type.name : '';
  const filePath = document.file_path || '';
  
  // Check for technical documentation
  if (
    docType.includes('Technical') || 
    docType.includes('API') || 
    docType.includes('Code') ||
    filePath.includes('technical-specs') ||
    filePath.includes('code-documentation')
  ) {
    category = 'Technical';
  }
  // Check for guides/tutorials
  else if (
    docType.includes('Guide') || 
    docType.includes('Tutorial') || 
    docType.includes('How-to') ||
    filePath.includes('solution-guides') ||
    filePath.includes('guide')
  ) {
    category = 'Guides';
  }
  // Check for readmes/project documentation
  else if (
    docType.includes('README') || 
    docType.includes('Project') ||
    filePath.includes('readmes') ||
    filePath.match(/README\.(md|txt)$/i)
  ) {
    category = 'READMEs';
  }
  // Check for deployment/environment documentation
  else if (
    docType.includes('Deployment') || 
    docType.includes('Environment') ||
    filePath.includes('deployment-environment')
  ) {
    category = 'Environment';
  }
  
  return category;
}

async function generateSummaryReport() {
  console.log(`Generating summary report with limit: ${documentLimit}, includeDeleted: ${includeDeleted}`);
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Cannot generate report.');
    process.exit(1);
  }
  
  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query the database for documents
    let query = supabase
      .from('documentation_files')
      .select(`
        id,
        file_path,
        title,
        language,
        document_type:document_type_id(id, name, description),
        is_deleted,
        created_at,
        updated_at,
        last_modified_at,
        file_size
      `);
      
    // No filtering for deleted status as we're using hard deletes now
    
    // Apply limit (only if not -1, which means all documents)
    if (documentLimit !== -1) {
      query = query.limit(documentLimit);
    }
    
    // Execute the query
    const { data: documents, error } = await query.order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching documents:', error);
      process.exit(1);
    }
    
    if (!documents || documents.length === 0) {
      console.log('No documents found in the database.');
      process.exit(0);
    }
    
    console.log(`Found ${documents.length} documents in the database.`);
    
    // Get document types for reference
    const { data: documentTypes } = await supabase
      .from('document_types')
      .select('id, name, description');
    
    // Create a map of document types for easier access
    const documentTypeMap = new Map();
    if (documentTypes) {
      documentTypes.forEach(type => {
        documentTypeMap.set(type.id, type);
      });
    }
    
    // Categorize documents
    const categorizedDocuments = {
      'Technical': [],
      'Guides': [],
      'READMEs': [],
      'Environment': [],
      'General': []
    };
    
    // Count document types
    const documentTypeCounts = {};
    
    // Process each document
    documents.forEach(document => {
      // Categorize the document
      const category = categorizeDocument(document);
      categorizedDocuments[category].push(document);
      
      // Increment document type counter
      if (document.document_type && document.document_type.id) {
        documentTypeCounts[document.document_type.id] = 
          (documentTypeCounts[document.document_type.id] || 0) + 1;
      }
    });
    
    // Start generating the report
    let report = `# Document Analysis Summary Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Documents: ${documents.length}\n\n`;
    
    // Summary statistics
    report += `## Summary Statistics\n\n`;
    report += `| Category | Count | Percentage |\n`;
    report += `| --- | --- | --- |\n`;
    
    let totalDocuments = documents.length;
    for (const [category, categoryDocuments] of Object.entries(categorizedDocuments)) {
      const percentage = ((categoryDocuments.length / totalDocuments) * 100).toFixed(1);
      report += `| ${category} | ${categoryDocuments.length} | ${percentage}% |\n`;
    }
    
    report += `\n`;
    
    // Show document types distribution
    if (Object.keys(documentTypeCounts).length > 0) {
      report += `### Document Type Distribution\n\n`;
      report += `| Document Type | Count |\n`;
      report += `| --- | --- |\n`;
      
      for (const [typeId, count] of Object.entries(documentTypeCounts)) {
        const typeName = documentTypeMap.get(typeId)?.name || 'Unknown';
        report += `| ${typeName} | ${count} |\n`;
      }
      
      report += `\n`;
    }
    
    // Add a file path table for quick reference
    report += `## File Path Overview\n\n`;
    report += `| ID | File Path | Type | Category | Last Updated |\n`;
    report += `| --- | --- | --- | --- | --- |\n`;
    
    documents.slice(0, 20).forEach(document => {
      const id = document.id.substring(0, 8) + '...'; // Show only first 8 chars of UUID
      const type = document.document_type ? document.document_type.name : 'Untyped';
      const updatedAt = document.updated_at ? new Date(document.updated_at).toISOString().split('T')[0] : 'N/A';
      const category = categorizeDocument(document);
      report += `| ${id} | \`${document.file_path}\` | ${type} | ${category} | ${updatedAt} |\n`;
    });
    
    if (documents.length > 20) {
      report += `| ... | ... | ... | ... | ... |\n`;
    }
    
    report += `\n\n`;
    
    // Generate detailed sections by category
    for (const [category, categoryDocuments] of Object.entries(categorizedDocuments)) {
      if (categoryDocuments.length === 0) continue;
      
      report += `## ${category} Documents (${categoryDocuments.length})\n\n`;
      
      // Add a brief description based on the category
      switch (category) {
        case 'Technical':
          report += `Technical documentation including API references, code documentation, and specifications.\n\n`;
          break;
        case 'Guides':
          report += `How-to guides, tutorials, and solution documentation.\n\n`;
          break;
        case 'READMEs':
          report += `Project README files and general project documentation.\n\n`;
          break;
        case 'Environment':
          report += `Deployment, environment, and infrastructure documentation.\n\n`;
          break;
        case 'General':
          report += `General documentation that doesn't fit into other categories.\n\n`;
          break;
      }
      
      // Sort documents by updated date
      categoryDocuments.sort((a, b) => {
        const dateA = new Date(a.updated_at || 0);
        const dateB = new Date(b.updated_at || 0);
        return dateB - dateA;
      });
      
      // Add document details
      for (const document of categoryDocuments) {
        const typeName = document.document_type ? document.document_type.name : 'Untyped';
        
        report += `### ${document.title || path.basename(document.file_path)}\n`;
        report += `- **File Path**: \`${document.file_path}\`\n`;
        report += `- **Type**: ${typeName}\n`;
        report += `- **Language**: ${document.language || 'Unknown'}\n`;
        report += `- **Size**: ${document.file_size ? (document.file_size / 1024).toFixed(2) + ' KB' : 'Unknown'}\n`;
        
        // Add document type description if available
        if (document.document_type && document.document_type.description) {
          report += `- **Type Description**: ${document.document_type.description}\n`;
        }
        
        // Dates
        report += `- **Created**: ${new Date(document.created_at).toISOString()}\n`;
        report += `- **Updated**: ${new Date(document.updated_at).toISOString()}\n`;
        
        report += `\n`;
      }
    }
    
    // Write the report to a file
    fs.writeFileSync(outputPath, report);
    console.log(`Report successfully written to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error generating summary report:', error);
    process.exit(1);
  }
}

// Run the report generation
generateSummaryReport();
EOL

  # Run the script to generate the summary report
  echo "Executing document summary report generator..."
  cd "${ROOT_DIR}"
  SUPABASE_URL="${SUPABASE_URL}" \
  SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
  OUTPUT_PATH="${report_file}" \
  DOCUMENT_LIMIT="${count}" \
  INCLUDE_DELETED="${include_deleted}" \
  node "${SUMMARY_SCRIPT}"
  
  # Check if the report was generated successfully
  if [ -f "${report_file}" ]; then
    echo "✅ Document summary report generation completed successfully"
    echo "Report saved to: ${report_file}"
  else
    echo "❌ Failed to generate document summary report"
    return 1
  fi
  
  # Clean up temporary directory
  rm -rf "${TEMP_DIR}"
  
  return 0
}

# Function to run the complete pipeline
function run_complete_pipeline() {
  echo "🚀 Running complete document pipeline..."
  local success=true
  
  # Ensure the environment variables are set
  if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️ Missing Claude API key. Classification steps will fail."
    echo "Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable."
    success=false
  else
    echo "✅ Claude API key environment variable is set."
  fi
  
  if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "⚠️ Missing Supabase credentials. Database operations will fail."
    echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    success=false
  else
    echo "✅ Supabase credentials are set."
  fi
  
  # If environment variables are missing, exit early
  if [ "$success" = false ]; then
    echo "⚠️ Missing required environment variables. Please set them and try again."
    return 1
  fi
  
  # Run the pipeline steps
  sync_files
  if [ $? -ne 0 ]; then
    success=false
  fi
  
  find_new_files
  if [ $? -ne 0 ]; then
    success=false
  fi
  
  # Maximum of 5 documents to classify for better performance
  classify_recent_files 5
  if [ $? -ne 0 ]; then
    success=false
  fi
  
  if [ "$success" = true ]; then
    echo "✅ Complete document pipeline executed successfully"
    return 0
  else
    echo "⚠️ Document pipeline completed with errors"
    return 1
  fi
}

# Export all functions
export -f sync_files
export -f find_new_files
export -f show_untyped_files
export -f show_recent_files
export -f classify_recent_files
export -f classify_untyped_files
export -f clean_script_results
export -f generate_summary
export -f run_complete_pipeline