/**
 * Assign Expert Command
 * 
 * Creates a sources_google_experts record linking an expert to a specific folder
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

// Interface for command options
interface AssignExpertOptions {
  folderId: string;
  expertId: string;
  isPrimary: boolean;
  dryRun: boolean;
  verbose: boolean;
}

/**
 * Assign an expert to a specific folder
 */
export async function assignExpert(options: AssignExpertOptions): Promise<void> {
  const { 
    folderId, 
    expertId, 
    isPrimary, 
    dryRun, 
    verbose 
  } = options;
  
  if (verbose) {
    Logger.info(`Options: ${JSON.stringify(options, null, 2)}`);
  }
  
  // Validate required parameters
  if (!folderId) {
    Logger.error('Folder ID is required. Use --folder-id option.');
    return;
  }
  
  if (!expertId) {
    Logger.error('Expert ID is required. Use --expert-id option.');
    return;
  }
  
  try {
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Step 1: Verify folder exists
    Logger.info(`Verifying folder ID: ${folderId}`);
    const { data: folderData, error: folderError } = await supabase
      .from('sources_google')
      .select('id, name, path, path_depth')
      .eq('id', folderId)
      .single();
    
    if (folderError || !folderData) {
      throw new Error(`Folder not found: ${folderError?.message || 'No folder with that ID'}`);
    }
    
    // Step 2: Verify expert exists
    Logger.info(`Verifying expert ID: ${expertId}`);
    const { data: expertData, error: expertError } = await supabase
      .from('experts')
      .select('id, expert_name, full_name')
      .eq('id', expertId)
      .single();
    
    if (expertError || !expertData) {
      throw new Error(`Expert not found: ${expertError?.message || 'No expert with that ID'}`);
    }
    
    const expertName = expertData.expert_name || expertData.full_name;
    
    // Step 3: Check if this relationship already exists
    Logger.info(`Checking for existing relationship between folder and expert...`);
    const { data: existingLink, error: linkError } = await supabase
      .from('sources_google_experts')
      .select('id')
      .eq('source_id', folderId)
      .eq('expert_id', expertId);
    
    if (linkError) {
      Logger.warn(`Error checking for existing link: ${linkError.message}`);
    } else if (existingLink && existingLink.length > 0) {
      Logger.warn(`A link already exists between this folder and expert`);
      Logger.info(`Link ID: ${existingLink[0].id}`);
      
      if (!dryRun) {
        // Update the existing link
        const { error: updateError } = await supabase
          .from('sources_google_experts')
          .update({
            is_primary: isPrimary,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLink[0].id);
          
        if (updateError) {
          throw new Error(`Failed to update existing link: ${updateError.message}`);
        }
        
        Logger.info(`Successfully updated link between folder "${folderData.name}" and expert "${expertName}"`);
        return;
      }
    }
    
    // Step 4: Create the link if it doesn't exist
    if (dryRun) {
      Logger.info(`[DRY RUN] Would create link between:`);
      Logger.info(`- Folder: ${folderData.name} (${folderId})`);
      Logger.info(`- Expert: ${expertName} (${expertId})`);
      Logger.info(`- Primary: ${isPrimary}`);
      return;
    }
    
    // Insert the record
    const { data: insertData, error: insertError } = await supabase
      .from('sources_google_experts')
      .insert({
        source_id: folderId,
        expert_id: expertId,
        is_primary: isPrimary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (insertError) {
      throw new Error(`Failed to create link: ${insertError.message}`);
    }
    
    Logger.info(`Successfully created link between folder "${folderData.name}" and expert "${expertName}"`);
    Logger.info(`Link ID: ${insertData[0].id}`);
    
    // Step 5: If the folder has children, suggest cascading
    if (folderData.path_depth === 0) {
      const { data: childrenCount, error: countError } = await supabase
        .from('sources_google')
        .select('id', { count: 'exact', head: true })
        .eq('root_drive_id', folderData.id)
        .neq('id', folderData.id); // Exclude the folder itself
      
      if (!countError && childrenCount && childrenCount > 0) {
        Logger.info(`This folder has ${childrenCount} child items.`);
        Logger.info(`To assign this expert to all children, use the cascade-expert command:`);
        Logger.info(`./scripts/cli-pipeline/experts/experts-cli.sh cascade-expert \\`);
        Logger.info(`  --folder-id ${folderId} \\`);
        Logger.info(`  --expert-id ${expertId} \\`);
        Logger.info(`  --primary ${isPrimary}`);
      }
    }
    
  } catch (error) {
    Logger.error(`Error assigning expert: ${error.message}`);
  }
}