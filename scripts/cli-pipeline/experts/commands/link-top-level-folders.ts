/**
 * Link Top Level Folders Command
 * 
 * Lists top-level folders (path_depth = 0) that have an associated main_video_id
 * and allows manual assignment of experts to these folders.
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

// Interface for command options
interface LinkTopLevelFoldersOptions {
  dryRun: boolean;
  isPrimary: boolean;
  verbose: boolean;
  limit?: number;
  skipAssigned?: boolean;
}

/**
 * List top-level folders to help with manual expert assignment
 */
export async function linkTopLevelFolders(options: LinkTopLevelFoldersOptions): Promise<void> {
  const { dryRun, isPrimary, verbose, limit = 50, skipAssigned = true } = options;
  
  if (verbose) {
    Logger.info(`Options: ${JSON.stringify(options, null, 2)}`);
  }
  
  try {
    Logger.info('Listing top-level folders for expert assignment...');
    
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Step 1: Find all experts to display available options
    Logger.info('Fetching available experts...');
    
    const { data: experts, error: expertsError } = await supabase
      .from('experts')
      .select('id, expert_name, full_name, expertise_area')
      .order('expert_name');
    
    if (expertsError) {
      throw new Error(`Failed to fetch experts: ${expertsError.message}`);
    }
    
    if (!experts || experts.length === 0) {
      Logger.warn('No experts found in the database. Please add experts first.');
      return;
    }
    
    Logger.info(`Found ${experts.length} experts in the system`);
    if (verbose) {
      Logger.info('Available experts:');
      experts.forEach((expert, index) => {
        Logger.info(`  ${index + 1}. ${expert.expert_name || expert.full_name} (${expert.id}) - ${expert.expertise_area || 'No expertise area'}`);
      });
    }
    
    // Step 2: Find all top-level folders with non-null main_video_id
    Logger.info('Finding top-level folders with main video IDs...');
    
    let query = supabase
      .from('sources_google')
      .select(`
        id, 
        name, 
        path, 
        main_video_id,
        is_deleted
      `)
      .eq('path_depth', 0)
      .eq('is_deleted', false)
      .not('main_video_id', 'is', null);
    
    // Apply limit
    query = query.limit(limit);
    
    const { data: folders, error: foldersError } = await query;
    
    if (foldersError) {
      throw new Error(`Failed to fetch folders: ${foldersError.message}`);
    }
    
    if (!folders || folders.length === 0) {
      Logger.warn('No top-level folders with main video IDs found.');
      return;
    }
    
    Logger.info(`Found ${folders.length} top-level folders with main video IDs`);
    
    // Step 3: For each folder, check if it already has expert associations
    let needsAssignmentCount = 0;
    let alreadyAssignedCount = 0;
    
    Logger.info('\nFolders for expert assignment:');
    Logger.info('============================================================');
    
    for (const folder of folders) {
      // Check if this folder already has an expert association
      const { data: existingLinks, error: linksError } = await supabase
        .from('sources_google_experts')
        .select(`
          id,
          expert_id,
          is_primary,
          experts (
            expert_name,
            full_name
          )
        `)
        .eq('source_id', folder.id);
      
      if (linksError) {
        Logger.error(`Failed to check existing expert links: ${linksError.message}`);
        continue;
      }
      
      const hasExistingLinks = existingLinks && existingLinks.length > 0;
      
      if (hasExistingLinks) {
        alreadyAssignedCount++;
        
        if (skipAssigned) {
          continue;
        }
      } else {
        needsAssignmentCount++;
      }
      
      // Display folder information for manual assignment
      Logger.info(`\nFolder: ${folder.name}`);
      Logger.info(`ID: ${folder.id}`);
      Logger.info(`Path: ${folder.path}`);
      Logger.info(`Main Video ID: ${folder.main_video_id}`);
      
      if (hasExistingLinks) {
        Logger.info('Existing expert assignments:');
        existingLinks.forEach((link, index) => {
          const expertName = link.experts?.expert_name || link.experts?.full_name || 'Unknown';
          Logger.info(`  ${index + 1}. ${expertName} (Primary: ${link.is_primary})`);
        });
      } else {
        Logger.info('No experts assigned yet');
      }
      
      // Example command to assign expert
      const exampleExpert = experts[0];
      const exampleName = exampleExpert.expert_name || exampleExpert.full_name;
      
      Logger.info('\nTo assign an expert to this folder, use:');
      Logger.info(`./scripts/cli-pipeline/experts/experts-cli.sh assign-expert \\`);
      Logger.info(`  --folder-id ${folder.id} \\`);
      Logger.info(`  --expert-id <EXPERT_ID> \\`);
      Logger.info(`  --primary ${isPrimary}`);
      
      Logger.info('\nExample:');
      Logger.info(`./scripts/cli-pipeline/experts/experts-cli.sh assign-expert \\`);
      Logger.info(`  --folder-id ${folder.id} \\`);
      Logger.info(`  --expert-id ${exampleExpert.id} \\`);
      Logger.info(`  --primary true`);
      
      Logger.info('============================================================');
    }
    
    // Summary
    Logger.info(`\nSummary:`);
    Logger.info(`Total folders examined: ${folders.length}`);
    Logger.info(`Folders with experts already assigned: ${alreadyAssignedCount}`);
    Logger.info(`Folders needing expert assignment: ${needsAssignmentCount}`);
    
    if (limit < 50) {
      Logger.info(`\nShowing only ${limit} folders. Use --limit option to see more.`);
    }
    
    if (skipAssigned) {
      Logger.info(`Use --skip-assigned=false to also show folders that already have experts assigned.`);
    }
    
    Logger.info(`\nTo assign experts to these folders, use the assign-expert command.`);
    
  } catch (error) {
    Logger.error(`Error listing top-level folders: ${error.message}`);
  }
}