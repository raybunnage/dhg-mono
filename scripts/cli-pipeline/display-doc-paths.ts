#!/usr/bin/env ts-node

/**
 * SIMPLE SCRIPT TO COUNT RECORDS IN DOCUMENTATION_FILES TABLE
 * This is a minimal script that just connects and counts records
 */

import * as dotenv from 'dotenv';

// Load environment variables from different .env files
dotenv.config(); // Load base .env
dotenv.config({ path: '.env.development' }); // Load environment specific
dotenv.config({ path: '.env.local' }); // Load local overrides
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { 
  normalizePath, 
  PathUpdate 
} from '../../packages/cli/src/services/file-management/path-normalizer';
import { 
  updateDeletionStatus, 
  DocumentationFile 
} from '../../packages/cli/src/services/file-management/status-checker';
import { 
  updateFilePaths 
} from '../../packages/cli/src/services/file-management/db-updater';
import {
  FileDiscoveryService,
  DiscoveryResult
} from '../../packages/cli/src/services/file-management/file-discovery';
import { 
  SupabaseClient, 
  SupabaseClientService, 
  getSupabaseClient 
} from '../../packages/cli/src/services/supabase-client';

/**
 * Prompt the user to confirm they want to update the file paths
 */
async function promptUserForUpdate(paths: Array<PathUpdate>): Promise<boolean> {
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
 * Prompt the user to confirm they want to add the discovered files to the database
 */
async function promptUserForFileAddition(files: DiscoveryResult): Promise<boolean> {
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n=== ADD NEW DOCUMENTATION FILES TO DATABASE ===');
  console.log(`Found ${files.newFiles.length} new documentation files that are not in the database.`);
  console.log('This will:');
  console.log('1. Add each file to the documentation_files table');
  console.log('2. Extract titles and summaries from the files');
  console.log('3. Calculate file hashes and gather metadata');
  
  if (files.newFiles.length === 0) {
    console.log('\nNo new files to add. All documentation files are already in the database.');
    rl.close();
    return false;
  }
  
  // Display a sample of the files that will be added
  console.log('\nSample of files that will be added:');
  console.log('----------------------------------');
  
  const sampleSize = Math.min(files.newFiles.length, 10);
  for (let i = 0; i < sampleSize; i++) {
    console.log(`${i + 1}. ${files.newFiles[i].file_path}`);
    if (files.newFiles[i].title) {
      console.log(`   Title: ${files.newFiles[i].title}`);
    }
  }
  
  if (files.newFiles.length > sampleSize) {
    console.log(`... and ${files.newFiles.length - sampleSize} more files`);
  }
  
  return new Promise((resolve) => {
    rl.question(`\nDo you want to add these ${files.newFiles.length} files to the database? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Discover new documentation files and add them to the database
 */
async function discoverAndAddNewFiles(): Promise<void> {
  console.log('\n=== DISCOVERING NEW DOCUMENTATION FILES ===');
  
  try {
    // Initialize Supabase connection
    const supabase = await initSupabaseConnection();
    
    // Create file discovery service
    const discoveryService = new FileDiscoveryService(supabase);
    
    // First discover files without inserting them
    console.log('Scanning project for documentation files...');
    const discoveryResult = await discoveryService.discoverNewFiles(false);
    
    // Display stats
    console.log('\nDISCOVERY RESULTS:');
    console.log(`- Total files scanned: ${discoveryResult.totalScanned}`);
    console.log(`- Existing files in database: ${discoveryResult.existingCount}`);
    console.log(`- New files discovered: ${discoveryResult.newFiles.length}`);
    
    if (discoveryResult.errors.length > 0) {
      console.log('\nErrors encountered during discovery:');
      discoveryResult.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    // Prompt user to add files to database
    const shouldAddFiles = await promptUserForFileAddition(discoveryResult);
    
    if (shouldAddFiles) {
      console.log('\nAdding files to database...');
      const insertResult = await discoveryService.discoverNewFiles(true);
      
      console.log('\nINSERT RESULTS:');
      console.log(`- Files successfully added: ${insertResult.newFiles.length}`);
      
      if (insertResult.errors.length > 0) {
        console.log('\nErrors encountered during insertion:');
        insertResult.errors.forEach((error, index) => {
          console.log(`${index + 1}. ${error}`);
        });
      }
    } else {
      console.log('\nNo files were added to the database.');
    }
  } catch (error) {
    console.error('\nError discovering and adding files:', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function countDocumentationFiles() {
  const pathsToUpdate: PathUpdate[] = [];
  
  try {
    // Use our improved connection function
    console.log('Initializing Supabase connection...');
    let supabase;
    
    try {
      // Use the initSupabaseConnection function we defined
      supabase = await initSupabaseConnection();
      console.log('✅ Successfully connected to Supabase!');
    } catch (error) {
      console.error('❌ Failed to connect to Supabase:');
      console.error(error instanceof Error ? error.message : 'Unknown error');
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
                const originalPath = record.file_path;
                const normalizedPath = normalizePath(originalPath);
                
                if (normalizedPath !== originalPath && record.id) {
                  pathsToUpdate.push({
                    id: record.id,
                    originalPath,
                    normalizedPath
                  });
                }
                
                console.log(`${normalizedPath || '[empty]'} | ${record.is_deleted === true ? 'DELETED' : 'active'}`);
                
                allRecords.push({
                  id: record.id,
                  file_path: normalizedPath,
                  is_deleted: record.is_deleted
                });
              });
            }
            
            console.log('-------------------------------');
            console.log(`Total: ${allPaths.length} file paths displayed.`);
            
            // Use the services for updates
            if (pathsToUpdate.length > 0) {
              console.log(`\n${pathsToUpdate.length} paths need normalization in the database.`);
              
              const shouldUpdate = await promptUserForUpdate(pathsToUpdate);
              if (shouldUpdate) {
                console.log('\nUpdating file paths in the database...');
                const result = await updateFilePaths(supabase, pathsToUpdate);
                
                console.log('\nUpdate complete!');
                console.log(`- Successfully updated: ${result.successCount} records`);
                if (result.failureCount > 0) {
                  console.log(`- Failed to update: ${result.failureCount} records`);
                }
                
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
            
            // Use the status checker service
            const shouldCheckExistence = await promptUserForDeletionCheck();
            if (shouldCheckExistence) {
              const result = await updateDeletionStatus(supabase, allRecords);
              
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
                
                if (activeCount !== null && deletedCount !== null) {
                  const total = (activeCount || 0) + (deletedCount || 0);
                  console.log(`- Total records: ${total}`);
                  
                  if (total === result.existingCount + result.missingCount) {
                    console.log('✅ Database counts match our processed counts - SUCCESS!');
                  } else {
                    console.log('❌ Database counts do not match our processed counts:');
                    console.log(`   Processed: ${result.existingCount + result.missingCount}, Database total: ${total}`);
                  }
                }
              } catch (error) {
                console.error('Error verifying database counts:', error instanceof Error ? error.message : 'Unknown error');
              }
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
  console.log('3. Discover and add new documentation files');
  console.log('4. Exit');
  console.log();
  console.log('Note: Document organization features have been moved to:');
  console.log('packages/cli/src/services/document-organization');
  console.log('Use packages/cli/src/scripts/organize-docs.ts for organization tasks.');
  
  return new Promise((resolve) => {
    rl.question('\nEnter your choice (1-4): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Use our shared Supabase client service instead
async function initSupabaseConnection(): Promise<SupabaseClient> {
  console.log('Initializing database connection...');
  
  // Debug environment variables
  console.log('\nDEBUGGING ENVIRONMENT VARIABLES:');
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL || '[NOT SET]'}`);
  console.log(`CLI_SUPABASE_URL: ${process.env.CLI_SUPABASE_URL || '[NOT SET]'}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '[SET]' : '[NOT SET]'}`);
  console.log(`CLI_SUPABASE_KEY: ${process.env.CLI_SUPABASE_KEY ? '[SET]' : '[NOT SET]'}`);
  
  // Check if URL is properly set
  const cliSupabaseUrl = process.env.CLI_SUPABASE_URL;
  // If CLI_SUPABASE_URL contains a variable reference (${}) that wasn't interpolated
  const supabaseUrl = (cliSupabaseUrl && !cliSupabaseUrl.includes('${')) ? cliSupabaseUrl : process.env.SUPABASE_URL;
  
  // Check for key and make sure it doesn't contain variable references
  const cliKey = process.env.CLI_SUPABASE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  let supabaseKey = null;
  if (cliKey && !cliKey.includes('${')) {
    supabaseKey = cliKey;
    console.log('Using CLI_SUPABASE_KEY');
  } else if (serviceRoleKey) {
    supabaseKey = serviceRoleKey;
    console.log('Using SUPABASE_SERVICE_ROLE_KEY');
  }
  
  // Debug the key format (first few characters)
  if (supabaseKey) {
    console.log(`Key format check: ${supabaseKey.substring(0, 20)}...`);
    // Verify the format (JWT tokens typically start with "ey")
    if (!supabaseKey.startsWith('ey')) {
      console.warn('WARNING: Key doesn\'t look like a JWT token (should start with "ey")');
    }
  }
  
  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    console.error(`Invalid Supabase URL: "${supabaseUrl}"`);
    throw new Error('Invalid Supabase URL. It must start with http:// or https://');
  }
  
  if (!supabaseKey) {
    throw new Error('Missing Supabase API key');
  }
  
  // Initialize the client directly
  const supabaseService = SupabaseClientService.getInstance();
  const client = supabaseService.initialize(supabaseUrl, supabaseKey);
  
  // Test the connection
  console.log('Testing connection...');
  const connectionTest = await supabaseService.testConnection();
  if (!connectionTest.success) {
    console.error(`Connection test failed: ${connectionTest.error}`);
    if (connectionTest.details) {
      console.error('Error details:', connectionTest.details);
    }
    throw new Error(`Failed to connect to Supabase: ${connectionTest.error}`);
  }
  
  console.log('✅ Connection successful!');
  return client;
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
          // Discover and add new documentation files
          await discoverAndAddNewFiles();
          break;
          
        case '4':
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