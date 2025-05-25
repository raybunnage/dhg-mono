#!/usr/bin/env ts-node
/**
 * Check Duplicates in sources_google Script
 * 
 * This script checks for duplicate records in sources_google by name and drive_id
 */

import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { google } from 'googleapis';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

// Initialize Google Drive API (only when needed)
async function initializeDriveAPI() {
  try {
    // Get service account key file path from environment or default location
    const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                       process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                       path.resolve(process.cwd(), '.service-account.json');
    
    // Check if the service account file exists
    const fs = await import('fs');
    if (!fs.existsSync(keyFilePath)) {
      throw new Error(`Service account file not found at: ${keyFilePath}`);
    }
    
    // Read and parse the service account key file
    const keyFileData = fs.readFileSync(keyFilePath, 'utf8');
    const keyFile = JSON.parse(keyFileData);
    
    // Create JWT auth client
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    return google.drive({ version: 'v3', auth });
  } catch (error: any) {
    console.error('Failed to initialize Google Drive API:', error.message);
    throw error;
  }
}

// Check if a drive_id exists in Google Drive
async function checkDriveIdExists(drive: any, driveId: string): Promise<boolean | null> {
  try {
    await drive.files.get({
      fileId: driveId,
      fields: 'id',
      supportsAllDrives: true,
    });
    return true;
  } catch (error: any) {
    if (error.code === 404) {
      return false;
    }
    // For other errors, assume we can't determine
    console.error(`Error checking drive_id ${driveId}:`, error.message);
    return null;
  }
}

// Find the current drive_id for a file by its path
async function findCurrentDriveId(
  drive: any,
  pathArray: string[],
  rootDriveId: string
): Promise<string | null> {
  try {
    let currentFolderId = rootDriveId;
    
    // Navigate through each part of the path
    for (let i = 0; i < pathArray.length; i++) {
      const targetName = pathArray[i];
      const isLastPart = i === pathArray.length - 1;
      
      // Search for the item in the current folder
      const query = `'${currentFolderId}' in parents and name = '${targetName.replace(/'/g, "\\'")}'`;
      
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      if (!response.data.files || response.data.files.length === 0) {
        return null;
      }

      // If multiple matches, prefer folders unless it's the last part
      let targetFile = response.data.files[0];
      if (response.data.files.length > 1 && !isLastPart) {
        const folder = response.data.files.find((f: any) => f.mimeType === 'application/vnd.google-apps.folder');
        if (folder) {
          targetFile = folder;
        }
      }

      // If this is the last part, return the ID
      if (isLastPart) {
        return targetFile.id || null;
      }

      // Otherwise, continue searching in the found folder
      if (targetFile.mimeType !== 'application/vnd.google-apps.folder') {
        return null;
      }

      currentFolderId = targetFile.id!;
    }
    
    return currentFolderId;
  } catch (error) {
    console.error('Error finding current drive_id:', error);
    return null;
  }
}

// Define interfaces for type safety
interface SourceRecord {
  id: string;
  drive_id: string;
  name: string;
  path: string;
  path_array: string[] | null;
  size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
  modified_at?: string; // Use modified_at instead of modified_time
  root_drive_id?: string | null;
  is_current?: boolean; // Added to track if this is the current drive_id
}

interface DuplicateGroup {
  name?: string;
  drive_id?: string;
  path_array?: string[];
  count: number;
  total_size?: number;
  records: SourceRecord[] | Array<{id: string, drive_id?: string, name?: string, path?: string}>;
}

// Define interface for options
export interface CheckDuplicatesOptions {
  limit?: number;
  json?: boolean;
  byName?: boolean;
  byDriveId?: boolean;
  byPathArray?: boolean;
  all?: boolean;
  verbose?: boolean;
  checkCurrent?: boolean; // Check if drive_ids are current
}

// Define program commands if run directly
const program = new Command();

program
  .name('check-duplicates')
  .description('Check for duplicate records in sources_google table')
  .option('-l, --limit <number>', 'Limit the number of duplicate groups to display', '10')
  .option('-j, --json', 'Output in JSON format')
  .option('-n, --by-name', 'Check duplicates by name')
  .option('-d, --by-drive-id', 'Check duplicates by drive_id')
  .option('-p, --by-path-array', 'Check duplicates by path_array (default)', true)
  .option('-a, --all', 'Check all types of duplicates', false)
  .option('-v, --verbose', 'Show detailed information for each duplicate', false)
  .option('-c, --check-current', 'Check if drive_ids are current (requires Google API)', false);

// Export the main function for use in index.ts
export async function checkDuplicates(options: CheckDuplicatesOptions) {
  try {
    console.log('Checking for duplicates in sources_google table...');
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Get total count
    const { count, error: countError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      throw new Error(`Failed to count records: ${countError.message}`);
    }
    
    console.log(`Total records in sources_google: ${count}`);
    
    // Fetch all records - this approach is suitable for smaller tables
    // For large tables, we would use SQL directly with GROUP BY
    const { data, error } = await supabase
      .from('sources_google')
      .select('id, drive_id, name, path, path_array, size, mime_type, created_at, updated_at, modified_at, root_drive_id')
      .order('name');
      
    if (error) {
      throw new Error(`Failed to fetch records: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log('No records found in sources_google');
      return;
    }
    
    // Check for path_array duplicates (default)
    if (options.byPathArray !== false || options.all) {
      console.log('\nChecking for duplicate path_arrays...');
      
      const pathArrayGroups: Record<string, SourceRecord[]> = {};
      
      // Group by path_array (convert to string for comparison)
      data.forEach((record: SourceRecord) => {
        if (!record.path_array || record.path_array.length === 0) return;
        
        const pathKey = JSON.stringify(record.path_array);
        if (!pathArrayGroups[pathKey]) {
          pathArrayGroups[pathKey] = [];
        }
        pathArrayGroups[pathKey].push(record);
      });
      
      // Filter for duplicates
      const duplicatePathArrays: DuplicateGroup[] = Object.entries(pathArrayGroups)
        .filter(([_, records]) => records.length > 1)
        .map(([pathKey, records]) => {
          const totalSize = records.reduce((sum, r) => sum + (r.size || 0), 0);
          return {
            path_array: JSON.parse(pathKey),
            count: records.length,
            total_size: totalSize,
            records: options.verbose ? records : records.map(r => ({ 
              id: r.id, 
              drive_id: r.drive_id, 
              name: r.name,
              path: r.path,
              root_drive_id: r.root_drive_id 
            }))
          };
        })
        .sort((a, b) => b.count - a.count);
      
      const limit = options.limit || 10;
      const displayDuplicates = duplicatePathArrays.slice(0, limit);
      
      if (options.json) {
        console.log(JSON.stringify({
          total_path_array_duplicates: duplicatePathArrays.length,
          duplicates: displayDuplicates
        }, null, 2));
      } else {
        console.log(`Found ${duplicatePathArrays.length} path_arrays with duplicates:`);
        
        for (const dupGroup of displayDuplicates) {
          const pathStr = dupGroup.path_array!.join(' > ');
          const sizeInMB = dupGroup.total_size ? (dupGroup.total_size / (1024 * 1024)).toFixed(2) : '0';
          
          console.log(`\nPath: "${pathStr}" appears ${dupGroup.count} times (${sizeInMB} MB total):`);
          
          // Check if we need to verify current drive_ids
          let drive: any = null;
          let currentDriveId: string | null = null;
          if (options.checkCurrent) {
            try {
              drive = await initializeDriveAPI();
              
              // Try to find the current drive_id for this path
              const firstRecord = dupGroup.records[0] as SourceRecord;
              
              // Debug: show what we have
              if (options.verbose) {
                console.log(`  Debug - First record data:`);
                console.log(`    root_drive_id: ${firstRecord.root_drive_id || 'null'}`);
                console.log(`    path_array exists: ${dupGroup.path_array ? 'yes' : 'no'}`);
                if (dupGroup.path_array) {
                  console.log(`    path_array: [${dupGroup.path_array.join(', ')}]`);
                }
              }
              
              if (firstRecord.root_drive_id && dupGroup.path_array && dupGroup.path_array.length > 0) {
                if (options.verbose) {
                  console.log(`  🔍 Searching for current file in Google Drive...`);
                  console.log(`     Root Drive ID: ${firstRecord.root_drive_id}`);
                  console.log(`     Path: ${dupGroup.path_array.join(' > ')}`);
                }
                currentDriveId = await findCurrentDriveId(drive, dupGroup.path_array, firstRecord.root_drive_id);
                if (currentDriveId) {
                  console.log(`  📍 Current Drive ID in Google Drive: ${currentDriveId}`);
                } else {
                  console.log(`  ❌ File not found at this path in Google Drive`);
                }
              } else {
                const missingInfo = [];
                if (!firstRecord.root_drive_id) missingInfo.push('root_drive_id');
                if (!dupGroup.path_array || dupGroup.path_array.length === 0) missingInfo.push('valid path_array');
                console.log(`  ⚠️  Cannot search - missing ${missingInfo.join(' and ')}`);
              }
            } catch (error) {
              console.log('  ⚠️  Could not initialize Google Drive API - current status unknown');
            }
          }
          
          for (const record of dupGroup.records) {
            const fullRecord = record as SourceRecord;
            
            // Check if this drive_id is current
            let currentStatus = '';
            if (options.checkCurrent && currentDriveId) {
              if (fullRecord.drive_id === currentDriveId) {
                currentStatus = ' ✅ CURRENT';
              } else {
                currentStatus = ' ❌ OUTDATED (can be deleted)';
              }
            } else if (options.checkCurrent && drive && fullRecord.drive_id) {
              // Fallback to checking if the drive_id exists
              const exists = await checkDriveIdExists(drive, fullRecord.drive_id);
              if (exists === true) {
                currentStatus = ' ℹ️ EXISTS';
              } else if (exists === false) {
                currentStatus = ' ❌ NOT FOUND';
              } else {
                currentStatus = ' ⚠️  UNKNOWN';
              }
            }
            
            if (options.verbose) {
              const sizeMB = fullRecord.size ? (fullRecord.size / (1024 * 1024)).toFixed(2) : 'unknown';
              console.log(`  - ID: ${fullRecord.id}, Name: ${fullRecord.name}, Size: ${sizeMB} MB${currentStatus}`);
              console.log(`    Drive ID: ${fullRecord.drive_id}, Type: ${fullRecord.mime_type || 'unknown'}`);
              console.log(`    Created: ${fullRecord.created_at}, Updated: ${fullRecord.updated_at}`);
            } else {
              console.log(`  - ID: ${record.id}, Drive ID: ${fullRecord.drive_id}${currentStatus}`);
            }
          }
        }
        
        if (duplicatePathArrays.length > limit) {
          console.log(`\n... and ${duplicatePathArrays.length - limit} more duplicate path_array groups`);
        }
      }
    }
    
    // Check for name duplicates
    if (options.byName || options.all) {
      const nameGroups: Record<string, SourceRecord[]> = {};
      
      // Group by name
      data.forEach((record: SourceRecord) => {
        const name = record.name || '(unnamed)';
        if (!nameGroups[name]) {
          nameGroups[name] = [];
        }
        nameGroups[name].push(record);
      });
      
      // Filter for duplicates
      const duplicateNames: DuplicateGroup[] = Object.entries(nameGroups)
        .filter(([_, records]) => records.length > 1)
        .map(([name, records]) => ({
          name,
          count: records.length,
          records: options.verbose ? records : records.map(r => ({ id: r.id, drive_id: r.drive_id }))
        }))
        .sort((a, b) => b.count - a.count);
      
      const limit = options.limit || 10;
      const displayDuplicates = duplicateNames.slice(0, limit);
      
      if (options.json) {
        console.log(JSON.stringify({
          total_name_duplicates: duplicateNames.length,
          duplicates: displayDuplicates
        }, null, 2));
      } else {
        console.log(`\nFound ${duplicateNames.length} files with duplicate names:`);
        
        // Initialize drive API if needed
        let drive: any = null;
        if (options.checkCurrent) {
          try {
            drive = await initializeDriveAPI();
          } catch (error) {
            console.log('  ⚠️  Could not initialize Google Drive API - current status unknown');
          }
        }
        
        for (const dupGroup of displayDuplicates) {
          console.log(`\n"${dupGroup.name}" appears ${dupGroup.count} times:`);
          for (const record of dupGroup.records) {
            const fullRecord = record as SourceRecord;
            
            // Check if this drive_id is current
            let currentStatus = '';
            if (options.checkCurrent && drive && fullRecord.drive_id) {
              const isCurrent = await checkDriveIdExists(drive, fullRecord.drive_id);
              if (isCurrent === true) {
                currentStatus = ' ✅ CURRENT';
              } else if (isCurrent === false) {
                currentStatus = ' ❌ NOT FOUND';
              } else {
                currentStatus = ' ⚠️  UNKNOWN';
              }
            }
            
            if (options.verbose) {
              console.log(`  - ID: ${fullRecord.id}, Drive ID: ${fullRecord.drive_id}${currentStatus}, Path: ${fullRecord.path}`);
              console.log(`    Created: ${fullRecord.created_at}, Updated: ${fullRecord.updated_at}`);
            } else {
              console.log(`  - ID: ${record.id}, Drive ID: ${(record as any).drive_id}${currentStatus}`);
            }
          }
        }
        
        if (duplicateNames.length > limit) {
          console.log(`\n... and ${duplicateNames.length - limit} more duplicate groups`);
        }
      }
    }
    
    // Check for drive_id duplicates
    if (options.byDriveId || options.all) {
      console.log('\nChecking for duplicate drive_ids...');
      const driveIdGroups: Record<string, SourceRecord[]> = {};
      
      // Group by drive_id
      data.forEach((record: SourceRecord) => {
        if (!record.drive_id) return; // Skip records without drive_id
        
        if (!driveIdGroups[record.drive_id]) {
          driveIdGroups[record.drive_id] = [];
        }
        driveIdGroups[record.drive_id].push(record);
      });
      
      // Filter for duplicates
      const duplicateDriveIds: DuplicateGroup[] = Object.entries(driveIdGroups)
        .filter(([_, records]) => records.length > 1)
        .map(([driveId, records]) => ({
          drive_id: driveId,
          count: records.length,
          records: options.verbose ? records : records.map(r => ({ id: r.id, name: r.name }))
        }))
        .sort((a, b) => b.count - a.count);
      
      const limit = options.limit || 10;
      const displayDuplicates = duplicateDriveIds.slice(0, limit);
      
      if (options.json) {
        console.log(JSON.stringify({
          total_drive_id_duplicates: duplicateDriveIds.length,
          duplicates: displayDuplicates
        }, null, 2));
      } else {
        console.log(`\nFound ${duplicateDriveIds.length} drive_ids with duplicate records:`);
        
        // Initialize drive API if needed
        let drive: any = null;
        if (options.checkCurrent) {
          try {
            drive = await initializeDriveAPI();
          } catch (error) {
            console.log('  ⚠️  Could not initialize Google Drive API - current status unknown');
          }
        }
        
        for (const dupGroup of displayDuplicates) {
          console.log(`\nDrive ID "${dupGroup.drive_id}" appears ${dupGroup.count} times:`);
          
          // Check if this drive_id exists (only check once per group)
          let groupCurrentStatus = '';
          if (options.checkCurrent && drive && dupGroup.drive_id) {
            const isCurrent = await checkDriveIdExists(drive, dupGroup.drive_id);
            if (isCurrent === true) {
              groupCurrentStatus = ' ✅ EXISTS IN GOOGLE DRIVE';
            } else if (isCurrent === false) {
              groupCurrentStatus = ' ❌ NOT FOUND IN GOOGLE DRIVE (can be deleted)';
            } else {
              groupCurrentStatus = ' ⚠️  UNABLE TO VERIFY';
            }
            console.log(`  Status: ${groupCurrentStatus}`);
          }
          
          dupGroup.records.forEach(record => {
            if (options.verbose) {
              const fullRecord = record as SourceRecord;
              console.log(`  - ID: ${fullRecord.id}, Name: ${fullRecord.name}, Path: ${fullRecord.path}`);
              console.log(`    Created: ${fullRecord.created_at}, Updated: ${fullRecord.updated_at}`);
            } else {
              console.log(`  - ID: ${record.id}, Name: "${(record as any).name}"`);
            }
          });
        }
        
        if (duplicateDriveIds.length > limit) {
          console.log(`\n... and ${duplicateDriveIds.length - limit} more duplicate groups`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    if (require.main === module) {
      process.exit(1);
    } else {
      throw error;
    }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  program.parse(process.argv);
  const options = program.opts();
  
  // Convert options to CheckDuplicatesOptions interface format
  const checkOptions: CheckDuplicatesOptions = {
    limit: options.limit ? parseInt(options.limit, 10) : 10,
    json: options.json || false,
    byName: options.byName || false,
    byDriveId: options.byDriveId || false,
    byPathArray: options.byPathArray !== false, // true by default
    all: options.all || false,
    verbose: options.verbose || false,
    checkCurrent: options.checkCurrent || false
  };
  
  checkDuplicates(checkOptions).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}