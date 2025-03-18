#!/usr/bin/env ts-node

/**
 * SIMPLE SCRIPT TO COUNT RECORDS IN DOCUMENTATION_FILES TABLE
 * This is a minimal script that just connects and counts records
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config as loadDotEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Define types for our database records
interface DocumentationFile {
  id: string;
  file_path?: string;
  is_deleted?: boolean;
  [key: string]: any; // Allow for any other properties
}

/**
 * Prompt the user to confirm they want to update the file paths
 */
async function promptUserForUpdate(paths: Array<{ id: string; originalPath: string; normalizedPath: string }>): Promise<boolean> {
  // Display sample of changes
  console.log('\nSample of path changes:');
  console.log('-----------------------');
  
  // Show at most 5 examples
  const sampleSize = Math.min(paths.length, 5);
  for (let i = 0; i < sampleSize; i++) {
    console.log(`Original: ${paths[i].originalPath}`);
    console.log(`    New: ${paths[i].normalizedPath}`);
    console.log('');
  }
  
  if (paths.length > sampleSize) {
    console.log(`...and ${paths.length - sampleSize} more paths`);
  }
  
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`\nDo you want to update ${paths.length} file paths in the database? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Prompt the user to confirm they want to check file existence and update deletion status
 */
async function promptUserForDeletionCheck(): Promise<boolean> {
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n=== CHECK FILE EXISTENCE AND UPDATE DELETION STATUS ===');
  console.log('This will:');
  console.log('1. Check each file path to see if the file exists on disk');
  console.log('2. Set is_deleted = FALSE for files that exist');
  console.log('3. Set is_deleted = TRUE for files that don\'t exist');
  console.log('This helps maintain accurate file tracking in the database.');
  
  return new Promise((resolve) => {
    rl.question(`\nDo you want to check file existence and update deletion status? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Update file paths in the database
 */
async function updateFilePaths(
  supabase: SupabaseClient, 
  paths: Array<{ id: string; originalPath: string; normalizedPath: string }>
): Promise<void> {
  let successCount = 0;
  let failureCount = 0;
  
  console.log(`Updating ${paths.length} records...`);
  
  // Process in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    
    // Update each record in the batch
    const updatePromises = batch.map(async (item) => {
      try {
        const { error } = await supabase
          .from('documentation_files')
          .update({ file_path: item.normalizedPath })
          .eq('id', item.id);
          
        if (error) {
          console.error(`Error updating record ${item.id}: ${error.message}`);
          failureCount++;
          return false;
        }
        
        successCount++;
        return true;
      } catch (error) {
        console.error(`Exception updating record ${item.id}:`, error);
        failureCount++;
        return false;
      }
    });
    
    // Wait for all updates in this batch to complete
    await Promise.all(updatePromises);
    
    // Show progress
    console.log(`Processed ${Math.min(i + batchSize, paths.length)} of ${paths.length} records...`);
  }
  
  // Show final results
  console.log('\nUpdate complete!');
  console.log(`- Successfully updated: ${successCount} records`);
  
  if (failureCount > 0) {
    console.log(`- Failed to update: ${failureCount} records`);
  }
}

/**
 * Check if files exist on disk and update is_deleted field
 */
async function updateDeletionStatus(
  supabase: SupabaseClient,
  records: Array<DocumentationFile>
): Promise<void> {
  let existingCount = 0;
  let missingCount = 0;
  let successCount = 0;
  let failureCount = 0;
  
  console.log(`Checking existence for ${records.length} files...`);
  
  // Root directory for file checking
  const rootDir = process.cwd();
  
  // Process in batches
  const batchSize = 10;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    // Check and update each record in the batch
    const updatePromises = batch.map(async (record) => {
      try {
        if (!record.file_path) {
          console.log(`Record ${record.id}: No file path to check`);
          return false;
        }
        
        // Form the absolute path
        const absolutePath = path.join(rootDir, record.file_path);
        
        // Check if file exists
        const exists = fs.existsSync(absolutePath);
        const isCurrentlyDeleted = record.is_deleted === true;
        
        // Only update if the status has changed
        if (exists && isCurrentlyDeleted) {
          // File exists but was marked deleted - update to false
          const { error } = await supabase
            .from('documentation_files')
            .update({ is_deleted: false })
            .eq('id', record.id);
            
          if (error) {
            console.error(`Error updating record ${record.id}: ${error.message}`);
            failureCount++;
            return false;
          }
          
          existingCount++;
          successCount++;
          console.log(`✅ Record ${record.id}: File exists, marked as NOT deleted`);
          return true;
        } else if (!exists && !isCurrentlyDeleted) {
          // File doesn't exist but wasn't marked deleted - update to true
          const { error } = await supabase
            .from('documentation_files')
            .update({ is_deleted: true })
            .eq('id', record.id);
            
          if (error) {
            console.error(`Error updating record ${record.id}: ${error.message}`);
            failureCount++;
            return false;
          }
          
          missingCount++;
          successCount++;
          console.log(`❌ Record ${record.id}: File missing, marked as deleted`);
          return true;
        } else {
          // Status already correct, no update needed
          if (exists) {
            existingCount++;
            console.log(`✓ Record ${record.id}: File exists, already marked correctly`);
          } else {
            missingCount++;
            console.log(`✓ Record ${record.id}: File missing, already marked correctly`);
          }
          return true;
        }
      } catch (error) {
        console.error(`Exception checking record ${record.id}:`, error);
        failureCount++;
        return false;
      }
    });
    
    // Wait for all updates in this batch to complete
    await Promise.all(updatePromises);
    
    // Show progress
    console.log(`Processed ${Math.min(i + batchSize, records.length)} of ${records.length} records...`);
  }
  
  // Show final results
  console.log('\nFile existence check complete!');
  console.log(`- Files found: ${existingCount} records`);
  console.log(`- Files missing: ${missingCount} records`);
  console.log(`- Records updated: ${successCount} records`);
  
  if (failureCount > 0) {
    console.log(`- Failed to update: ${failureCount} records`);
  }
  
  // Verify the database counts after update
  try {
    console.log('\nVerifying database counts after update...');
    const { count: activeCount, error: activeError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);
      
    if (activeError) {
      console.error(`Error counting active records: ${activeError.message}`);
    } else {
      console.log(`- Active records (is_deleted = FALSE): ${activeCount || 0}`);
    }
    
    const { count: deletedCount, error: deletedError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);
      
    if (deletedError) {
      console.error(`Error counting deleted records: ${deletedError.message}`);
    } else {
      console.log(`- Deleted records (is_deleted = TRUE): ${deletedCount || 0}`);
    }
    
    // Verify total matches what we expected
    if (activeCount !== null && deletedCount !== null) {
      const total = (activeCount || 0) + (deletedCount || 0);
      console.log(`- Total records: ${total}`);
      
      if (total === existingCount + missingCount) {
        console.log('✅ Database counts match our processed counts - SUCCESS!');
      } else {
        console.log('❌ Database counts do not match our processed counts:');
        console.log(`   Processed: ${existingCount + missingCount}, Database total: ${total}`);
      }
    }
  } catch (error) {
    console.error('Error verifying database counts:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * This functionality has been moved to:
 * packages/cli/src/services/document-organization/file-organizer.ts
 * 
 * @deprecated Use the file-organizer service instead
 */
async function findAndMoveDocumentByType(
  supabase: SupabaseClient,
  documentType: string,
  targetFolder: string
): Promise<void> {
  console.log(`\n=== FINDING A FILE WITH DOCUMENT TYPE: ${documentType} ===`);
  
  try {
    // First find out what columns are in document_types
    console.log(`Checking document_types table structure...`);
    const { data: docTypeColumns, error: columnsError } = await supabase
      .from('document_types')
      .select('*')
      .limit(1);
      
    if (columnsError) {
      console.error(`Error checking document types: ${columnsError.message}`);
      return;
    }
    
    if (!docTypeColumns || docTypeColumns.length === 0) {
      console.error(`No document types found in the database.`);
      return;
    }
    
    console.log(`Document type columns:`, Object.keys(docTypeColumns[0]));
    
    // Try all possible column names for the type
    const possibleColumns = ['name', 'type', 'document_type'];
    let nameColumn = null;
    
    for (const col of possibleColumns) {
      if (Object.keys(docTypeColumns[0]).includes(col)) {
        nameColumn = col;
        break;
      }
    }
    
    if (!nameColumn) {
      console.error(`Could not find name or type column in document_types table.`);
      return;
    }
    
    // Find document_type_id for the document type
    console.log(`Looking up document_type_id for "${documentType}" using column "${nameColumn}"...`);
    const { data: docTypes, error: docTypeError } = await supabase
      .from('document_types')
      .select('*')
      .eq(nameColumn, documentType);
    
    if (docTypeError) {
      console.error(`Error looking up document type: ${docTypeError.message}`);
      return;
    }
    
    if (!docTypes || docTypes.length === 0) {
      console.error(`Document type "${documentType}" not found in the database.`);
      console.log('Available document types:');
      
      // List all available document types
      const { data: allDocTypes, error: allDocError } = await supabase
        .from('document_types')
        .select('*');
        
      if (allDocError) {
        console.error(`Error fetching all document types: ${allDocError.message}`);
        return;
      }
      
      if (allDocTypes && allDocTypes.length > 0) {
        allDocTypes.forEach((dt: any, index: number) => {
          const typeName = nameColumn ? dt[nameColumn] : `[Type ${index}]`;
          console.log(`- ${typeName} (id: ${dt.id})`);
        });
      }
      
      return;
    }
    
    const docTypeId = docTypes[0].id;
    console.log(`Found document_type_id: ${docTypeId}`);
    
    // Find a file with this document type and is_deleted = false
    console.log(`Finding an active file with document type "${documentType}"...`);
    const { data: files, error: fileError } = await supabase
      .from('documentation_files')
      .select('id, file_path, title, document_type_id')
      .eq('document_type_id', docTypeId)
      .eq('is_deleted', false)
      .limit(1);
      
    if (fileError) {
      console.error(`Error finding file: ${fileError.message}`);
      return;
    }
    
    if (!files || files.length === 0) {
      console.error(`No active files found with document type "${documentType}".`);
      return;
    }
    
    const file = files[0];
    console.log(`Found file: ${file.title} (${file.file_path})`);
    
    // Check if the file exists
    const rootDir = process.cwd();
    const sourcePath = path.join(rootDir, file.file_path);
    
    if (!fs.existsSync(sourcePath)) {
      console.error(`File not found on disk: ${sourcePath}`);
      return;
    }
    
    // Ensure target directory exists
    const targetDir = path.join(rootDir, 'docs', targetFolder);
    if (!fs.existsSync(targetDir)) {
      console.log(`Creating target directory: ${targetDir}`);
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Get the filename from the path
    const fileName = path.basename(file.file_path);
    
    // Determine target path
    const targetPath = path.join(targetDir, fileName);
    
    // Move the file
    console.log(`Moving file from: ${sourcePath}`);
    console.log(`To: ${targetPath}`);
    
    try {
      // Copy the file first
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`File copied successfully.`);
      
      // Update the file_path in the database
      const newFilePath = `docs/${targetFolder}/${fileName}`;
      console.log(`Updating file_path in database to: ${newFilePath}`);
      
      const { error: updateError } = await supabase
        .from('documentation_files')
        .update({ file_path: newFilePath })
        .eq('id', file.id);
        
      if (updateError) {
        console.error(`Error updating file path in database: ${updateError.message}`);
        return;
      }
      
      console.log(`Database updated successfully.`);
      
      // Delete the original file
      fs.unlinkSync(sourcePath);
      console.log(`Original file deleted.`);
      
      console.log(`✅ File successfully moved and database updated!`);
    } catch (error) {
      console.error('Error moving file:', error instanceof Error ? error.message : 'Unknown error');
    }
  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Load environment variables
console.log('======= DOCUMENTATION FILES COUNT =======');
console.log('Loading environment variables...');

// Read and log all environment variables for debugging
const readEnvFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`Reading ${filePath} for debugging...`);
      const content = fs.readFileSync(filePath, 'utf8');
      const envVars = content.split('\n').filter(line => {
        // Filter out comments and empty lines
        return line.trim() && !line.trim().startsWith('#');
      });
      
      // Print each environment variable but hide sensitive values
      envVars.forEach(line => {
        if (line.includes('=')) {
          const [key, value] = line.split('=');
          if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN')) {
            console.log(`  ${key}=[REDACTED]`);
          } else {
            console.log(`  ${key}=${value}`);
          }
        }
      });
    } else {
      console.log(`${filePath} does not exist`);
    }
  } catch (error) {
    console.log(`Error reading ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Debug all env files
console.log('\n=== ENV FILES CONTENT ===');
readEnvFile(path.join(process.cwd(), '.env'));
readEnvFile(path.join(process.cwd(), '.env.local'));
readEnvFile(path.join(process.cwd(), '.env.development'));
console.log('=== END ENV FILES ===\n');

// Load the main .env file first as base - this should have the correct SUPABASE_SERVICE_ROLE_KEY
console.log('Loading from .env file (primary source)...');
loadDotEnv();

// Then override with .env.local if it exists (but keep original service key)
if (fs.existsSync('.env.local')) {
  console.log('Loading from .env.local file with partial override...');
  // Save service key before potential override
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Load .env.local
  loadDotEnv({ path: '.env.local', override: true });
  
  // Restore original service key if it was present
  if (originalServiceKey) {
    console.log('Restoring SUPABASE_SERVICE_ROLE_KEY from .env file');
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  }
}

// After loading, print all environment variables we're interested in
console.log('\nEnvironment variables after loading:');
console.log(`- SUPABASE_URL: ${process.env.SUPABASE_URL || 'Not set'}`);
console.log(`- CLI_SUPABASE_URL: ${process.env.CLI_SUPABASE_URL || 'Not set'}`);
console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Is set' : 'Not set'}`);
console.log(`- SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? 'Is set' : 'Not set'}`);

// Show first few characters of keys to verify we have the right ones
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const keyPreview = process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10);
  console.log(`- Service key preview: ${keyPreview}...`);
}

if (process.env.SUPABASE_ANON_KEY) {
  const anonPreview = process.env.SUPABASE_ANON_KEY.substring(0, 10);
  console.log(`- Anon key preview: ${anonPreview}...`);
}

// Make sure we're using CLI_SUPABASE_URL if it exists
if (process.env.CLI_SUPABASE_URL) {
  console.log('Using CLI_SUPABASE_URL instead of SUPABASE_URL');
  process.env.SUPABASE_URL = process.env.CLI_SUPABASE_URL;
  console.log(`- SUPABASE_URL (updated): ${process.env.SUPABASE_URL}`);
}

console.log('');

async function countDocumentationFiles() {
  // Array to store paths that need updating
  const pathsToUpdate: Array<{
    id: string;
    originalPath: string;
    normalizedPath: string;
  }> = [];
  
  // Document type mapping for file organization
  const documentTypeMapping = {
    'Code Documentation Markdown': 'code-documentation',
    'Deployment Environment Guide': 'deployment-environment',
    'External Library Documentation': 'external-library',
    'Git Repository Journal': 'git-repository',
    'README': 'readmes',
    'Script Report': 'script-reports',
    'Solution Guide': 'solution-guides',
    'Technical Specification': 'technical-specs'
  };
  
  try {
    // ==== GET SERVICE KEY, PRIORITIZING .ENV FILE KEY ====
    console.log('Using service role key from .env file...');
    
    // Directly use the SUPABASE_SERVICE_ROLE_KEY that should have been loaded from .env
    let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let keySource = 'SUPABASE_SERVICE_ROLE_KEY';

    // If for some reason it's still not set, check other potential keys as fallbacks
    if (!supabaseKey) {
      console.log('Primary service key not found, checking alternatives...');
      
      const fallbackKeys = {
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
        CLI_SUPABASE_SERVICE_ROLE_KEY: process.env.CLI_SUPABASE_SERVICE_ROLE_KEY,
        CLI_SUPABASE_SERVICE_KEY: process.env.CLI_SUPABASE_SERVICE_KEY
      };
      
      // Try each fallback key
      for (const [name, value] of Object.entries(fallbackKeys)) {
        if (value) {
          console.log(`Using ${name} as fallback`);
          supabaseKey = value;
          keySource = name;
          break;
        }
      }
    }
    
    // Get the URL (already handled in env loading)
    const supabaseUrl = process.env.SUPABASE_URL;
    
    // Validate credentials
    if (!supabaseUrl || !supabaseKey) {
      console.error('ERROR: Missing Supabase credentials!');
      console.error(`URL: ${supabaseUrl ? 'Set' : 'MISSING'}`);
      console.error(`Service Key: ${supabaseKey ? 'Set' : 'MISSING'}`);
      process.exit(1);
    }
    
    // Verify URL format
    if (!supabaseUrl.startsWith('http')) {
      console.error('ERROR: Invalid Supabase URL format!');
      console.error(`URL value: "${supabaseUrl}"`);
      console.error('The URL should start with http:// or https://');
      process.exit(1);
    }
    
    // Final connection details
    console.log('\nFINAL CONNECTION DETAILS:');
    console.log(`- URL: ${supabaseUrl}`);
    console.log(`- Key Source: ${keySource}`);
    console.log(`- Key Length: ${supabaseKey.length} chars`);
    console.log(`- Key Preview: ${supabaseKey.substring(0, 10)}...`);
    
    // Create Supabase client
    console.log('\nCreating Supabase client...');
    
    // Try with both anon key and service role key
    let connectionSuccess = false;
    let supabase;
    
    try {
      console.log('Attempt 1: Using service role key...');
      supabase = createClient(supabaseUrl, supabaseKey);
      
      // Test the connection
      console.log('Testing connection...');
      const { error: testError } = await supabase.from('documentation_files').select('count', { count: 'exact', head: true });
      
      if (testError) {
        console.error(`Service role key connection failed: ${testError.message}`);
        // Will try anon key next
      } else {
        console.log('Connection with service role key successful!');
        connectionSuccess = true;
      }
    } catch (error) {
      console.error('Error creating Supabase client with service role key:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Try with anon key if service key failed
    if (!connectionSuccess && process.env.SUPABASE_ANON_KEY) {
      try {
        console.log('\nAttempt 2: Trying with anon key instead...');
        supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);
        
        // Test the connection
        console.log('Testing connection with anon key...');
        const { error: anonTestError } = await supabase.from('documentation_files').select('count', { count: 'exact', head: true });
        
        if (anonTestError) {
          console.error(`Anon key connection failed: ${anonTestError.message}`);
        } else {
          console.log('Connection with anon key successful!');
          connectionSuccess = true;
        }
      } catch (error) {
        console.error('Error creating Supabase client with anon key:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // If all connection attempts failed, exit
    if (!connectionSuccess || !supabase) {
      console.error('\nFATAL ERROR: All connection attempts failed!');
      console.error('Please check your Supabase URL and keys.');
      process.exit(1);
    }
    
    console.log('\n✅ Connected to Supabase successfully!');
    
    // Try table access
    try {
      // JUST GET THE COUNT of records in documentation_files
      console.log('Counting records in documentation_files table...');
      const { count, error } = await supabase
        .from('documentation_files')
        .select('*', { count: 'exact', head: true });
  
      if (error) {
        console.error(`Error counting records: ${error.message}`);
        
        // Try a different table to see if it's specific to documentation_files
        console.log('\nTrying to access a different table to verify database access...');
        const { error: otherError } = await supabase
          .from('document_types')
          .select('*', { count: 'exact', head: true });
          
        if (otherError) {
          console.error(`Error accessing document_types: ${otherError.message}`);
          console.error('Database access appears to be completely broken.');
        } else {
          console.error('document_types table is accessible, but documentation_files is not.');
          console.error('This suggests documentation_files table might not exist or have permission issues.');
        }
        
        process.exit(1);
      }
  
      console.log('----------------------------------------');
      console.log(`✅ RECORDS FOUND IN DOCUMENTATION_FILES: ${count}`);
      console.log('----------------------------------------');
  
      // Success! Now if we have records, let's first check the structure
      if (count && count > 0) {
        console.log('Fetching first record to verify structure...');
        const { data: sampleData, error: recordError } = await supabase
          .from('documentation_files')
          .select('*')
          .limit(1)
          .single();
  
        if (recordError) {
          console.error(`Error fetching sample record: ${recordError.message}`);
        } else if (sampleData) {
          console.log('Sample record columns:');
          Object.keys(sampleData).forEach(key => {
            const value = sampleData[key];
            console.log(`- ${key}: ${typeof value} ${value ? '(has value)' : '(empty)'}`);
          });
          
          // Specifically check for file_path and is_deleted fields
          const hasFilePath = 'file_path' in sampleData;
          const hasIsDeleted = 'is_deleted' in sampleData;
          
          if (hasFilePath) {
            console.log(`\n✅ FILE_PATH COLUMN EXISTS: ${sampleData.file_path ? sampleData.file_path : 'Empty value'}`);
          } else {
            console.log('\n❌ FILE_PATH COLUMN MISSING!');
          }
          
          if (hasIsDeleted) {
            console.log(`✅ IS_DELETED COLUMN EXISTS: ${sampleData.is_deleted !== undefined ? String(sampleData.is_deleted) : 'Empty value'}`);
          } else {
            console.log('❌ IS_DELETED COLUMN MISSING!');
          }
          
          // Now fetch and display all file paths with their is_deleted status
          console.log('\n=== ALL FILE PATHS WITH DELETION STATUS ===');
          
          // Determine query based on available columns
          let selectQuery = 'id, file_path';
          if (hasIsDeleted) {
            selectQuery += ', is_deleted';
          }
          
          const { data: allPaths, error: allPathsError } = await supabase
            .from('documentation_files')
            .select(selectQuery)
            .order('file_path');
            
          if (allPathsError) {
            console.error(`Error fetching all paths: ${allPathsError.message}`);
          } else if (allPaths && allPaths.length > 0) {
            console.log('FILE PATH | IS_DELETED');
            console.log('-------------------------------');
            
            // Store all records for checking file existence later
            const allRecords: DocumentationFile[] = [];
            
            // Type the records properly but safely
            if (Array.isArray(allPaths)) {
              allPaths.forEach((record: any) => {
                const deletionStatus = hasIsDeleted && 'is_deleted' in record ? 
                  (record.is_deleted === true ? 'DELETED' : 
                  record.is_deleted === false ? 'active' : 
                  'null') : 'N/A';
                  
                // Safely access file_path and clean it up
                let filePath = record && 'file_path' in record ? record.file_path : '[missing]';
                
                // Store the original path for updating
                const originalPath = filePath;
                let normalizedPath = filePath;
                
                // Normalize paths to start from inside the project (docs, apps, etc.)
                if (normalizedPath && typeof normalizedPath === 'string') {
                  // Regular expression patterns to match
                  const appsFolderPattern = /(?:\/|^)apps\/([^/].+)/i;
                  const docsFolderPattern = /(?:\/|^)docs\/([^/].+)/i;
                  const srcFolderPattern = /(?:\/|^)src\/([^/].+)/i;
                  const packagesFolderPattern = /(?:\/|^)packages\/([^/].+)/i;
                  
                  // Match patterns for top-level folders
                  let match;
                  if (match = normalizedPath.match(appsFolderPattern)) {
                    normalizedPath = 'apps/' + match[1];
                  } else if (match = normalizedPath.match(docsFolderPattern)) {
                    normalizedPath = 'docs/' + match[1];
                  } else if (match = normalizedPath.match(srcFolderPattern)) {
                    normalizedPath = 'src/' + match[1];
                  } else if (match = normalizedPath.match(packagesFolderPattern)) {
                    normalizedPath = 'packages/' + match[1];
                  } else {
                    // For any other paths, remove everything up to the last directory
                    // that isn't a known top-level folder
                    const parts = normalizedPath.split('/');
                    const validParts = parts.filter(part => part && part !== 'dhg-mono' && 
                      !part.includes('Users') && !part.includes('Documents') && !part.includes('github'));
                    normalizedPath = validParts.join('/');
                  }
                  
                  // Remove any leading slash
                  normalizedPath = normalizedPath.replace(/^\/+/, '');
                  
                  // Store the normalized path and record ID for updating later
                  if (normalizedPath !== originalPath && record.id) {
                    pathsToUpdate.push({
                      id: record.id,
                      originalPath: originalPath,
                      normalizedPath: normalizedPath
                    });
                  }
                }
                
                // Display the normalized path
                console.log(`${normalizedPath || '[empty]'} | ${deletionStatus}`);
                
                // Store the record with normalized path for file existence check
                allRecords.push({
                  id: record.id,
                  file_path: normalizedPath,
                  is_deleted: record.is_deleted
                });
              });
            }
            
            console.log('-------------------------------');
            console.log(`Total: ${allPaths.length} file paths displayed.`);
            
            // Check if any paths need updating
            if (pathsToUpdate.length > 0) {
              console.log(`\n${pathsToUpdate.length} paths need normalization in the database.`);
              
              const shouldUpdate = await promptUserForUpdate(pathsToUpdate);
              
              if (shouldUpdate) {
                console.log('\nUpdating file paths in the database...');
                await updateFilePaths(supabase, pathsToUpdate);
                
                // Update the normalized paths in our records for the next check
                for (const update of pathsToUpdate) {
                  const record = allRecords.find(r => r.id === update.id);
                  if (record) {
                    record.file_path = update.normalizedPath;
                  }
                }
              }
            } else {
              console.log('\nAll file paths are already normalized. No updates needed.');
            }
            
            // Now prompt for file existence check
            const shouldCheckExistence = await promptUserForDeletionCheck();
            if (shouldCheckExistence) {
              await updateDeletionStatus(supabase, allRecords);
            }
          } else {
            console.log('No file paths found to display.');
          }
        }
      }
    } catch (dbError) {
      console.error('Unexpected database error:', dbError instanceof Error ? dbError.message : 'Unknown error');
      process.exit(1);
    }

  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Prompt user to choose an action
 */
async function promptForAction(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n=== CHOOSE AN ACTION ===');
  console.log('1. Count and verify documentation files');
  console.log('2. Check file existence and update deletion status');
  console.log('3. Exit');
  console.log();
  console.log('Note: Document organization features have been moved to:');
  console.log('packages/cli/src/services/document-organization');
  console.log('Use packages/cli/src/scripts/organize-docs.ts for organization tasks.');
  
  return new Promise((resolve) => {
    rl.question('\nEnter your choice (1-3): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * This functionality has been moved to:
 * packages/cli/src/services/document-organization/file-organizer.ts
 * 
 * @deprecated Use the file-organizer service instead
 */
async function listAllDocumentTypes(supabase: SupabaseClient): Promise<void> {
  console.log('\n=== LISTING ALL DOCUMENT TYPES ===');
  
  try {
    // Get the first record to determine column names
    const { data: firstDocType, error: firstError } = await supabase
      .from('document_types')
      .select('*')
      .limit(1);
      
    if (firstError) {
      console.error(`Error checking document types: ${firstError.message}`);
      return;
    }
    
    if (!firstDocType || firstDocType.length === 0) {
      console.error(`No document types found in the database.`);
      return;
    }
    
    // Determine which column contains the type name
    const possibleColumns = ['name', 'type', 'document_type'];
    let nameColumn = null;
    
    for (const col of possibleColumns) {
      if (Object.keys(firstDocType[0]).includes(col)) {
        nameColumn = col;
        break;
      }
    }
    
    if (!nameColumn) {
      console.error(`Could not find name or type column in document_types table.`);
      return;
    }
    
    // Get all document types
    const { data: allTypes, error: allError } = await supabase
      .from('document_types')
      .select('*')
      .order(nameColumn);
      
    if (allError) {
      console.error(`Error fetching all document types: ${allError.message}`);
      return;
    }
    
    if (!allTypes || allTypes.length === 0) {
      console.log('No document types found.');
      return;
    }
    
    console.log(`Found ${allTypes.length} document types:\n`);
    console.log(`ID | ${nameColumn.toUpperCase()} | CATEGORY | FILE COUNT`);
    console.log('-'.repeat(80));
    
    allTypes.forEach((type: any) => {
      const typeId = type.id;
      const typeName = type[nameColumn];
      const category = type.category || 'N/A';
      const count = type.current_num_of_type || '0';
      
      console.log(`${typeId} | ${typeName} | ${category} | ${count}`);
    });
    
  } catch (error) {
    console.error('Error listing document types:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * This functionality has been moved to:
 * packages/cli/src/services/document-organization/file-organizer.ts
 * 
 * @deprecated Use the file-organizer service instead
 */
async function moveAllFilesByDocumentType(
  supabase: SupabaseClient,
  documentTypeMapping: Record<string, string>
): Promise<void> {
  console.log('\n=== MOVING ALL FILES BASED ON DOCUMENT TYPE MAPPING ===');
  
  try {
    // Get all document types
    const { data: docTypes, error: docTypeError } = await supabase
      .from('document_types')
      .select('*');
      
    if (docTypeError) {
      console.error(`Error fetching document types: ${docTypeError.message}`);
      return;
    }
    
    if (!docTypes || docTypes.length === 0) {
      console.error('No document types found in database.');
      return;
    }
    
    // Determine which column contains the type name
    const possibleColumns = ['name', 'type', 'document_type'];
    let nameColumn = null;
    
    for (const col of possibleColumns) {
      if (Object.keys(docTypes[0]).includes(col)) {
        nameColumn = col;
        break;
      }
    }
    
    if (!nameColumn) {
      console.error(`Could not find name or type column in document_types table.`);
      return;
    }
    
    // Process each document type in our mapping
    for (const [documentType, targetFolder] of Object.entries(documentTypeMapping)) {
      console.log(`\nProcessing document type: "${documentType}" -> ${targetFolder}`);
      
      // Find the document type ID
      const matchingDocType = docTypes.find(dt => dt[nameColumn] === documentType);
      
      if (!matchingDocType) {
        console.log(`Document type "${documentType}" not found in the database. Skipping.`);
        continue;
      }
      
      const docTypeId = matchingDocType.id;
      console.log(`Found document_type_id: ${docTypeId}`);
      
      // Find all active files with this document type
      const { data: files, error: fileError } = await supabase
        .from('documentation_files')
        .select('id, file_path, title, document_type_id')
        .eq('document_type_id', docTypeId)
        .eq('is_deleted', false);
        
      if (fileError) {
        console.error(`Error finding files: ${fileError.message}`);
        continue;
      }
      
      if (!files || files.length === 0) {
        console.log(`No active files found with document type "${documentType}". Skipping.`);
        continue;
      }
      
      console.log(`Found ${files.length} files with document type "${documentType}"`);
      
      // Create target directory
      const rootDir = process.cwd();
      const targetDir = path.join(rootDir, 'docs', targetFolder);
      
      if (!fs.existsSync(targetDir)) {
        console.log(`Creating target directory: ${targetDir}`);
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Process each file
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      
      for (const file of files) {
        try {
          // Check if file already has the correct path
          if (file.file_path.startsWith(`docs/${targetFolder}/`)) {
            console.log(`File "${file.title}" already in correct location. Skipping.`);
            skipCount++;
            continue;
          }
          
          // Check if the file exists
          const sourcePath = path.join(rootDir, file.file_path);
          
          if (!fs.existsSync(sourcePath)) {
            console.log(`File not found on disk: ${sourcePath}. Skipping.`);
            skipCount++;
            continue;
          }
          
          // Get the filename from the path
          const fileName = path.basename(file.file_path);
          
          // Determine target path
          const targetPath = path.join(targetDir, fileName);
          
          // Skip if target file already exists
          if (fs.existsSync(targetPath)) {
            console.log(`Target file already exists: ${targetPath}. Skipping.`);
            skipCount++;
            continue;
          }
          
          // Move the file
          console.log(`Moving: ${file.file_path} -> docs/${targetFolder}/${fileName}`);
          
          // Copy the file first
          fs.copyFileSync(sourcePath, targetPath);
          
          // Update the file_path in the database
          const newFilePath = `docs/${targetFolder}/${fileName}`;
          
          const { error: updateError } = await supabase
            .from('documentation_files')
            .update({ file_path: newFilePath })
            .eq('id', file.id);
            
          if (updateError) {
            console.error(`Error updating file path in database: ${updateError.message}`);
            errorCount++;
            // Don't delete the source file if db update failed
            continue;
          }
          
          // Delete the original file
          fs.unlinkSync(sourcePath);
          successCount++;
          
        } catch (error) {
          console.error(`Error processing file "${file.title}":`, error instanceof Error ? error.message : 'Unknown error');
          errorCount++;
        }
      }
      
      console.log(`Document type "${documentType}" processing complete:`);
      console.log(`- ${successCount} files moved successfully`);
      console.log(`- ${skipCount} files skipped`);
      console.log(`- ${errorCount} errors`);
    }
    
    console.log('\nAll document types processed!');
    
  } catch (error) {
    console.error('Error moving files:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Initialize Supabase connection
async function initSupabaseConnection(): Promise<SupabaseClient> {
  console.log('Initializing database connection...');
  // Setup function to get database connection
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials!');
    process.exit(1);
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Initialize Supabase connection (remaining in this file for compatibility)
async function initSupabaseConnection(): Promise<SupabaseClient> {
  console.log('Initializing database connection...');
  // Setup function to get database connection
  const supabaseUrl = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials!');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Run the function with menu
async function main() {
  try {
    let supabase;
    let exit = false;
    
    while (!exit) {
      const choice = await promptForAction();
      
      switch (choice) {
        case '1':
          await countDocumentationFiles();
          break;
          
        case '2':
          // We need to initialize the database connection first
          if (!supabase) {
            supabase = await initSupabaseConnection();
          }
          
          // Get all active records
          const { data: records, error } = await supabase
            .from('documentation_files')
            .select('*');
            
          if (error) {
            console.error(`Error fetching records: ${error.message}`);
          } else if (records) {
            await updateDeletionStatus(supabase, records);
          }
          break;
          
        case '3':
          console.log('Exiting...');
          exit = true;
          break;
          
        default:
          console.log('Invalid choice, please try again.');
      }
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the main function
main()
  .then(() => console.log('Done!'))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });