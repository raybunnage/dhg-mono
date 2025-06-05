# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Report Main Video IDs
 * 
 * This script reports on main_video_id values for folders directly beneath
 * the root folder of Dynamic Healing Discussion Group. For each folder (most with dates
 * in their names), it prints out the filename of the video that is the main_video_id
 * if one has been identified.
 * 
 * Usage:
 *   ts-node report-main-video-ids.ts [options]
 * 
 * Options:
 *   --folder-id <id>    Specify a folder ID (default: Dynamic Healing Discussion Group)
 *   --verbose           Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger, LogLevel } from '../../../packages/shared/utils/logger';

// Load environment variables
const envFiles = ['.env', '.env.development', '.env.local'];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading environment variables from ${filePath}`);
    dotenv.config({ path: filePath });
  }
}

// Process command line arguments
const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose');

if (isVerbose) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Get folder ID from command line or use default
const folderIdIndex = args.indexOf('--folder-id');
let folderId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'; // Default: Dynamic Healing Discussion Group
if (folderIdIndex !== -1 && args[folderIdIndex + 1]) {
  folderId = args[folderIdIndex + 1];
}

// Set default output file in docs/script-reports
const outputIndex = args.indexOf('--output');
let outputFile = '/Users/raybunnage/Documents/github/dhg-mono/docs/script-reports/main-video-ids-report.md'; // Default output location
if (outputIndex !== -1 && args[outputIndex + 1]) {
  outputFile = args[outputIndex + 1];
}

// Limit number of folders to process
const limitIndex = args.indexOf('--limit');
let folderLimit = 0; // Default: process all folders
if (limitIndex !== -1 && args[limitIndex + 1]) {
  folderLimit = parseInt(args[limitIndex + 1], 10);
}

/**
 * Main function to report on main_video_id values
 */
export async function reportMainVideoIds(
  folderIdParam?: string,  
  verboseParam?: boolean,
  outputFileParam?: string,
  limitParam?: number
): Promise<void> {
  // Override the global parameters if provided
  const actualFolderId = folderIdParam || folderId;
  const actualOutputFile = outputFileParam || outputFile;
  const actualLimit = limitParam || folderLimit;
  
  if (verboseParam) {
    Logger.setLevel(LogLevel.DEBUG);
  }
  
  console.log('=== Report on Main Video IDs ===');
  console.log(`Root Folder ID: ${actualFolderId}`);
  console.log('===============================');

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Verify the root folder exists
    const { data: rootFolder, error: rootFolderError } = await supabase
      .from('google_sources')
      .select('id, name, path')
      .eq('drive_id', actualFolderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .single();
    
    if (rootFolderError) {
      Logger.error(`Error fetching root folder info: ${rootFolderError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Root folder: "${rootFolder.name}" (${actualFolderId})`);
    
    // Step 2: Find all subfolders directly under the root folder
    const { data: subFolders, error: subFoldersError } = await supabase
      .from('google_sources')
      .select('id, name, path, drive_id, parent_folder_id')
      .eq('parent_folder_id', actualFolderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('deleted', false)
      .order('name');
    
    if (subFoldersError) {
      Logger.error(`Error fetching subfolders: ${subFoldersError.message}`);
      process.exit(1);
    }
    
    if (!subFolders || subFolders.length === 0) {
      Logger.info('No subfolders found under the root folder.');
      return;
    }
    
    Logger.info(`Found ${subFolders.length} subfolders under the root folder.\n`);
    
    // Create a markdown table header for the report (video filename first)
    console.log('| Main Video Filename | Folder Name |');
    console.log('|---------------------|-------------|');
    
    // Apply folder limit if specified
    const foldersToProcess = actualLimit > 0 ? subFolders.slice(0, actualLimit) : subFolders;
    Logger.info(`Processing ${foldersToProcess.length} out of ${subFolders.length} folders${actualLimit > 0 ? ' (limited by --limit)' : ''}`);
    
    // Step 3: For each subfolder, check if there's a main_video_id
    for (const folder of foldersToProcess) {
      Logger.debug(`Processing folder: ${folder.name}`);
      
      // Find presentations that have this folder's path in their folder_path
      const { data: presentations, error: presentationsError } = await supabase
        .from('presentations')
        .select(`
          id, 
          title,
          main_video_id,
          folder_path,
          sources_google!presentations_main_video_id_fkey (id, name)
        `)
        .like('folder_path', `%${folder.name}%`)
        .not('main_video_id', 'is', null);
      
      if (presentationsError) {
        Logger.error(`Error fetching presentations for folder ${folder.name}: ${presentationsError.message}`);
        continue;
      }
      
      // Format and output the results
      if (presentations && presentations.length > 0) {
        // Has presentation with main_video_id
        for (const presentation of presentations) {
          // We need to safely access the nested sources_google object
          let videoName = 'Unknown';
          
          // Handle the Supabase nested join result
          if (presentation.sources_google && typeof presentation.sources_google === 'object') {
            // It might be an object with a name property
            if ('name' in presentation.sources_google) {
              videoName = (presentation.sources_google as { name: string }).name;
            }
          }
          
          console.log(`| ${videoName} | ${folder.name} |`);
        }
      } else {
        // No presentation with main_video_id found
        // Check if any MP4 files exist in this folder (direct children)
        const { data: mp4Files, error: mp4Error } = await supabase
          .from('google_sources')
          .select('id, name')
          .eq('parent_folder_id', folder.id)
          .eq('mime_type', 'video/mp4')
          .eq('deleted', false);
        
        if (mp4Error) {
          Logger.error(`Error fetching MP4 files for folder ${folder.name}: ${mp4Error.message}`);
          continue;
        }
        
        if (mp4Files && mp4Files.length > 0) {
          // Has MP4 files but no main_video_id is set - show the first MP4 file
          console.log(`| ${mp4Files[0].name} (not set as main) | ${folder.name} |`);
        } else {
          // No direct MP4 files found - recursively search subfolders
          Logger.debug(`No direct MP4 files in ${folder.name}, searching subfolders...`);
          
          // Get all subfolders
          const { data: subfolders, error: subfoldersError } = await supabase
            .from('google_sources')
            .select('id, name')
            .eq('parent_folder_id', folder.id)
            .eq('mime_type', 'application/vnd.google-apps.folder')
            .eq('deleted', false);
            
          if (subfoldersError) {
            Logger.error(`Error fetching subfolders for ${folder.name}: ${subfoldersError.message}`);
            console.log(`| No MP4 files | ${folder.name} |`);
            continue;
          }
          
          // Check each subfolder for MP4 files
          let foundMp4 = false;
          let mp4FileName = '';
          let mp4Path = '';
          
          if (subfolders && subfolders.length > 0) {
            for (const subfolder of subfolders) {
              // Common media folder names to prioritize
              const isPriorityFolder = subfolder.name.toLowerCase().includes('presentation') || 
                                      subfolder.name.toLowerCase().includes('video') || 
                                      subfolder.name.toLowerCase().includes('media');
              
              // Search for MP4 files in this subfolder
              const { data: subfolderMp4s, error: subfolderMp4Error } = await supabase
                .from('google_sources')
                .select('id, name, path')
                .eq('parent_folder_id', subfolder.id)
                .eq('mime_type', 'video/mp4')
                .eq('deleted', false);
                
              if (subfolderMp4Error) {
                Logger.error(`Error fetching MP4s from subfolder ${subfolder.name}: ${subfolderMp4Error.message}`);
                continue;
              }
              
              if (subfolderMp4s && subfolderMp4s.length > 0) {
                // If we already found an MP4 in a priority folder, don't override it
                if (!foundMp4 || isPriorityFolder) {
                  foundMp4 = true;
                  mp4FileName = subfolderMp4s[0].name;
                  mp4Path = `${subfolder.name}/${mp4FileName}`;
                  
                  // If this is a priority folder, we can break early
                  if (isPriorityFolder) {
                    break;
                  }
                }
              }
            }
          }
          
          if (foundMp4) {
            console.log(`| ${mp4FileName} (in subfolder) | ${folder.name} |`);
            Logger.debug(`Found MP4 in subfolder: ${mp4Path}`);
          } else {
            // No MP4 files found in any subfolder
            console.log(`| No MP4 files | ${folder.name} |`);
          }
        }
      }
    }
    
    // Add a simple summary at the end
    console.log('\n_Summary:_ Found ' + subFolders.length + ' folders under ' + rootFolder.name);
    
    // Write to output file if specified
    if (actualOutputFile) {
      try {
        // Create the output content
        let fileContent = '# Main Video IDs Report\n\n';
        fileContent += `Report generated on ${new Date().toISOString()}\n\n`;
        fileContent += '| Main Video Filename | Folder Name |\n';
        fileContent += '|---------------------|-------------|\n';
        
        // Add each folder and its video
        for (const folder of subFolders) {
          // Check if there's a presentation with main_video_id
          const { data: presentations, error: presentationsError } = await supabase
            .from('presentations')
            .select(`
              id, 
              title,
              main_video_id,
              sources_google!presentations_main_video_id_fkey (id, name)
            `)
            .like('folder_path', `%${folder.name}%`)
            .not('main_video_id', 'is', null);
          
          if (presentationsError) {
            continue;
          }
          
          if (presentations && presentations.length > 0) {
            // Has presentation with main_video_id
            for (const presentation of presentations) {
              // Get video name
              let videoName = 'Unknown';
              if (presentation.sources_google && typeof presentation.sources_google === 'object') {
                if ('name' in presentation.sources_google) {
                  videoName = (presentation.sources_google as { name: string }).name;
                }
              }
              
              fileContent += `| ${videoName} | ${folder.name} |\n`;
            }
          } else {
            // Check if any MP4 files exist in this folder (direct children)
            const { data: mp4Files, error: mp4Error } = await supabase
              .from('google_sources')
              .select('id, name')
              .eq('parent_folder_id', folder.id)
              .eq('mime_type', 'video/mp4')
              .eq('deleted', false);
            
            if (mp4Error) {
              continue;
            }
            
            if (mp4Files && mp4Files.length > 0) {
              // Has MP4 files but no main_video_id is set - show the first MP4 file
              fileContent += `| ${mp4Files[0].name} (not set as main) | ${folder.name} |\n`;
            } else {
              // No direct MP4 files found - recursively search subfolders
              Logger.debug(`No direct MP4 files in ${folder.name}, searching subfolders for report file...`);
              
              // Get all subfolders
              const { data: subfolders, error: subfoldersError } = await supabase
                .from('google_sources')
                .select('id, name')
                .eq('parent_folder_id', folder.id)
                .eq('mime_type', 'application/vnd.google-apps.folder')
                .eq('deleted', false);
                
              if (subfoldersError) {
                Logger.error(`Error fetching subfolders for ${folder.name}: ${subfoldersError.message}`);
                fileContent += `| No MP4 files | ${folder.name} |\n`;
                continue;
              }
              
              // Check each subfolder for MP4 files
              let foundMp4 = false;
              let mp4FileName = '';
              
              if (subfolders && subfolders.length > 0) {
                for (const subfolder of subfolders) {
                  // Common media folder names to prioritize
                  const isPriorityFolder = subfolder.name.toLowerCase().includes('presentation') || 
                                          subfolder.name.toLowerCase().includes('video') || 
                                          subfolder.name.toLowerCase().includes('media');
                  
                  // Search for MP4 files in this subfolder
                  const { data: subfolderMp4s, error: subfolderMp4Error } = await supabase
                    .from('google_sources')
                    .select('id, name')
                    .eq('parent_folder_id', subfolder.id)
                    .eq('mime_type', 'video/mp4')
                    .eq('deleted', false);
                    
                  if (subfolderMp4Error) {
                    Logger.error(`Error fetching MP4s from subfolder ${subfolder.name}: ${subfolderMp4Error.message}`);
                    continue;
                  }
                  
                  if (subfolderMp4s && subfolderMp4s.length > 0) {
                    // If we already found an MP4 in a priority folder, don't override it
                    if (!foundMp4 || isPriorityFolder) {
                      foundMp4 = true;
                      mp4FileName = subfolderMp4s[0].name;
                      
                      // If this is a priority folder, we can break early
                      if (isPriorityFolder) {
                        break;
                      }
                    }
                  }
                }
              }
              
              if (foundMp4) {
                fileContent += `| ${mp4FileName} (in subfolder) | ${folder.name} |\n`;
              } else {
                // No MP4 files found in any subfolder
                fileContent += `| No MP4 files | ${folder.name} |\n`;
              }
            }
          }
        }
        
        // Add summary
        fileContent += `\n_Summary:_ Found ${subFolders.length} folders under ${rootFolder.name}\n`;
        
        // Write to file
        fs.writeFileSync(actualOutputFile, fileContent);
        Logger.info(`Report written to ${actualOutputFile}`);
      } catch (writeError: any) {
        Logger.error(`Error writing to output file: ${writeError.message}`);
      }
    }
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function if run directly
if (require.main === module) {
  reportMainVideoIds().catch(error => {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}