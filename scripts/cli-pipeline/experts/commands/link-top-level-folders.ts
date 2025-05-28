/**
 * Link Top Level Folders Command
 * 
 * Lists top-level folders (path_depth = 0) that have an associated main_video_id
 * and allows manual assignment of experts to these folders.
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
// Work around TypeScript error for Winston import
const loggerUtil = Logger;

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
    loggerUtil.info(`Options: ${JSON.stringify(options, null, 2)}`);
  }
  
  try {
    loggerUtil.info('Listing top-level folders for expert assignment...');
    
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Step 1: Find all experts to display available options
    loggerUtil.info('Fetching available experts...');
    
    const { data: experts, error: expertsError } = await supabase
      .from('expert_profiles')
      .select('id, expert_name, full_name, expertise_area')
      .order('expert_name');
    
    if (expertsError) {
      throw new Error(`Failed to fetch experts: ${expertsError.message}`);
    }
    
    if (!experts || experts.length === 0) {
      loggerUtil.warn('No experts found in the database. Please add experts first.');
      return;
    }
    
    loggerUtil.info(`Found ${experts.length} experts in the system`);
    if (verbose) {
      loggerUtil.info('Available experts:');
      experts.forEach((expert, index) => {
        loggerUtil.info(`  ${index + 1}. ${expert.expert_name || expert.full_name} (${expert.id}) - ${expert.expertise_area || 'No expertise area'}`);
      });
    }
    
    // Step 2: Find all top-level folders with non-null main_video_id
    loggerUtil.info('Finding top-level folders with main video IDs...');
    
    let query = supabase
      .from('google_sources')
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
      loggerUtil.warn('No top-level folders with main video IDs found.');
      return;
    }
    
    loggerUtil.info(`Found ${folders.length} top-level folders with main video IDs`);
    
    // Step 3: For each folder, check if it already has expert associations
    let needsAssignmentCount = 0;
    let alreadyAssignedCount = 0;
    
    loggerUtil.info('\nFolders for expert assignment:');
    loggerUtil.info('============================================================');
    
    for (const folder of folders) {
      // Check if this folder already has an expert association
      const { data: existingLinks, error: linksError } = await supabase
        .from('google_sources_experts')
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
        loggerUtil.error(`Failed to check existing expert links: ${linksError.message}`);
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
      loggerUtil.info(`\nFolder: ${folder.name}`);
      loggerUtil.info(`ID: ${folder.id}`);
      loggerUtil.info(`Path: ${folder.path}`);
      loggerUtil.info(`Main Video ID: ${folder.main_video_id}`);
      
      if (hasExistingLinks) {
        loggerUtil.info('Existing expert assignments:');
        existingLinks.forEach((link, index) => {
          const expert = link.experts as any;
          const expertName = expert?.expert_name || expert?.full_name || 'Unknown';
          loggerUtil.info(`  ${index + 1}. ${expertName} (Primary: ${link.is_primary})`);
        });
      } else {
        loggerUtil.info('No experts assigned yet');
      }
      
      // Example command to assign expert
      const exampleExpert = experts[0];
      const exampleName = exampleExpert.expert_name || exampleExpert.full_name;
      
      loggerUtil.info('\nTo assign an expert to this folder, use:');
      loggerUtil.info(`./scripts/cli-pipeline/experts/experts-cli.sh assign-expert \\`);
      loggerUtil.info(`  --folder-id ${folder.id} \\`);
      loggerUtil.info(`  --expert-id <EXPERT_ID> \\`);
      loggerUtil.info(`  --primary ${isPrimary}`);
      
      loggerUtil.info('\nExample:');
      loggerUtil.info(`./scripts/cli-pipeline/experts/experts-cli.sh assign-expert \\`);
      loggerUtil.info(`  --folder-id ${folder.id} \\`);
      loggerUtil.info(`  --expert-id ${exampleExpert.id} \\`);
      loggerUtil.info(`  --primary true`);
      
      loggerUtil.info('============================================================');
    }
    
    // Summary
    loggerUtil.info(`\nSummary:`);
    loggerUtil.info(`Total folders examined: ${folders.length}`);
    loggerUtil.info(`Folders with experts already assigned: ${alreadyAssignedCount}`);
    loggerUtil.info(`Folders needing expert assignment: ${needsAssignmentCount}`);
    
    if (limit < 50) {
      loggerUtil.info(`\nShowing only ${limit} folders. Use --limit option to see more.`);
    }
    
    if (skipAssigned) {
      loggerUtil.info(`Use --skip-assigned=false to also show folders that already have experts assigned.`);
    }
    
    loggerUtil.info(`\nTo assign experts to these folders, use the assign-expert command.`);
    
  } catch (error: any) {
    loggerUtil.error(`Error listing top-level folders: ${error?.message || error}`);
  }
}