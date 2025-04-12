/**
 * List Experts Command
 * 
 * Displays a list of experts to help with assignment
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

// Interface for command options
interface ListExpertsOptions {
  limit?: number;
  verbose: boolean;
}

/**
 * List experts in the system
 */
export async function listExperts(options: ListExpertsOptions): Promise<void> {
  const { limit = 100, verbose } = options;
  
  try {
    Logger.info('Fetching experts...');
    
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Get all experts
    const { data: experts, error: expertsError } = await supabase
      .from('experts')
      .select('id, expert_name, full_name, expertise_area, is_in_core_group')
      .order('expert_name')
      .limit(limit);
    
    if (expertsError) {
      throw new Error(`Failed to fetch experts: ${expertsError.message}`);
    }
    
    if (!experts || experts.length === 0) {
      Logger.warn('No experts found in the database.');
      return;
    }
    
    // Generate a table-like display
    Logger.info(`Found ${experts.length} experts:`);
    Logger.info('================================================================================');
    Logger.info(`ID                                   | Name                  | Core | Expertise`);
    Logger.info('--------------------------------------------------------------------------------');
    
    experts.forEach((expert, index) => {
      const name = expert.expert_name || expert.full_name || 'Unknown';
      const core = expert.is_in_core_group ? 'Yes' : 'No';
      const expertise = expert.expertise_area || 'Not specified';
      
      Logger.info(`${expert.id} | ${name.padEnd(20, ' ')} | ${core.padEnd(4, ' ')} | ${expertise.slice(0, 40)}`);
      
      if (verbose) {
        Logger.info(`  Assignment command: ./scripts/cli-pipeline/experts/experts-cli.sh assign-expert --expert-id ${expert.id} --folder-id <FOLDER_ID>`);
        Logger.info('--------------------------------------------------------------------------------');
      }
    });
    
    Logger.info('================================================================================');
    Logger.info(`To assign an expert to a folder, use the assign-expert command with the expert ID.`);
    
  } catch (error) {
    Logger.error(`Error listing experts: ${error.message}`);
  }
}