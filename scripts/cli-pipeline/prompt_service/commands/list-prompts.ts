import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface ListPromptsOptions {
  category?: string;
  status?: 'active' | 'draft' | 'deprecated' | 'archived';
}

/**
 * List all prompts in the database
 * @param options Command options
 */
export async function listPromptsCommand(options: ListPromptsOptions): Promise<void> {
  try {
    const supabaseService = SupabaseClientService.getInstance();
    const supabase = supabaseService.getClient();
    
    // Build the query - simpler approach without join
    let query = supabase
      .from('ai_prompts')
      .select('*');
    
    // Apply filters
    if (options.category) {
      // Note: This would require fetching categories separately and filtering by category_id
      console.warn('Category filtering is not currently implemented');
    }
    
    if (options.status) {
      query = query.eq('status', options.status);
    }
    
    // Execute the query
    const { data: prompts, error } = await query;
    
    if (error) {
      console.error(`Error fetching prompts: ${error.message}`);
      process.exit(1);
    }
    
    if (!prompts || prompts.length === 0) {
      console.log('No prompts found.');
      return;
    }
    
    // Display the prompts
    console.log(`Found ${prompts.length} prompts:`);
    console.log('-------------------------------------------------------------------------');
    console.log('| ID                  | Name                 | Status   | Updated       |');
    console.log('-------------------------------------------------------------------------');
    
    prompts.forEach(prompt => {
      const id = prompt.id.substring(0, 8) + '...';
      const name = prompt.name.substring(0, 20).padEnd(20);
      const status = (prompt.status || 'draft').padEnd(8);
      const updated = prompt.updated_at 
        ? new Date(prompt.updated_at).toLocaleDateString() 
        : 'N/A';
      
      console.log(`| ${id} | ${name} | ${status} | ${updated} |`);
    });
    
    console.log('-------------------------------------------------------------------------');
    
  } catch (error) {
    console.error(`Error listing prompts: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}