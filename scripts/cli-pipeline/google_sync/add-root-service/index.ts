#!/usr/bin/env ts-node
/**
 * Add Google Drive Root Folder Using Service Account
 * 
 * This script adds a new Google Drive folder as a root folder in the database
 * using the Google service account for authentication.
 * 
 * Usage:
 *   npx ts-node add-root-service/index.ts <folderId> --name "Folder Name" [--description "Optional description"]
 * 
 * Example:
 *   npx ts-node add-root-service/index.ts 1MAyMwhKn8GwKHnb39-GbSNJQBYDVmxe1 --name "DHG Repository"
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { GoogleDriveService, GoogleAuthService, getGoogleDriveService } from '../../../../packages/shared/services/google-drive';
import { Logger } from '../../../../packages/shared/utils/logger';

// Load environment variables
function loadEnvFiles() {
  const envFiles = ['.env', '.env.local', '.env.development'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    try {
      dotenv.config({ path: filePath });
      Logger.debug(`Loaded environment from ${file}`);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
}

loadEnvFiles();

// Known folder IDs for easier reference
const KNOWN_FOLDERS: Record<string, string> = {
  'dynamic-healing': '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',
  'polyvagal-steering': '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc',
  'dhg-repository': '1MAyMwhKn8GwKHnb39-GbSNJQBYDVmxe1',
};

/**
 * Add a root folder to the database
 */
export async function addRootFolder(
  folderId: string,
  name?: string,
  description?: string,
  dryRun = false,
  verbose = false
): Promise<boolean> {
  try {
    // Get resolved folder ID if it's an alias
    let resolvedFolderId = folderId;
    if (KNOWN_FOLDERS[folderId]) {
      resolvedFolderId = KNOWN_FOLDERS[folderId];
      Logger.info(`Using known folder ID for "${folderId}": ${resolvedFolderId}`);
    }

    if (verbose) {
      Logger.info(`🔍 Checking folder with ID: ${resolvedFolderId}`);
    }

    // Initialize Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Initialize Google Drive service using the singleton pattern
    const driveService = getGoogleDriveService(supabase);

    // Verify the folder exists in Google Drive
    try {
      const folderData = await driveService.getFile(
        resolvedFolderId, 
        'id,name,mimeType'
      );
      
      const isFolder = folderData.mimeType === 'application/vnd.google-apps.folder';
      
      if (!isFolder) {
        Logger.error(`❌ The provided ID is not a folder: ${folderData.mimeType}`);
        return false;
      }
      
      // Use the folder name if no custom name is provided
      const folderName = name || folderData.name;
      if (verbose) {
        Logger.info(`Using folder name: "${folderName}"`);
      }
      
      // Check if folder already exists in the database
      const { data: existingFolders, error: queryError } = await supabase
        .from('sources_google2')
        .select('id, drive_id, name')
        .eq('drive_id', resolvedFolderId)
        .eq('is_deleted', false);
        
      if (queryError) {
        throw queryError;
      }
      
      if (dryRun) {
        if (existingFolders && existingFolders.length > 0) {
          Logger.info(`[DRY RUN] Would update existing folder "${existingFolders[0].name}" as root folder`);
        } else {
          Logger.info(`[DRY RUN] Would create new root folder "${folderName}"`);
        }
        return true;
      }
      
      // If folder exists, update it
      if (existingFolders && existingFolders.length > 0) {
        Logger.info(`Folder already exists with name "${existingFolders[0].name}", updating...`);
        
        const { data, error } = await supabase
          .from('sources_google2')
          .update({
            name: folderName,
            is_root: true,
            path: `/${folderName}`,
            path_array: [folderName],
            path_depth: 1,
            parent_folder_id: null,
            metadata: { 
              description: description || null,
              isRootFolder: true,
              lastUpdated: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('drive_id', resolvedFolderId)
          .select();
          
        if (error) {
          throw error;
        }
        
        Logger.info(`✅ Updated root folder: ${folderName}`);
        return true;
      }
      
      // Insert new root folder
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('sources_google2')
        .insert({
          drive_id: resolvedFolderId,
          name: folderName,
          is_root: true,
          mime_type: 'application/vnd.google-apps.folder',
          path: `/${folderName}`,
          path_array: [folderName],
          path_depth: 1,
          parent_folder_id: null,
          metadata: { 
            description: description || null,
            isRootFolder: true,
            createdAt: now
          },
          created_at: now,
          updated_at: now,
          is_deleted: false
        })
        .select();
        
      if (error) {
        throw error;
      }
      
      Logger.info(`✅ Added new root folder: ${folderName} with database ID: ${data[0].id}`);
      return true;
    } catch (error: any) {
      Logger.error(`❌ Error accessing folder: ${error.message}`);
      return false;
    }
  } catch (error: any) {
    Logger.error('❌ Error:', error.message);
    return false;
  }
}

// Parse command line arguments
function parseArgs(): { 
  folderId: string; 
  name?: string; 
  description?: string;
  dryRun: boolean;
  verbose: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  
  // Help flag
  const helpIndex = args.findIndex(arg => arg === '--help' || arg === '-h');
  if (helpIndex !== -1 || args.length === 0) {
    return {
      folderId: '',
      help: true,
      dryRun: false,
      verbose: false
    };
  }

  const folderId = args[0] && !args[0].startsWith('-') ? args[0] : '';
  const nameIndex = args.indexOf('--name');
  const name = nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : undefined;
  const descIndex = args.indexOf('--description');
  const description = descIndex !== -1 && args[descIndex + 1] ? args[descIndex + 1] : undefined;
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  return { folderId, name, description, dryRun, verbose, help: false };
}

// Display help message
function displayHelp() {
  console.log(`
Add Google Drive Root Folder Using Service Account

Usage:
  add-root-service <folderId> [options]

Arguments:
  folderId                Google Drive folder ID or one of the known aliases:
                          - dynamic-healing
                          - polyvagal-steering
                          - dhg-repository

Options:
  --name <name>           Custom name for the folder (if not provided, uses the folder name from Google Drive)
  --description <desc>    Optional description for the folder
  --dry-run               Show what would be done without making changes
  --verbose               Show detailed logs
  --help, -h              Show this help message

Examples:
  add-root-service 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --name "Dynamic Healing Discussion Group"
  add-root-service dynamic-healing
  add-root-service dhg-repository --description "Main DHG document repository" --dry-run
  `);
}

// Execute the main function when running directly
if (require.main === module) {
  (async () => {
    const args = parseArgs();
    
    if (args.help) {
      displayHelp();
      process.exit(0);
    }
    
    if (!args.folderId) {
      Logger.error('❌ Folder ID is required');
      displayHelp();
      process.exit(1);
    }
    
    const success = await addRootFolder(
      args.folderId,
      args.name,
      args.description,
      args.dryRun,
      args.verbose
    );
    
    process.exit(success ? 0 : 1);
  })();
}