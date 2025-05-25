#!/usr/bin/env ts-node
/**
 * Get Current Drive ID from Google Drive
 * 
 * This script retrieves the current drive_id for a file given its full path
 * and the root_drive_id where the search should start.
 */

import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { google } from 'googleapis';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

// Define interface for options
export interface GetCurrentDriveIdOptions {
  path: string;
  rootDriveId: string;
  verbose?: boolean;
}

// Initialize Google Drive API
async function initializeDriveAPI() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google service account credentials in environment variables');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

// Recursive function to find file by path
async function findFileByPath(
  drive: any,
  pathParts: string[],
  currentFolderId: string,
  currentPath: string[] = [],
  verbose: boolean = false
): Promise<string | null> {
  if (pathParts.length === 0) {
    return currentFolderId;
  }

  const targetName = pathParts[0];
  const remainingPath = pathParts.slice(1);
  const isLastPart = remainingPath.length === 0;

  if (verbose) {
    console.log(`Searching for "${targetName}" in folder ${currentFolderId}`);
    console.log(`Current path: ${currentPath.join(' > ')}`);
  }

  try {
    // Search for the item in the current folder
    const query = `'${currentFolderId}' in parents and name = '${targetName.replace(/'/g, "\\'")}'`;
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (!response.data.files || response.data.files.length === 0) {
      if (verbose) {
        console.log(`Not found: "${targetName}" in current folder`);
      }
      return null;
    }

    // If multiple matches, prefer folders unless it's the last part of the path
    let targetFile = response.data.files[0];
    if (response.data.files.length > 1) {
      if (!isLastPart) {
        // Looking for a folder
        const folder = response.data.files.find(f => f.mimeType === 'application/vnd.google-apps.folder');
        if (folder) {
          targetFile = folder;
        }
      }
      if (verbose && response.data.files.length > 1) {
        console.log(`Multiple matches found for "${targetName}", using: ${targetFile.name} (${targetFile.id})`);
      }
    }

    if (verbose) {
      console.log(`Found: "${targetFile.name}" (${targetFile.id})`);
    }

    // If this is the last part of the path, return the ID
    if (isLastPart) {
      return targetFile.id || null;
    }

    // Otherwise, continue searching in the found folder
    if (targetFile.mimeType !== 'application/vnd.google-apps.folder') {
      if (verbose) {
        console.log(`Error: "${targetFile.name}" is not a folder but path continues`);
      }
      return null;
    }

    return findFileByPath(
      drive,
      remainingPath,
      targetFile.id!,
      [...currentPath, targetName],
      verbose
    );
  } catch (error) {
    if (verbose) {
      console.error(`Error searching for "${targetName}":`, error);
    }
    return null;
  }
}

// Define program commands if run directly
const program = new Command();

program
  .name('get-current-drive-id')
  .description('Get the current drive_id for a file given its full path and root_drive_id')
  .option('-p, --path <path>', 'Full path to the file (e.g., "folder1/folder2/file.pdf")')
  .option('-r, --root-drive-id <id>', 'The root drive ID to start the search from')
  .option('-v, --verbose', 'Show detailed search progress', false)
  .action(async (options) => {
    await getCurrentDriveId({
      path: options.path,
      rootDriveId: options.rootDriveId,
      verbose: options.verbose
    });
  });

// Export the main function
export async function getCurrentDriveId(options: GetCurrentDriveIdOptions) {
  try {
    if (!options.path) {
      console.error('Error: --path parameter is required');
      console.error('Usage: get-current-drive-id --path <path> --root-drive-id <id>');
      process.exit(1);
    }

    if (!options.rootDriveId) {
      console.error('Error: --root-drive-id parameter is required');
      console.error('Usage: get-current-drive-id --path <path> --root-drive-id <id>');
      process.exit(1);
    }

    console.log(`Searching for: ${options.path}`);
    console.log(`Starting from root drive ID: ${options.rootDriveId}`);

    // Initialize Google Drive API
    const drive = await initializeDriveAPI();

    // Split the path into parts
    const pathParts = options.path.split('/').filter(part => part.length > 0);
    
    if (pathParts.length === 0) {
      console.error('Error: Path cannot be empty');
      process.exit(1);
    }

    // Search for the file
    const driveId = await findFileByPath(
      drive,
      pathParts,
      options.rootDriveId,
      [],
      options.verbose
    );

    if (driveId) {
      console.log(`\nFound file with drive_id: ${driveId}`);
      
      // Also check if this file exists in our database
      const supabase = SupabaseClientService.getInstance().getClient();
      const { data: dbRecord } = await supabase
        .from('sources_google')
        .select('id, name, path, modified_at, size')
        .eq('drive_id', driveId)
        .single();
        
      if (dbRecord) {
        console.log('\nDatabase record found:');
        console.log(`  Supabase ID: ${dbRecord.id}`);
        console.log(`  Name: ${dbRecord.name}`);
        console.log(`  Path: ${dbRecord.path}`);
        console.log(`  Modified: ${dbRecord.modified_at}`);
        console.log(`  Size: ${dbRecord.size ? `${(dbRecord.size / 1024 / 1024).toFixed(2)} MB` : 'unknown'}`);
      } else {
        console.log('\nNo matching record found in database');
      }
    } else {
      console.log(`\nFile not found at path: ${options.path}`);
      
      // Try to show where the search failed
      if (options.verbose) {
        console.log('\nTip: Check if the path is correct and all folder names are spelled correctly.');
      }
    }

  } catch (error) {
    console.error('Error:', error);
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
}