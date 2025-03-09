#!/bin/bash

# Script to connect to Supabase and update the documentation_files table
# 1. Checks if each file exists on disk and updates the database accordingly
# 2. Finds new markdown files and adds them to the database
# 3. Detects moved files (deleted in one location, new in another)
# 4. Tests Claude 3.7 API connectivity

echo "Starting documentation database update..."

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

# Check if Anthropic API key is available
if [[ -z "$VITE_ANTHROPIC_API_KEY" ]]; then
  echo "WARNING: Anthropic API key not found in environment variables"
  echo "Claude API test will be skipped"
  CLAUDE_API_TEST="skipped"
else
  echo "Anthropic API key found, will test Claude API"
  # Print first few characters of the key for debugging (safely)
  KEY_PREFIX="${VITE_ANTHROPIC_API_KEY:0:5}..."
  echo "API Key prefix: $KEY_PREFIX"
  CLAUDE_API_TEST="enabled"
fi

# Ensure docs directory exists
mkdir -p "$REPO_ROOT/docs"

# Create a Node.js script to query and update the database
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const repoRoot = '$REPO_ROOT';
const reportFile = '$REPORT_FILE';
const claudeApiTest = '$CLAUDE_API_TEST';
const anthropicApiKey = process.env.VITE_ANTHROPIC_API_KEY;

// Function to extract title from markdown file
function extractTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try to get title from frontmatter
    const frontmatterMatch = content.match(/^title:\\s*(.+)$/m);
    if (frontmatterMatch) {
      return frontmatterMatch[1].replace(/\"/g, '').trim();
    }
    
    // Try first heading
    const headingMatch = content.match(/^#\\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
    
    // Use filename (without extension)
    const basename = path.basename(filePath, '.md');
    return basename
      .replace(/-/g, ' ')
      .replace(/\\b\\w/g, l => l.toUpperCase());
  } catch (error) {
    console.error(\`Error extracting title from \${filePath}: \${error.message}\`);
    return path.basename(filePath, '.md');
  }
}

// Function to calculate file hash
function calculateHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const stats = fs.statSync(filePath);
    return \`\${hash}-\${stats.size}\`;
  } catch (error) {
    console.error(\`Error calculating hash for \${filePath}: \${error.message}\`);
    return 'error-calculating-hash';
  }
}

// Function to determine if file is a prompt
function isPrompt(filePath) {
  return filePath.includes('/prompts/') || path.basename(filePath).includes('prompt');
}

// Function to get file metadata
function getFileMetadata(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      isPrompt: isPrompt(filePath)
    };
  } catch (error) {
    console.error(\`Error getting metadata for \${filePath}: \${error.message}\`);
    return {
      size: 0,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      isPrompt: false
    };
  }
}

// Function to test Claude API
async function testClaudeApi() {
  if (claudeApiTest !== 'enabled' || !anthropicApiKey) {
    return {
      success: false,
      message: 'Claude API test skipped - API key not available',
      result: null
    };
  }
  
  return new Promise((resolve) => {
    try {
      console.log('Testing Claude 3.7 API...');
      console.log(\`API Key prefix: \${anthropicApiKey.substring(0, 5)}...\`);
      
      // Simple request for Claude 3.7
      const requestData = {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 300,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: 'Please analyze the current state of the documentation_files table in our database. What are some best practices for maintaining documentation files in a monorepo? Provide 3 specific recommendations.'
          }
        ]
      };
      
      const data = JSON.stringify(requestData);
      
      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(data)
        }
      };
      
      console.log('API request details:');
      console.log(\`- Endpoint: \${options.hostname}\${options.path}\`);
      console.log(\`- Model: \${requestData.model}\`);
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log(\`Response status code: \${res.statusCode}\`);
            
            if (res.statusCode === 200) {
              const parsedData = JSON.parse(responseData);
              resolve({
                success: true,
                message: 'Claude API test successful',
                result: parsedData.content[0].text
              });
            } else {
              console.log(\`Response body: \${responseData}\`);
              resolve({
                success: false,
                message: \`Claude API test failed with status \${res.statusCode}\`,
                result: responseData
              });
            }
          } catch (error) {
            console.log(\`Error parsing response: \${error.message}\`);
            console.log(\`Raw response: \${responseData}\`);
            resolve({
              success: false,
              message: \`Error parsing Claude API response: \${error.message}\`,
              result: responseData
            });
          }
        });
      });
      
      req.on('error', (error) => {
        console.log(\`Request error: \${error.message}\`);
        resolve({
          success: false,
          message: \`Error calling Claude API: \${error.message}\`,
          result: null
        });
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      console.log(\`Unexpected error: \${error.message}\`);
      resolve({
        success: false,
        message: \`Unexpected error in Claude API test: \${error.message}\`,
        result: null
      });
    }
  });
}

async function updateDocumentationFiles() {
  try {
    console.log('Querying all documentation files...');
    
    // Get count of all records before update
    const { count: totalCountBefore, error: totalErrorBefore } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
    
    if (totalErrorBefore) {
      console.error('Error getting total count:', totalErrorBefore.message);
      return;
    }
    
    // Get count of non-deleted records before update
    const { count: activeCountBefore, error: activeErrorBefore } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);
    
    if (activeErrorBefore) {
      console.error('Error getting active count:', activeErrorBefore.message);
      return;
    }
    
    // Get count of deleted records before update
    const { count: deletedCountBefore, error: deletedErrorBefore } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);
    
    if (deletedErrorBefore) {
      console.error('Error getting deleted count:', deletedErrorBefore.message);
      return;
    }
    
    console.log('Documentation Files Statistics (Before Update):');
    console.log(\`- Total records: \${totalCountBefore}\`);
    console.log(\`- Active records: \${activeCountBefore}\`);
    console.log(\`- Deleted records: \${deletedCountBefore}\`);
    
    // Get ALL records
    const { data: allFiles, error: allFilesError } = await supabase
      .from('documentation_files')
      .select('id, file_path, title, file_hash, metadata, is_deleted, updated_at')
      .order('file_path', { ascending: true });
    
    if (allFilesError) {
      console.error('Error getting all files:', allFilesError.message);
      return;
    }
    
    console.log(\`\\nChecking file existence for \${allFiles ? allFiles.length : 0} records...\`);
    
    const filesList = [];
    const existsCount = { total: 0, exists: 0, notFound: 0 };
    const filesToActivate = [];
    const filesToDelete = [];
    const filesToUpdateMetadata = [];
    const updateResults = { activated: 0, deleted: 0, metadataUpdated: 0, unchanged: 0, errors: 0 };
    
    // Create maps for quick lookups
    const existingFilePaths = new Map();
    const deletedFilesByName = new Map();
    const fileNameMap = new Map();
    
    // First pass: build lookup maps
    if (allFiles && allFiles.length > 0) {
      for (const file of allFiles) {
        existingFilePaths.set(file.file_path, file);
        
        // Store deleted files by basename for moved file detection
        if (file.is_deleted) {
          const basename = path.basename(file.file_path);
          if (!deletedFilesByName.has(basename)) {
            deletedFilesByName.set(basename, []);
          }
          deletedFilesByName.get(basename).push(file);
        }
        
        // Store all files by basename
        const basename = path.basename(file.file_path);
        if (!fileNameMap.has(basename)) {
          fileNameMap.set(basename, []);
        }
        fileNameMap.get(basename).push(file);
      }
    }
    
    // Second pass: check files and prepare updates
    if (allFiles && allFiles.length > 0) {
      for (const file of allFiles) {
        existsCount.total++;
        
        // Check if file exists on disk
        const fullPath = path.join(repoRoot, file.file_path);
        const exists = fs.existsSync(fullPath);
        
        if (exists) {
          existsCount.exists++;
          
          // Get current file metadata
          const metadata = getFileMetadata(fullPath);
          const fileHash = calculateHash(fullPath);
          
          // Check if metadata needs updating
          const needsMetadataUpdate = !file.metadata || 
                                     file.metadata.size !== metadata.size || 
                                     file.file_hash !== fileHash;
          
          // If file exists but is marked as deleted, update it
          if (file.is_deleted) {
            filesToActivate.push({
              id: file.id,
              path: file.file_path,
              metadata: metadata,
              fileHash: fileHash,
              needsMetadataUpdate: needsMetadataUpdate
            });
          } else if (needsMetadataUpdate) {
            // File is active but metadata needs updating
            filesToUpdateMetadata.push({
              id: file.id,
              path: file.file_path,
              metadata: metadata,
              fileHash: fileHash
            });
          } else {
            updateResults.unchanged++;
          }
          
          // Check if this might be a moved file (same name exists elsewhere)
          const basename = path.basename(file.file_path);
          const sameNameFiles = fileNameMap.get(basename) || [];
          const possibleMoves = sameNameFiles.filter(f => 
            f.id !== file.id && 
            f.is_deleted && 
            f.file_path !== file.file_path
          );
          
          const movedStatus = possibleMoves.length > 0 
            ? \`🔄 Possible move from: \${possibleMoves.map(f => f.file_path).join(', ')}\` 
            : '';
          
          const status = exists ? '✅ EXISTS' : '❌ NOT FOUND';
          const beforeStatus = file.is_deleted ? 'DELETED' : 'ACTIVE';
          const afterStatus = exists ? 'ACTIVE' : 'DELETED';
          const action = exists && file.is_deleted ? '→ ACTIVATING' : 
                        !exists && !file.is_deleted ? '→ DELETING' : 
                        needsMetadataUpdate ? '→ UPDATING METADATA' : '(no change)';
          
          const metadataInfo = \`Size: \${metadata.size} bytes | Created: \${new Date(metadata.created).toLocaleString()} | Modified: \${new Date(metadata.modified).toLocaleString()}\`;
          
          const fileInfo = \`\${file.file_path} | \${status} | Before: \${beforeStatus} | After: \${afterStatus === beforeStatus ? beforeStatus : afterStatus} | \${action} | \${metadataInfo}\${movedStatus ? ' | ' + movedStatus : ''}\`;
          
          console.log(fileInfo);
          filesList.push(fileInfo);
        } else {
          existsCount.notFound++;
          
          // If file doesn't exist but is marked as active, update it
          if (!file.is_deleted) {
            filesToDelete.push({
              id: file.id,
              path: file.file_path
            });
          } else {
            updateResults.unchanged++;
          }
          
          const status = '❌ NOT FOUND';
          const beforeStatus = file.is_deleted ? 'DELETED' : 'ACTIVE';
          const afterStatus = 'DELETED';
          const action = !file.is_deleted ? '→ DELETING' : '(no change)';
          
          // Check if this file might exist elsewhere (moved)
          const basename = path.basename(file.file_path);
          const sameNameFiles = fileNameMap.get(basename) || [];
          const possibleMoves = sameNameFiles.filter(f => 
            f.id !== file.id && 
            !f.is_deleted && 
            f.file_path !== file.file_path
          );
          
          const movedStatus = possibleMoves.length > 0 
            ? \`🔄 Possibly moved to: \${possibleMoves.map(f => f.file_path).join(', ')}\` 
            : '';
          
          const metadataInfo = file.metadata 
            ? \`Size: \${file.metadata.size} bytes | Last Updated: \${new Date(file.updated_at).toLocaleString()}\` 
            : 'No metadata available';
          
          const fileInfo = \`\${file.file_path} | \${status} | Before: \${beforeStatus} | After: \${afterStatus === beforeStatus ? beforeStatus : afterStatus} | \${action} | \${metadataInfo}\${movedStatus ? ' | ' + movedStatus : ''}\`;
          
          console.log(fileInfo);
          filesList.push(fileInfo);
        }
      }
    } else {
      console.log('No files found in database');
    }
    
    // Perform updates in batches
    console.log('\\nUpdating database records...');
    
    // Activate files that exist but are marked as deleted
    if (filesToActivate.length > 0) {
      console.log(\`Activating \${filesToActivate.length} files...\`);
      
      // Process in batches of 50 to avoid hitting API limits
      for (let i = 0; i < filesToActivate.length; i += 50) {
        const batch = filesToActivate.slice(i, i + 50);
        
        for (const file of batch) {
          const { error } = await supabase
            .from('documentation_files')
            .update({ 
              is_deleted: false,
              file_hash: file.fileHash,
              metadata: file.metadata,
              last_modified_at: file.metadata.modified,
              last_indexed_at: new Date().toISOString(),
              updated_at: new Date().toISOString() 
            })
            .eq('id', file.id);
          
          if (error) {
            console.error(\`Error activating file \${file.path}:\`, error.message);
            updateResults.errors++;
          } else {
            updateResults.activated++;
            console.log(\`Successfully activated file \${file.path}\`);
          }
        }
      }
    }
    
    // Update metadata for files that need it
    if (filesToUpdateMetadata.length > 0) {
      console.log(\`Updating metadata for \${filesToUpdateMetadata.length} files...\`);
      
      // Process in batches of 50 to avoid hitting API limits
      for (let i = 0; i < filesToUpdateMetadata.length; i += 50) {
        const batch = filesToUpdateMetadata.slice(i, i + 50);
        
        for (const file of batch) {
          const { error } = await supabase
            .from('documentation_files')
            .update({ 
              file_hash: file.fileHash,
              metadata: file.metadata,
              last_modified_at: file.metadata.modified,
              last_indexed_at: new Date().toISOString(),
              updated_at: new Date().toISOString() 
            })
            .eq('id', file.id);
          
          if (error) {
            console.error(\`Error updating metadata for file \${file.path}:\`, error.message);
            updateResults.errors++;
          } else {
            updateResults.metadataUpdated++;
            console.log(\`Successfully updated metadata for file \${file.path}\`);
          }
        }
      }
    }
    
    // Delete files that don't exist but are marked as active
    if (filesToDelete.length > 0) {
      console.log(\`Marking \${filesToDelete.length} files as deleted...\`);
      
      // Process in batches of 50 to avoid hitting API limits
      for (let i = 0; i < filesToDelete.length; i += 50) {
        const batch = filesToDelete.slice(i, i + 50);
        
        for (const file of batch) {
          const { error } = await supabase
            .from('documentation_files')
            .update({ 
              is_deleted: true, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', file.id);
          
          if (error) {
            console.error(\`Error deleting file \${file.path}:\`, error.message);
            updateResults.errors++;
          } else {
            updateResults.deleted++;
            console.log(\`Successfully marked file \${file.path} as deleted\`);
          }
        }
      }
    }
    
    // Find new markdown files on disk that aren't in the database
    console.log('\\nSearching for new markdown files...');
    
    const newFiles = [];
    const newFilesList = [];
    
    // Function to recursively find markdown files
    function findMarkdownFiles(dir) {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relativePath = path.relative(repoRoot, fullPath);
          
          // Skip excluded directories
          if (
            fullPath.includes('node_modules') ||
            fullPath.includes('.git') ||
            fullPath.includes('dist') ||
            fullPath.includes('build') ||
            fullPath.includes('coverage')
          ) {
            continue;
          }
          
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            // Recursively process subdirectory
            findMarkdownFiles(fullPath);
          } else if (stats.isFile() && item.endsWith('.md')) {
            // Check if this file is already in the database
            if (!existingFilePaths.has(relativePath)) {
              newFiles.push({
                path: relativePath,
                fullPath: fullPath,
                basename: path.basename(fullPath)
              });
            }
          }
        }
      } catch (error) {
        console.error(\`Error processing directory \${dir}: \${error.message}\`);
      }
    }
    
    // Start the search from the repository root
    findMarkdownFiles(repoRoot);
    
    console.log(\`Found \${newFiles.length} new markdown files\`);
    
    // Check for possible moved files
    for (const newFile of newFiles) {
      const metadata = getFileMetadata(newFile.fullPath);
      const fileHash = calculateHash(newFile.fullPath);
      
      // Check if this might be a moved file
      const possibleSources = deletedFilesByName.get(newFile.basename) || [];
      const movedStatus = possibleSources.length > 0 
        ? \`🔄 Possible move from: \${possibleSources.map(f => f.file_path).join(', ')}\` 
        : '';
      
      const metadataInfo = \`Size: \${metadata.size} bytes | Created: \${new Date(metadata.created).toLocaleString()} | Modified: \${new Date(metadata.modified).toLocaleString()}\`;
      
      const fileInfo = \`\${newFile.path} | ✨ NEW FILE | \${metadataInfo}\${movedStatus ? ' | ' + movedStatus : ''}\`;
      console.log(fileInfo);
      newFilesList.push(fileInfo);
    }
    
    // Add new files to the database
    if (newFiles.length > 0) {
      console.log('Adding new files to the database...');
      
      const filesToInsert = [];
      const timestamp = new Date().toISOString();
      
      for (const file of newFiles) {
        try {
          const title = extractTitle(file.fullPath);
          const fileHash = calculateHash(file.fullPath);
          const metadata = getFileMetadata(file.fullPath);
          
          filesToInsert.push({
            file_path: file.path,
            title: title,
            last_modified_at: metadata.modified,
            last_indexed_at: timestamp,
            file_hash: fileHash,
            metadata: metadata,
            created_at: timestamp,
            updated_at: timestamp,
            is_deleted: false
          });
        } catch (error) {
          console.error(\`Error preparing file \${file.path} for insertion: \${error.message}\`);
        }
      }
      
      // Insert in batches of 50
      for (let i = 0; i < filesToInsert.length; i += 50) {
        const batch = filesToInsert.slice(i, i + 50);
        
        const { error } = await supabase
          .from('documentation_files')
          .insert(batch);
        
        if (error) {
          console.error(\`Error inserting files (batch \${i/50 + 1}):\`, error.message);
        } else {
          console.log(\`Successfully inserted batch \${i/50 + 1} (\${batch.length} files)\`);
        }
      }
    }
    
    // Get updated counts
    const { count: totalCountAfter } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
    
    const { count: activeCountAfter } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);
    
    const { count: deletedCountAfter } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);
    
    // Test Claude API
    console.log('\\nTesting Claude API...');
    const claudeApiResult = await testClaudeApi();
    console.log(\`Claude API test result: \${claudeApiResult.success ? '✅ SUCCESS' : '❌ FAILED'}\`);
    if (claudeApiResult.success) {
      console.log('Claude API response:');
      console.log(claudeApiResult.result);
    } else {
      console.log(\`Claude API error: \${claudeApiResult.message}\`);
    }
    
    // Create report content
    const reportContent = \`# Documentation Files Database Update Report

Generated: \${new Date().toLocaleString()}

## Update Summary

### Statistics Before Update
- **Total records:** \${totalCountBefore}
- **Active records:** \${activeCountBefore}
- **Deleted records:** \${deletedCountBefore}

### Statistics After Update
- **Total records:** \${totalCountAfter}
- **Active records:** \${activeCountAfter}
- **Deleted records:** \${deletedCountAfter}

### Update Results
- **Files activated:** \${updateResults.activated}
- **Files marked as deleted:** \${updateResults.deleted}
- **Files with metadata updated:** \${updateResults.metadataUpdated}
- **Files unchanged:** \${updateResults.unchanged}
- **New files added:** \${newFiles.length}
- **Update errors:** \${updateResults.errors}

### File Existence Check
- **Files that exist on disk:** \${existsCount.exists}
- **Files not found on disk:** \${existsCount.notFound}
- **New files found:** \${newFiles.length}

### Existing Files Processed
\${filesList.map(file => file + '  ').join('\\n')}

### New Files Added
\${newFilesList.map(file => file + '  ').join('\\n')}

## Claude API Test Results

**Status:** \${claudeApiResult.success ? '✅ SUCCESS' : '❌ FAILED'}  
**Message:** \${claudeApiResult.message}

\${claudeApiResult.success ? '### Claude API Response:\\n\\n' + claudeApiResult.result : claudeApiResult.result ? '### Error Response:\\n\\n```\\n' + claudeApiResult.result + '\\n```' : ''}

## Next Steps

1. Run the script periodically to keep the database in sync with files on disk
2. Use the documentation_files table to power your markdown viewer
3. Consider implementing a file move detection system to track file relocations
\`;

    // Write report to file
    fs.writeFileSync(reportFile, reportContent);
    console.log(\`\\nReport written to \${reportFile}\`);
    
    console.log('\\nUpdate Summary:');
    console.log(\`- Files activated: \${updateResults.activated}\`);
    console.log(\`- Files marked as deleted: \${updateResults.deleted}\`);
    console.log(\`- Files with metadata updated: \${updateResults.metadataUpdated}\`);
    console.log(\`- Files unchanged: \${updateResults.unchanged}\`);
    console.log(\`- New files added: \${newFiles.length}\`);
    console.log(\`- Update errors: \${updateResults.errors}\`);
    
  } catch (error) {
    console.error('Unhandled error:', error.message);
  }
}

updateDocumentationFiles();
"

echo "Script completed." 