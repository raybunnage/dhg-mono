#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../../packages/shared/utils/logger';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

// Define interfaces for our data
interface DuplicateFolderInfo {
  name: string;
  entries: FolderEntry[];
}

interface FolderEntry {
  id: string;
  folder_id: string;
  created_at: string;
  presentation_title: string | null;
  video_filename: string | null;
  video_file_id: string | null;
  presentation_id: string | null;
}

export const findDuplicateFolderNamesCommand = async (options: {
  limit?: number;
  pathDepth?: number;
  outputFile?: string;
  verbose?: boolean;
}): Promise<{
  success: boolean;
  message: string;
  duplicates?: DuplicateFolderInfo[];
}> => {
  try {
    const limit = options.limit || 100;
    const pathDepth = options.pathDepth !== undefined ? options.pathDepth : 0;
    const verbose = options.verbose || false;

    if (verbose) {
      Logger.info(`Finding duplicate folder names with path_depth = ${pathDepth}...`);
    }

    // Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();

    // First, get all folder names at the specified path depth
    const { data: allFolders, error: allFoldersError } = await supabase
      .from('sources_google')
      .select('name')
      .eq('path_depth', pathDepth)
      .eq('is_deleted', false)
      .not('name', 'is', null)
      .neq('name', '')
      .order('name');
    
    if (allFoldersError) {
      return {
        success: false,
        message: `Error finding folder names: ${allFoldersError.message}`,
      };
    }
    
    // Find duplicates by counting occurrences
    const folderCounts: Record<string, number> = {};
    for (const folder of allFolders || []) {
      if (folder.name) {
        folderCounts[folder.name] = (folderCounts[folder.name] || 0) + 1;
      }
    }
    
    // Filter to only duplicate names
    const duplicateNames = Object.entries(folderCounts)
      .filter(([_, count]) => count > 1)
      .map(([name, _]) => name)
      .slice(0, limit);
    
    // Create a result array similar to what we'd get from the database
    const foldersData = duplicateNames.map(name => ({ name }));

    if (!foldersData || foldersData.length === 0) {
      return {
        success: true,
        message: 'No duplicate folder names found at the specified path depth.',
        duplicates: [],
      };
    }

    // For each duplicate folder name, get detailed information
    const duplicateFolders: DuplicateFolderInfo[] = [];

    for (const item of foldersData) {
      const folderName = item.name;
      
      // Get all folders with this name
      const { data: folderInfo, error: folderInfoError } = await supabase
        .from('sources_google')
        .select('id, drive_id, created_at, name')
        .eq('name', folderName)
        .eq('path_depth', pathDepth)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });
      
      if (folderInfoError) {
        Logger.error(`Error fetching details for folder "${folderName}": ${folderInfoError.message}`);
        continue;
      }

      if (!folderInfo || folderInfo.length < 2) {
        continue; // Skip if we don't have at least 2 folders with this name
      }

      // For each folder, get presentation details
      const entries: FolderEntry[] = [];
      
      for (const folder of folderInfo) {
        // Get presentation associated with this folder
        const { data: presentations, error: presentationsError } = await supabase
          .from('presentations')
          .select('id, title, video_source_id')
          .eq('high_level_folder_source_id', folder.id)
          .maybeSingle();
        
        if (presentationsError) {
          Logger.error(`Error fetching presentation for folder "${folderName}": ${presentationsError.message}`);
        }

        let videoFilename = null;
        let videoFileId = null;

        // If we have a presentation with a video, get the video details
        if (presentations && presentations.video_source_id) {
          const { data: videoSource, error: videoError } = await supabase
            .from('sources_google')
            .select('id, name')
            .eq('id', presentations.video_source_id)
            .maybeSingle();
          
          if (!videoError && videoSource) {
            videoFilename = videoSource.name;
            videoFileId = videoSource.id;
          }
        }

        // Add this folder entry
        entries.push({
          id: folder.id,
          folder_id: folder.drive_id,
          created_at: folder.created_at,
          presentation_title: presentations ? presentations.title : null,
          presentation_id: presentations ? presentations.id : null,
          video_filename: videoFilename,
          video_file_id: videoFileId
        });
      }

      if (entries.length > 1) {
        duplicateFolders.push({
          name: folderName,
          entries
        });
      }
    }

    return {
      success: true,
      message: `Found ${duplicateFolders.length} folder names with duplicates.`,
      duplicates: duplicateFolders,
    };

  } catch (error) {
    Logger.error('Error in findDuplicateFolderNamesCommand:', error);
    return {
      success: false,
      message: `Error finding duplicate folder names: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// Create the command for use in the CLI
const command = new Command('find-duplicate-folder-names')
  .description('Find folders with duplicate names and list their presentations and videos')
  .option('-d, --path-depth <number>', 'Folder path depth to check (default: 0)', '0')
  .option('-l, --limit <number>', 'Limit the number of duplicate folder names to process', '100')
  .option('-o, --output-file <path>', 'Output file path for the results')
  .option('-v, --verbose', 'Show detailed logs during processing', false)
  .action(async (options: any) => {
    try {
      Logger.info('Finding folders with duplicate names...');
      
      // Parse path depth from options (default to 0)
      const pathDepth = parseInt(options.pathDepth, 10);
      
      // Run the command
      const result = await findDuplicateFolderNamesCommand({
        pathDepth,
        limit: parseInt(options.limit, 10),
        outputFile: options.outputFile,
        verbose: options.verbose
      });
      
      if (!result.success) {
        Logger.error(result.message);
        process.exit(1);
      }
      
      const duplicates = result.duplicates || [];
      
      if (duplicates.length === 0) {
        Logger.info('No duplicate folder names found.');
        return;
      }
      
      // Display results in the terminal
      console.log('\nDUPLICATE FOLDER NAMES:');
      console.log('======================\n');
      
      for (const folder of duplicates) {
        console.log(`\nFolder Name: "${folder.name}" (${folder.entries.length} instances)`);
        console.log('-'.repeat(80));
        
        console.log('| ID | Created At | Presentation Title | Video File | Video ID | Presentation ID |');
        console.log('|' + '-'.repeat(3) + '|' + '-'.repeat(12) + '|' + '-'.repeat(20) + '|' + '-'.repeat(20) + '|' + '-'.repeat(10) + '|' + '-'.repeat(16) + '|');
        
        for (const entry of folder.entries) {
          const createdAt = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'N/A';
          const presentationTitle = entry.presentation_title || 'No presentation';
          const videoFilename = entry.video_filename || 'No video';
          const videoId = entry.video_file_id || 'N/A';
          const presentationId = entry.presentation_id || 'N/A';
          
          // Truncate long fields for display
          const titleDisplay = presentationTitle.length > 18 ? presentationTitle.substring(0, 15) + '...' : presentationTitle.padEnd(18);
          const videoDisplay = videoFilename.length > 18 ? videoFilename.substring(0, 15) + '...' : videoFilename.padEnd(18);
          const idShort = entry.id.substring(0, 8);
          const videoIdDisplay = typeof videoId === 'string' ? videoId.substring(0, 8) : 'N/A';
          const presentationIdDisplay = typeof presentationId === 'string' ? presentationId.substring(0, 14) : 'N/A';
          
          console.log(`| ${idShort} | ${createdAt} | ${titleDisplay} | ${videoDisplay} | ${videoIdDisplay} | ${presentationIdDisplay} |`);
        }
      }
      
      // Write to output file if requested
      if (options.outputFile) {
        try {
          const fs = require('fs');
          
          let markdownOutput = '# Duplicate Folder Names Report\n\n';
          markdownOutput += `Generated: ${new Date().toLocaleString()}\n\n`;
          markdownOutput += `Found ${duplicates.length} folder names with duplicates at path_depth = ${pathDepth}.\n\n`;
          
          for (const folder of duplicates) {
            markdownOutput += `## Folder: "${folder.name}"\n\n`;
            markdownOutput += `${folder.entries.length} instances found\n\n`;
            
            markdownOutput += '| ID | Created At | Presentation Title | Video File | Video ID | Presentation ID |\n';
            markdownOutput += '|---|------------|-------------------|------------|---------|----------------|\n';
            
            for (const entry of folder.entries) {
              const createdAt = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'N/A';
              const presentationTitle = entry.presentation_title || 'No presentation';
              const videoFilename = entry.video_filename || 'No video';
              const videoId = entry.video_file_id || 'N/A';
              const presentationId = entry.presentation_id || 'N/A';
              
              markdownOutput += `| ${entry.id} | ${createdAt} | ${presentationTitle} | ${videoFilename} | ${videoId} | ${presentationId} |\n`;
            }
            
            markdownOutput += '\n';
          }
          
          fs.writeFileSync(options.outputFile, markdownOutput);
          Logger.info(`Report written to ${options.outputFile}`);
        } catch (writeError) {
          Logger.error('Error writing to output file:', writeError);
        }
      }
      
      Logger.info(`Found ${duplicates.length} folder names with duplicates.`);
      Logger.info('Review the output to identify any issues with presentations and videos.');
      
    } catch (error) {
      Logger.error('Error finding duplicate folder names:', error);
      process.exit(1);
    }
  });

export default command;

// If this script is run directly, execute the command
if (require.main === module) {
  command.parse(process.argv);
}