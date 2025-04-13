#!/usr/bin/env ts-node
/**
 * Count MP4 Files
 * 
 * This script counts MP4 files in a Google Drive folder or local filesystem.
 * 
 * Usage:
 *   ts-node count-mp4-files.ts [drive_id] [options]
 * 
 * Options:
 *   --list               List all files found
 *   --summary            Show only summary information
 *   --local              Use local filesystem instead of Google Drive
 *   --verbose            Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { GoogleDriveService } from '../../../packages/shared/services/google-drive';

// Load environment variables
function loadEnvFiles() {
  const envFiles = ['.env', '.env.local', '.env.development'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    try {
      dotenv.config({ path: filePath });
      console.log(`Loaded environment from ${file}`);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
}

loadEnvFiles();

// Parse command line arguments
const args = process.argv.slice(2);
let driveId = args[0] && !args[0].startsWith('--') ? args[0] : undefined;
const showList = args.includes('--list');
const showSummary = args.includes('--summary');
const useLocal = args.includes('--local');
const verbose = args.includes('--verbose');

// Dynamic Healing Discussion Group folder ID as default
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Interfaces for return type
export interface CountMp4Result {
  total: number;
  files: string[];
}

/**
 * Count MP4 files in a Google Drive folder or local filesystem
 */
export async function countMp4Files(options: {
  driveId?: string;
  list?: boolean;
  summary?: boolean;
  local?: boolean;
  verbose?: boolean;
}): Promise<CountMp4Result> {
  const { driveId, list, summary, local, verbose } = options;
  
  // Initialize result
  let mp4Files: string[] = [];
  
  if (verbose) {
    console.log(`=== Count MP4 Files ===`);
    console.log(`Mode: ${local ? 'Local filesystem' : 'Google Drive'}`);
    if (driveId) {
      console.log(`Folder ID/path: ${driveId}`);
    } else if (!local) {
      console.log(`Folder ID: ${DYNAMIC_HEALING_FOLDER_ID} (default)`);
    } else {
      console.log(`Path: ./file_types/mp4 (default)`);
    }
    console.log(`Show list: ${list ? 'Yes' : 'No'}`);
    console.log(`Show summary only: ${summary ? 'Yes' : 'No'}`);
    console.log('=======================');
  }
  
  try {
    if (local) {
      // Count local MP4 files
      const localPath = driveId || './file_types/mp4';
      
      if (verbose) {
        console.log(`Searching for MP4 files in local path: ${localPath}`);
      }
      
      if (fs.existsSync(localPath)) {
        const isDirectory = fs.statSync(localPath).isDirectory();
        
        if (isDirectory) {
          // Read all files in the directory
          const files = fs.readdirSync(localPath);
          mp4Files = files.filter(file => file.toLowerCase().endsWith('.mp4'));
          
          if (verbose) {
            console.log(`Found ${mp4Files.length} MP4 files in ${localPath}`);
          }
        } else if (localPath.toLowerCase().endsWith('.mp4')) {
          // Single file
          mp4Files = [path.basename(localPath)];
          
          if (verbose) {
            console.log(`Found 1 MP4 file: ${localPath}`);
          }
        } else {
          if (verbose) {
            console.log(`${localPath} is not a directory or MP4 file`);
          }
        }
      } else {
        console.error(`Path does not exist: ${localPath}`);
      }
    } else {
      // Count MP4 files in Google Drive
      const actualDriveId = driveId || DYNAMIC_HEALING_FOLDER_ID;
      
      if (verbose) {
        console.log(`Searching for MP4 files in Drive folder: ${actualDriveId}`);
      }
      
      // Initialize Supabase and Google Drive services
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Import necessary modules using require instead of dynamic import
      const { GoogleAuthService } = require('../../../packages/shared/services/google-drive/google-auth-service');
      const { GoogleDriveService } = require('../../../packages/shared/services/google-drive/google-drive-service');
      
      // Get a Google Auth instance
      const auth = GoogleAuthService.getInstance();
      
      // Get Google Drive service instance
      const googleDrive = GoogleDriveService.getInstance(auth, supabase);
      
      // Find folder by ID or name
      let folderId = actualDriveId;
      
      // Check if this is a folder name rather than ID
      if (!actualDriveId.match(/^[a-zA-Z0-9_-]{25,}$/)) {
        // Look up folder ID by name
        if (verbose) {
          console.log(`Looking up folder ID for name: ${actualDriveId}`);
        }
        
        const { data: folderData, error } = await supabase
          .from('sources_google')
          .select('drive_id')
          .eq('name', actualDriveId)
          .eq('mime_type', 'application/vnd.google-apps.folder')
          .eq('is_deleted', false)
          .limit(1);
          
        if (error) {
          throw new Error(`Error looking up folder ID: ${error.message}`);
        }
        
        if (folderData && folderData.length > 0) {
          folderId = folderData[0].drive_id;
          if (verbose) {
            console.log(`Found folder ID: ${folderId}`);
          }
        } else {
          throw new Error(`Folder not found: ${actualDriveId}`);
        }
      }
      
      // Check if folder exists in Google Drive
      try {
        const folder = await googleDrive.getFile(folderId);
        if (verbose) {
          console.log(`Found folder in Google Drive: ${folder.name} (${folder.id})`);
        }
      } catch (error) {
        throw new Error(`Folder not found in Google Drive: ${folderId}`);
      }
      
      // Recursively fetch files
      const allFiles: any[] = [];
      let pageToken: string | undefined;
      
      do {
        const result = await googleDrive.listFiles(folderId, {
          pageToken,
          pageSize: 100,
          fields: 'nextPageToken, files(id, name, mimeType, webViewLink, parents, modifiedTime, size, thumbnailLink)'
        });
        
        allFiles.push(...result.files);
        pageToken = result.nextPageToken;
      } while (pageToken);
      
      if (verbose) {
        console.log(`Found ${allFiles.length} total files in folder`);
      }
      
      // Filter for MP4 files
      mp4Files = allFiles
        .filter((file: any) => 
          file.mimeType === 'video/mp4' || 
          file.name.toLowerCase().endsWith('.mp4')
        )
        .map((file: any) => file.name);
        
      if (verbose) {
        console.log(`Found ${mp4Files.length} MP4 files in total`);
      }
    }
    
    // Output results
    if (!summary) {
      console.log(`\nFound ${mp4Files.length} MP4 files${driveId ? ` in ${driveId}` : ''}`);
    }
    
    if (list && mp4Files.length > 0) {
      console.log('\nMP4 files:');
      mp4Files.forEach((file, index) => {
        console.log(`${index + 1}. ${file}`);
      });
    }
    
    return {
      total: mp4Files.length,
      files: mp4Files
    };
  } catch (error: any) {
    console.error(`Error counting MP4 files: ${error.message}`);
    return { total: 0, files: [] };
  }
}

// Main function to run when script is executed directly
async function main() {
  try {
    await countMp4Files({
      driveId,
      list: showList,
      summary: showSummary,
      local: useLocal,
      verbose
    });
    
    process.exit(0);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Only execute if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}