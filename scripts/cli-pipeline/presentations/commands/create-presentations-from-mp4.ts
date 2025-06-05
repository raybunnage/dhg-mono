#!/usr/bin/env ts-node
import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../../../packages/shared/utils/logger';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { getActiveFilterProfile } from '../get-active-filter-profile';

/**
 * Creates presentation records for MP4 files in the sources_google table.
 * 
 * This command:
 * 1. Finds all MP4 files in sources_google that don't have a presentation record
 * 2. Creates a presentation record with basic data from sources_google
 * 3. Links the presentation to the correct expert using high_level_folder info
 * 4. Sets duration_seconds based on file size if possible
 * 
 * Can also fix existing presentations with missing high_level_folder_source_id values
 * using the --fix-missing-folders option
 */
export const createPresentationsFromMp4Command = async (options: {
  dryRun?: boolean;
  limit?: number;
  verbose?: boolean;
  fixMissingFolders?: boolean;
}) => {
  const { dryRun = true, limit = 150, verbose = false, fixMissingFolders = false } = options;
  
  Logger.info(`Starting create-presentations-from-mp4 command ${dryRun ? '(DRY RUN)' : ''}`);
  if (fixMissingFolders) {
    Logger.info(`Will fix presentations with missing high-level folder IDs (limit: ${limit})`);
  } else {
    Logger.info(`Will process up to ${limit} MP4 files`);
  }
  
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // Check for active filter profile
    const activeFilter = await getActiveFilterProfile();
    let rootDriveIdFilter: string | null = null;
    if (activeFilter && activeFilter.rootDriveId) {
      Logger.info(`🔍 Active filter: "${activeFilter.profile.name}"`);
      Logger.info(`📁 Using root_drive_id: ${activeFilter.rootDriveId}\n`);
      rootDriveIdFilter = activeFilter.rootDriveId;
    }
    // Handle fixing missing high_level_folder_source_id if requested
    if (fixMissingFolders) {
      // 3. Get high-level folders information for expert lookup
      let fixFoldersQuery = supabase
        .from('google_sources')
        .select('id, path_depth, main_video_id, name, root_drive_id')
        .eq('path_depth', 0)
        .eq('document_type_id', 'bd903d99-64a1-4297-ba76-1094ab235dac'); // The specific document type for high-level folders
      
      // Apply root_drive_id filter if active
      if (rootDriveIdFilter) {
        fixFoldersQuery = fixFoldersQuery.eq('root_drive_id', rootDriveIdFilter);
      }
      
      const { data: highLevelFolders, error: foldersError } = await fixFoldersQuery;
        
      if (foldersError) {
        Logger.error('Error fetching high-level folders:', foldersError);
        return { success: false, error: foldersError };
      }
      
      if (!highLevelFolders || highLevelFolders.length === 0) {
        Logger.warn('No high-level folders found. Expert linking may not work correctly.');
        return { success: false, error: 'No high-level folders found' };
      } else if (verbose) {
        Logger.info(`Found ${highLevelFolders.length} high-level folders for expert lookup`);
      }
      
      // Create a map of main_video_id to high-level folder source_id
      const folderMap: Record<string, string> = {};
      // Also create a map of folder names for matching by name
      const folderNameMap: Record<string, string> = {};
      
      for (const folder of highLevelFolders) {
        // Map by main_video_id if available
        if (folder.main_video_id) {
          folderMap[folder.main_video_id] = folder.id;
        }
        
        // Map by folder name keywords for fuzzy matching
        const folderName = folder.name.toLowerCase();
        const nameWords = folderName.split(/[-\s.]+/).filter((w: string) => w.length > 3);
        nameWords.forEach((word: string) => {
          folderNameMap[word] = folder.id;
        });
      }
      
      if (verbose) {
        Logger.info(`Created mapping for ${Object.keys(folderMap).length} folders by main_video_id`);
        Logger.info(`Created mapping for ${Object.keys(folderNameMap).length} folder name keywords`);
      }
      
      // Get presentations with missing high_level_folder_source_id
      const { data: presentationsWithoutFolder, error: missingFolderError } = await supabase
        .from('media_presentations')
        .select('id, video_source_id, title')
        .is('high_level_folder_source_id', null)
        .limit(limit);
        
      if (missingFolderError) {
        Logger.error('Error fetching presentations with missing folders:', missingFolderError);
        return { success: false, error: missingFolderError };
      }
      
      const presentationsArray = presentationsWithoutFolder || [];
      if (presentationsArray.length === 0) {
        Logger.info('No presentations found with missing high-level folder IDs.');
        return { success: true, fixed: 0 };
      }
      
      const presentationCount = presentationsArray.length;
      Logger.info(`Found ${presentationCount} presentations with missing high-level folder IDs`);
      
      // For each presentation, get the source and try to find a matching high-level folder
      const updates = [];
      let matchCount = 0;
      
      for (const presentation of presentationsArray) {
        if (!presentation.video_source_id) {
          continue;
        }
        
        // Get the source details
        const { data: source, error: sourceError } = await supabase
          .from('google_sources')
          .select('id, name, path, path_depth, drive_id')
          .eq('id', presentation.video_source_id)
          .single();
          
        if (sourceError || !source) {
          Logger.warn(`Could not find source for presentation ${presentation.id} (${presentation.title})`);
          continue;
        }
        
        // Try to match with a high-level folder
        const sourceId = source?.id;
        const sourceName = source?.name || 'Unknown';
        
        let highLevelFolderId = sourceId ? folderMap[sourceId] : undefined; // First try direct mapping
        let matchMethod = "direct";
        
        // If direct mapping fails, try name-based matching
        if (!highLevelFolderId && sourceName) {
          const fileName = sourceName.toLowerCase();
          const nameWords = fileName.replace(/\.[^.]+$/, '').split(/[-\s.]+/).filter((w: string) => w.length > 3);
          
          for (const word of nameWords) {
            if (folderNameMap[word]) {
              highLevelFolderId = folderNameMap[word];
              matchMethod = `keyword:${word}`;
              break;
            }
          }
        }
        
        if (highLevelFolderId) {
          matchCount++;
          
          if (verbose) {
            Logger.info(`Found match for "${sourceName}" via ${matchMethod}: folder ID ${highLevelFolderId}`);
          }
          
          updates.push({
            id: presentation.id,
            high_level_folder_source_id: highLevelFolderId
          });
        }
      }
      
      Logger.info(`Found matches for ${matchCount} out of ${presentationCount} presentations`);
      
      if (updates.length === 0) {
        Logger.info('No updates to make.');
        return { success: true, fixed: 0 };
      }
      
      // Preview updates
      if (verbose) {
        Logger.info('Updates to make:');
        for (const update of updates.slice(0, 5)) {
          Logger.info(`- Presentation ${update.id}: Set high_level_folder_source_id to ${update.high_level_folder_source_id}`);
        }
        if (updates.length > 5) {
          Logger.info(`... and ${updates.length - 5} more`);
        }
      }
      
      if (dryRun) {
        Logger.info(`DRY RUN: Would update ${updates.length} presentations with high-level folder IDs`);
        return { success: true, wouldFix: updates.length, dryRun: true };
      }
      
      // Apply updates in batches
      let updated = 0;
      let failed = 0;
      const batchSize = 50;
      
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('media_presentations')
          .upsert(batch)
          .select('id');
          
        if (error) {
          Logger.error(`Error updating batch ${i / batchSize + 1}:`, error);
          failed += batch.length;
        } else {
          Logger.info(`Updated batch ${i / batchSize + 1} with ${data?.length || 0} presentations`);
          updated += data?.length || 0;
        }
      }
      
      Logger.info(`Successfully updated ${updated} presentations with high-level folder IDs.`);
      if (failed > 0) {
        Logger.error(`Failed to update ${failed} presentations.`);
      }
      
      return {
        success: true,
        fixed: updated,
        failed
      };
    }
    
    // 1. Get all mp4 files from sources_google that don't have presentations
    Logger.info('Finding MP4 files without presentations...');
    
    // First, get all existing presentations to exclude
    const { data: existingPresentations, error: presError } = await supabase
      .from('media_presentations')
      .select('video_source_id')
      .not('video_source_id', 'is', null);
      
    if (presError) {
      Logger.error('Error fetching existing presentations:', presError);
      return { success: false, error: presError };
    }
    
    // Create a set for faster lookup when checking if a video ID already has a presentation
    const existingVideoIds = new Set(existingPresentations?.map(p => p.video_source_id) || []);
    
    if (verbose) {
      Logger.info(`Found ${existingVideoIds.size} existing presentations with video source IDs`);
    }
    
    // Get all MP4 files and filter out those that already have presentations
    let mp4Query = supabase
      .from('google_sources')
      .select(`
        id, 
        name, 
        mime_type, 
        web_view_link, 
        root_drive_id,
        size,
        path_depth,
        path
      `)
      .like('mime_type', '%mp4%');
    
    // Apply root_drive_id filter if active
    if (rootDriveIdFilter) {
      mp4Query = mp4Query.eq('root_drive_id', rootDriveIdFilter);
    }
    
    const { data: allMp4Files, error: mp4Error } = await mp4Query
      .order('name', { ascending: true })
      .limit(limit * 2); // Get more than needed to account for filtering
      
    if (mp4Error) {
      Logger.error('Error fetching MP4 files:', mp4Error);
      return { success: false, error: mp4Error };
    }
    
    // Additional client-side filtering to ensure no duplicates
    let mp4Files = (allMp4Files || []).filter(file => !existingVideoIds.has(file.id));
    
    // Limit the results to the number requested
    mp4Files = mp4Files.slice(0, limit);
    
    if (!mp4Files || mp4Files.length === 0) {
      Logger.info('No new MP4 files found that need presentations.');
      return { success: true, count: 0 };
    }
    
    Logger.info(`Found ${mp4Files.length} MP4 files without presentations`);
    
    // 2. Find expert documents for the MP4 files to get titles and IDs
    const mp4Ids = mp4Files.map(file => file.id);
    
    const { data: expertDocs, error: docsError } = await supabase
      .from('google_expert_documents')
      .select(`
        id,
        title,
        source_id
      `)
      .in('source_id', mp4Ids);
      
    if (docsError) {
      Logger.error('Error fetching expert documents:', docsError);
    }
    
    // Create maps of source_id to expert document info
    const titleMap: Record<string, string> = {};
    const expertDocIdMap: Record<string, string> = {};
    
    if (expertDocs) {
      for (const doc of expertDocs) {
        if (doc.source_id) {
          if (doc.title) {
            titleMap[doc.source_id] = doc.title;
          }
          expertDocIdMap[doc.source_id] = doc.id;
        }
      }
      
      if (verbose) {
        Logger.info(`Found expert documents for ${Object.keys(expertDocIdMap).length} MP4 files`);
        Logger.info(`Found titles for ${Object.keys(titleMap).length} MP4 files from expert documents`);
      }
    }
    
    // 3. Get high-level folders information for expert lookup
    let foldersQuery = supabase
      .from('google_sources')
      .select('id, path_depth, main_video_id, name, root_drive_id')
      .eq('path_depth', 0)
      .eq('document_type_id', 'bd903d99-64a1-4297-ba76-1094ab235dac'); // The specific document type for high-level folders
    
    // Apply root_drive_id filter if active
    if (rootDriveIdFilter) {
      foldersQuery = foldersQuery.eq('root_drive_id', rootDriveIdFilter);
    }
    
    const { data: highLevelFolders, error: foldersError } = await foldersQuery;
      
    if (foldersError) {
      Logger.error('Error fetching high-level folders:', foldersError);
    }
    
    if (!highLevelFolders || highLevelFolders.length === 0) {
      Logger.warn('No high-level folders found. Expert linking may not work correctly.');
    } else if (verbose) {
      Logger.info(`Found ${highLevelFolders.length} high-level folders for expert lookup`);
    }
    
    // Create a map of main_video_id to high-level folder source_id
    const folderMap: Record<string, string> = {};
    // Also create a map of folder names for matching by name
    const folderNameMap: Record<string, string> = {};
    
    if (highLevelFolders) {
      for (const folder of highLevelFolders) {
        // Map by main_video_id if available
        if (folder.main_video_id) {
          folderMap[folder.main_video_id] = folder.id;
        }
        
        // Map by folder name keywords for fuzzy matching
        const folderName = folder.name.toLowerCase();
        const nameWords = folderName.split(/[-\s.]+/).filter((w: string) => w.length > 3);
        nameWords.forEach((word: string) => {
          folderNameMap[word] = folder.id;
        });
      }
      
      if (verbose) {
        Logger.info(`Created mapping for ${Object.keys(folderMap).length} folders by main_video_id`);
        Logger.info(`Created mapping for ${Object.keys(folderNameMap).length} folder name keywords`);
      }
    }
    
    // 4. Get expert information from google_sources_experts
    // Pre-fetch all google_sources_experts records for the high-level folders
    // Combine both mapping methods to get a complete list of folder IDs
    const highLevelFolderIds = Array.from(new Set([
      ...Object.values(folderMap),
      ...Object.values(folderNameMap)
    ]));
    
    const { data: expertsData, error: expertsError } = await supabase
      .from('google_sources_experts')
      .select(`
        source_id,
        expert_id,
        experts (
          id,
          expert_name,
          full_name
        )
      `)
      .in('source_id', highLevelFolderIds);
      
    if (expertsError) {
      Logger.error('Error fetching experts information:', expertsError);
    }
    
    // Create a map of source_id (folder) to array of experts
    const expertMap: Record<string, Array<{ expertId: string, expertName: string }>> = {};
    if (expertsData) {
      for (const record of expertsData) {
        if (record.source_id && record.expert_id && record.experts) {
          // Create the expert data object
          const expertData = { 
            expertId: record.expert_id,
            expertName: (record.experts as any).expert_name || (record.experts as any).full_name || 'Unknown'
          };
          
          // Initialize array if it doesn't exist for this source
          if (!expertMap[record.source_id]) {
            expertMap[record.source_id] = [];
          }
          
          // Add this expert to the array
          expertMap[record.source_id].push(expertData);
        }
      }
      
      if (verbose) {
        Logger.info(`Found expert mappings for ${Object.keys(expertMap).length} high-level folders`);
        
        // Log any folders with multiple experts
        for (const [folderId, experts] of Object.entries(expertMap)) {
          if (experts.length > 1) {
            Logger.info(`Folder ${folderId} has ${experts.length} experts: ${experts.map(e => e.expertName).join(', ')}`);
          }
        }
      }
    }
    
    // 5. Process each MP4 file and create presentations
    const presentationsToCreate: any[] = [];
    const filesWithoutExperts: string[] = [];
    
    for (const file of mp4Files) {
      // Calculate duration in seconds (very rough estimate based on file size)
      // Assuming an average bitrate of 1000 kbps for MP4 files
      const durationSeconds = file.size ? Math.round(file.size * 8 / 1000000) : null;
      
      // Get title from expert documents or fallback to filename without extension
      const title = titleMap[file.id] || file.name.replace(/\.mp4$/i, '');
      
      // Try multiple methods to find the high-level folder
      let highLevelFolderId = folderMap[file.id]; // First try direct mapping (unlikely for most)
      let matchMethod = "direct";
      
      // If direct mapping fails, try name-based matching
      if (!highLevelFolderId) {
        const fileName = file.name.toLowerCase();
        const nameWords = fileName.replace(/\.[^.]+$/, '').split(/[-\s.]+/).filter((w: string) => w.length > 3);
        
        for (const word of nameWords) {
          if (folderNameMap[word]) {
            highLevelFolderId = folderNameMap[word];
            matchMethod = `keyword:${word}`;
            break;
          }
        }
      }
      
      // Find expert_id using the high-level folder
      let expertId = null;
      let expertName = null;
      
      if (highLevelFolderId && expertMap[highLevelFolderId] && expertMap[highLevelFolderId].length > 0) {
        // Use the first expert in the array
        const firstExpert = expertMap[highLevelFolderId][0];
        expertId = firstExpert.expertId;
        expertName = firstExpert.expertName;
        if (verbose) {
          Logger.info(`Found expert for ${file.name} via ${matchMethod}: ${expertName}`);
        }
      } else {
        filesWithoutExperts.push(file.name);
      }
      
      // Get expert_document_id if available
      const expertDocumentId = expertDocIdMap[file.id] || null;
      
      if (verbose && expertDocumentId) {
        Logger.info(`Found expert document ID ${expertDocumentId} for ${file.name}`);
      } else if (verbose) {
        Logger.info(`No expert document ID found for ${file.name}`);
      }
      
      // Create presentation object
      // Only include fields that are in the presentations table schema
      const presentation = {
        id: uuidv4(),
        title,
        video_source_id: file.id,
        web_view_link: file.web_view_link,
        root_drive_id: file.root_drive_id,
        duration_seconds: durationSeconds,
        // expert_id field doesn't exist in the presentations table schema
        expert_document_id: expertDocumentId,
        high_level_folder_source_id: highLevelFolderId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      presentationsToCreate.push(presentation);
      
      if (verbose) {
        Logger.info(`Prepared presentation for ${file.name}${expertName ? ' with expert ' + expertName : ''}`);
      }
    }
    
    // Report on files without experts
    if (filesWithoutExperts.length > 0) {
      Logger.warn(`Found ${filesWithoutExperts.length} MP4 files without linked experts`);
      if (verbose || filesWithoutExperts.length < 10) {
        Logger.warn('Files without experts: ' + filesWithoutExperts.join(', '));
      }
    }
    
    // 6. Insert presentations (if not dry run)
    if (dryRun) {
      Logger.info(`DRY RUN: Would create ${presentationsToCreate.length} presentation records`);
      
      // Display sample of what would be created
      if (presentationsToCreate.length > 0) {
        Logger.info('Sample of presentations that would be created:');
        const sample = presentationsToCreate.slice(0, 3);
        
        for (const presentation of sample) {
          Logger.info(`- Title: ${presentation.title}`);
          Logger.info(`  Video Source: ${presentation.video_source_id}`);
          Logger.info(`  Expert Document ID: ${presentation.expert_document_id || 'None'}`);
          Logger.info(`  Duration: ${presentation.duration_seconds ? Math.floor(presentation.duration_seconds / 60) + 'm ' + (presentation.duration_seconds % 60) + 's' : 'Unknown'}\n`);
        }
        
        if (presentationsToCreate.length > 3) {
          Logger.info(`... and ${presentationsToCreate.length - 3} more.`);
        }
      }
      
      return {
        success: true,
        count: presentationsToCreate.length,
        dryRun: true
      };
    } else {
      // Actually insert the presentations
      Logger.info(`Creating ${presentationsToCreate.length} presentation records...`);
      
      // Insert in batches of 50 to avoid Supabase limits
      const batchSize = 50;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < presentationsToCreate.length; i += batchSize) {
        const batch = presentationsToCreate.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('media_presentations')
          .insert(batch)
          .select('id');
          
        if (error) {
          Logger.error(`Error inserting batch ${i / batchSize + 1}:`, error);
          errorCount += batch.length;
        } else {
          Logger.info(`Inserted batch ${i / batchSize + 1} with ${data.length} presentations`);
          successCount += data.length;
        }
      }
      
      Logger.info(`Successfully created ${successCount} presentation records.`);
      if (errorCount > 0) {
        Logger.error(`Failed to create ${errorCount} presentation records.`);
      }
      
      return {
        success: true,
        created: successCount,
        failed: errorCount
      };
    }
    
    // Fix missing high-level folder source IDs if requested
    if (fixMissingFolders) {
      // Get presentations with missing high_level_folder_source_id
      const { data: presentationsWithoutFolder, error: missingFolderError } = await supabase
        .from('media_presentations')
        .select('id, video_source_id, title')
        .is('high_level_folder_source_id', null)
        .limit(limit);
        
      if (missingFolderError) {
        Logger.error('Error fetching presentations with missing folders:', missingFolderError);
        return { success: false, error: missingFolderError };
      }
      
      const presentationsArray = presentationsWithoutFolder || [];
      if (presentationsArray.length === 0) {
        Logger.info('No presentations found with missing high-level folder IDs.');
        return { success: true, fixed: 0 };
      }
      
      const presentationCount = presentationsArray.length;
      Logger.info(`Found ${presentationCount} presentations with missing high-level folder IDs`);
      
      // For each presentation, get the source and try to find a matching high-level folder
      const updates = [];
      let matchCount = 0;
      
      for (const presentation of presentationsArray) {
        if (!presentation.video_source_id) {
          continue;
        }
        
        // Get the source details
        const { data: source, error: sourceError } = await supabase
          .from('google_sources')
          .select('id, name, path, path_depth, drive_id')
          .eq('id', presentation.video_source_id)
          .single();
          
        if (sourceError || !source) {
          Logger.warn(`Could not find source for presentation ${presentation.id} (${presentation.title})`);
          continue;
        }
        
        // Try to match with a high-level folder
        const sourceId = source?.id;
        const sourceName = source?.name || 'Unknown';
        
        let highLevelFolderId = sourceId ? folderMap[sourceId] : undefined; // First try direct mapping
        let matchMethod = "direct";
        
        // If direct mapping fails, try name-based matching
        if (!highLevelFolderId && sourceName) {
          const fileName = sourceName.toLowerCase();
          const nameWords = fileName.replace(/\.[^.]+$/, '').split(/[-\\s.]+/).filter((w: string) => w.length > 3);
          
          for (const word of nameWords) {
            if (folderNameMap[word]) {
              highLevelFolderId = folderNameMap[word];
              matchMethod = `keyword:${word}`;
              break;
            }
          }
        }
        
        if (highLevelFolderId) {
          matchCount++;
          
          if (verbose) {
            Logger.info(`Found match for "${sourceName}" via ${matchMethod}: folder ID ${highLevelFolderId}`);
          }
          
          updates.push({
            id: presentation.id,
            high_level_folder_source_id: highLevelFolderId
          });
        }
      }
      
      Logger.info(`Found matches for ${matchCount} out of ${presentationCount} presentations`);
      
      if (updates.length === 0) {
        Logger.info('No updates to make.');
        return { success: true, fixed: 0 };
      }
      
      // Preview updates
      if (verbose) {
        Logger.info('Updates to make:');
        for (const update of updates.slice(0, 5)) {
          Logger.info(`- Presentation ${update.id}: Set high_level_folder_source_id to ${update.high_level_folder_source_id}`);
        }
        if (updates.length > 5) {
          Logger.info(`... and ${updates.length - 5} more`);
        }
      }
      
      if (dryRun) {
        Logger.info(`DRY RUN: Would update ${updates.length} presentations with high-level folder IDs`);
        return { success: true, wouldFix: updates.length, dryRun: true };
      }
      
      // Apply updates in batches
      let updated = 0;
      let failed = 0;
      const batchSize = 50;
      
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('media_presentations')
          .upsert(batch)
          .select('id');
          
        if (error) {
          Logger.error(`Error updating batch ${i / batchSize + 1}:`, error);
          failed += batch.length;
        } else {
          Logger.info(`Updated batch ${i / batchSize + 1} with ${data?.length || 0} presentations`);
          updated += data?.length || 0;
        }
      }
      
      Logger.info(`Successfully updated ${updated} presentations with high-level folder IDs.`);
      if (failed > 0) {
        Logger.error(`Failed to update ${failed} presentations.`);
      }
      
      return {
        success: true,
        fixed: updated,
        failed
      };
    }
    
    return { success: true, message: "No action taken" };
  } catch (error) {
    Logger.error('Error in create-presentations-from-mp4 command:', error);
    return { success: false, error };
  }
};

// Add command to commander program if invoked directly
if (require.main === module) {
  const program = new Command();
  program
    .description('Create presentation records for MP4 files in sources_google')
    .option('--no-dry-run', 'Actually create the presentations instead of just showing what would be created')
    .option('-l, --limit <number>', 'Limit the number of MP4 files to process', '150')
    .option('-v, --verbose', 'Show detailed logs')
    .action(async (options) => {
      await createPresentationsFromMp4Command({
        dryRun: options.dryRun !== false,
        limit: parseInt(options.limit),
        verbose: options.verbose
      });
    });
  
  program.parse(process.argv);
}