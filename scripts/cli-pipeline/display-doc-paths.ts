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
import type { SupabaseClient as PackageSupabaseClient } from '../../packages/cli/node_modules/@supabase/supabase-js';

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

async function countDocumentationFiles() {
  const pathsToUpdate: PathUpdate[] = [];
  
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
                const result = await updateFilePaths(supabase as unknown as PackageSupabaseClient, pathsToUpdate);
                
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
              const result = await updateDeletionStatus(supabase as unknown as PackageSupabaseClient, allRecords);
              
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

// Fix the duplicate initSupabaseConnection function by keeping only one version:
async function initSupabaseConnection(): Promise<SupabaseClient> {
  console.log('Initializing database connection...');
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
            await updateDeletionStatus(supabase as unknown as PackageSupabaseClient, records);
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