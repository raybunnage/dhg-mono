/**
 * Propagate Expert IDs Command
 * 
 * Finds all files and folders under high-level folders (path_depth=0) with document_type_id of bd903d99-64a1-4297-ba76-1094ab235dac
 * and propagates the expert_id from the high-level folder to all child files.
 * 
 * This ensures all files under an expert's folder are properly associated with that expert.
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
// Work around TypeScript error for Winston import
const loggerUtil = Logger;

// Interface for command options
interface PropagateExpertIdsOptions {
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
  folderId?: string;
}

/**
 * Propagate expert_id from high-level folders to all child files and folders
 */
export async function propagateExpertIds(options: PropagateExpertIdsOptions): Promise<void> {
  const { dryRun, verbose, limit = 0, folderId } = options;
  
  if (verbose) {
    loggerUtil.info(`Options: ${JSON.stringify(options, null, 2)}`);
  }
  
  try {
    loggerUtil.info('Propagating expert IDs from high-level folders to all child files...');
    
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Step 1: Find high-level folders with document_type_id = bd903d99-64a1-4297-ba76-1094ab235dac
    // that have experts assigned through the google_sources_experts junction table
    loggerUtil.info('Finding high-level folders with experts assigned...');
    
    let folderQuery = supabase
      .from('google_sources')
      .select(`
        id,
        name,
        path,
        path_depth,
        drive_id,
        document_type_id,
        google_sources_experts!inner(
          id,
          expert_id,
          is_primary,
          experts:expert_id(
            id,
            expert_name,
            full_name
          )
        )
      `)
      .eq('path_depth', 0)
      .eq('document_type_id', 'bd903d99-64a1-4297-ba76-1094ab235dac')
      .eq('is_deleted', false);
    
    // Apply folder ID filter if provided
    if (folderId) {
      folderQuery = folderQuery.eq('id', folderId);
    }
    
    // Apply limit if provided
    if (limit > 0) {
      folderQuery = folderQuery.limit(limit);
    }
    
    const { data: highLevelFolders, error: folderError } = await folderQuery;
    
    if (folderError) {
      throw new Error(`Failed to fetch high-level folders: ${folderError.message}`);
    }
    
    if (!highLevelFolders || highLevelFolders.length === 0) {
      loggerUtil.warn('No high-level folders with experts found.');
      return;
    }
    
    loggerUtil.info(`Found ${highLevelFolders.length} high-level folders with experts assigned`);
    
    // Process each high-level folder
    let totalFilesFound = 0;
    let totalFilesUpdated = 0;
    let totalFilesError = 0;
    
    for (const folder of highLevelFolders) {
      const folderId = folder.id;
      const folderDriveId = folder.drive_id;
      const folderName = folder.name;
      
      // Get expert info - we'll use the primary expert or first one if no primary
      const expertLinks = folder.google_sources_experts;
      const primaryExpertLink = expertLinks.find(link => link.is_primary) || expertLinks[0];
      const expertId = primaryExpertLink.expert_id;
      const expert = primaryExpertLink.experts as any;
      const expertName = expert?.expert_name || expert?.full_name || 'Unknown';
      
      if (verbose) {
        loggerUtil.info(`\nProcessing folder: ${folderName}`);
        loggerUtil.info(`Folder ID: ${folderId}`);
        loggerUtil.info(`Folder Drive ID: ${folderDriveId}`);
        loggerUtil.info(`Expert: ${expertName} (${expertId})`);
      }
      
      // Find all files and folders under this high-level folder recursively
      // using parent_folder_id to trace the hierarchy
      loggerUtil.info(`\nFinding all files under folder "${folderName}"...`);
      
      // First-level children (direct descendants of the high-level folder)
      const { data: firstLevelChildren, error: childrenError } = await supabase
        .from('google_sources')
        .select('id, name, drive_id, path, path_depth, mime_type, is_deleted')
        .eq('parent_folder_id', folderDriveId)
        .eq('is_deleted', false);
      
      if (childrenError) {
        loggerUtil.error(`Error finding children for folder ${folderName}: ${childrenError.message}`);
        continue;
      }
      
      if (!firstLevelChildren || firstLevelChildren.length === 0) {
        loggerUtil.warn(`No child files found under folder "${folderName}"`);
        continue;
      }
      
      if (verbose) {
        loggerUtil.info(`Found ${firstLevelChildren.length} direct child files/folders under "${folderName}"`);
      }
      
      // Now we need to recursively process all descendants
      const allDescendants = [...firstLevelChildren]; // Start with direct children
      const folderQueue = [...firstLevelChildren.filter(item => item.mime_type === 'application/vnd.google-apps.folder')];
      
      // Process folder queue to find all descendants
      while (folderQueue.length > 0) {
        const currentFolder = folderQueue.shift();
        if (!currentFolder) continue;
        
        const { data: nestedChildren, error: nestedError } = await supabase
          .from('google_sources')
          .select('id, name, drive_id, path, path_depth, mime_type, is_deleted')
          .eq('parent_folder_id', currentFolder.drive_id)
          .eq('is_deleted', false);
        
        if (nestedError) {
          loggerUtil.error(`Error finding children for nested folder ${currentFolder.name}: ${nestedError.message}`);
          continue;
        }
        
        if (!nestedChildren || nestedChildren.length === 0) {
          continue;
        }
        
        // Add all nested children to our collection
        allDescendants.push(...nestedChildren);
        
        // Add nested folders to the queue for further processing
        folderQueue.push(...nestedChildren.filter(item => item.mime_type === 'application/vnd.google-apps.folder'));
      }
      
      loggerUtil.info(`Found ${allDescendants.length} total files/folders under "${folderName}"`);
      totalFilesFound += allDescendants.length;
      
      // Show example files to verify we found the correct relationships
      if (verbose) {
        const examples = allDescendants.slice(0, 5);
        loggerUtil.info('\nExample files found:');
        examples.forEach((file, index) => {
          loggerUtil.info(`${index + 1}. ${file.name} (${file.mime_type || 'unknown type'})`);
          loggerUtil.info(`   Path: ${file.path}`);
          loggerUtil.info(`   Depth: ${file.path_depth}`);
        });
      }
      
      // For each file in the hierarchy, check if it has an expert_documents record
      // and update the expert_id if needed
      loggerUtil.info(`\nUpdating expert_documents records for files under "${folderName}"...`);
      
      let folderFilesUpdated = 0;
      let folderFilesError = 0;
      
      for (const file of allDescendants) {
        // Check if there are expert_documents records for this file
        // Note: We don't use maybeSingle() since some files might have multiple records
        const { data: expertDocs, error: expertDocError } = await supabase
          .from('google_expert_documents')
          .select('id, source_id')
          .eq('source_id', file.id);
        
        if (expertDocError) {
          loggerUtil.error(`Error checking expert_documents for file ${file.name}: ${expertDocError.message}`);
          folderFilesError++;
          totalFilesError++;
          continue;
        }
        
        // Log the count if verbose is enabled
        if (verbose && expertDocs && expertDocs.length > 0) {
          loggerUtil.info(`File "${file.name}" has ${expertDocs.length} expert_documents records`);
        }
        
        // Check if the file is already linked to this expert through google_sources_experts
        const { data: existingLink, error: linkError } = await supabase
          .from('google_sources_experts')
          .select('id')
          .eq('source_id', file.id)
          .eq('expert_id', expertId)
          .maybeSingle();
        
        if (linkError) {
          loggerUtil.error(`Error checking google_sources_experts for file ${file.name}: ${linkError.message}`);
          folderFilesError++;
          totalFilesError++;
          continue;
        }
        
        if (existingLink) {
          if (verbose) {
            loggerUtil.info(`File "${file.name}" already has expert link to ${expertName}`);
          }
          continue;
        }
        
        // If not linked yet, create the google_sources_experts entry
        if (dryRun) {
          if (verbose) {
            loggerUtil.info(`[DRY RUN] Would create expert link for file "${file.name}" to expert ${expertName}`);
          }
          folderFilesUpdated++;
          totalFilesUpdated++;
        } else {
          // Create the link in google_sources_experts
          const { error: insertError } = await supabase
            .from('google_sources_experts')
            .insert({
              source_id: file.id,
              expert_id: expertId,
              is_primary: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (insertError) {
            loggerUtil.error(`Error creating expert link for file ${file.name}: ${insertError.message}`);
            folderFilesError++;
            totalFilesError++;
          } else {
            if (verbose) {
              loggerUtil.info(`Created expert link for file "${file.name}" to expert ${expertName}`);
            }
            folderFilesUpdated++;
            totalFilesUpdated++;
          }
        }
      }
      
      loggerUtil.info(`Processed ${allDescendants.length} files under "${folderName}"`);
      loggerUtil.info(`Updated ${folderFilesUpdated} files, ${folderFilesError} errors`);
    }
    
    // Summary
    loggerUtil.info(`\nSummary:`);
    loggerUtil.info(`Total high-level folders processed: ${highLevelFolders.length}`);
    loggerUtil.info(`Total files found: ${totalFilesFound}`);
    
    if (dryRun) {
      loggerUtil.info(`[DRY RUN] Would update ${totalFilesUpdated} files`);
    } else {
      loggerUtil.info(`Successfully updated ${totalFilesUpdated} files`);
    }
    
    loggerUtil.info(`Errors: ${totalFilesError}`);
    
  } catch (error: any) {
    loggerUtil.error(`Error propagating expert IDs: ${error?.message || error}`);
  }
}