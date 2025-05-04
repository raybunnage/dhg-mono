import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface ViewPromptOptions {
  format?: 'json' | 'text' | 'markdown';
}

/**
 * View the content of a prompt
 * @param promptName Name of the prompt to view
 * @param options Command options
 */
export async function viewPromptCommand(promptName: string, options: ViewPromptOptions): Promise<void> {
  try {
    const supabaseService = SupabaseClientService.getInstance();
    const supabase = supabaseService.getClient();
    
    // Fetch the prompt
    const { data: prompt, error } = await supabase
      .from('prompts')
      .select(`
        id,
        name,
        content,
        description,
        status,
        created_at,
        updated_at,
        file_path,
        metadata,
        prompt_categories (
          name
        )
      `)
      .eq('name', promptName)
      .maybeSingle();
    
    if (error) {
      console.error(`Error fetching prompt: ${error.message}`);
      process.exit(1);
    }
    
    if (!prompt) {
      console.error(`Prompt not found: ${promptName}`);
      process.exit(1);
    }
    
    // Display the prompt based on format
    const format = options.format || 'text';
    
    if (format === 'json') {
      console.log(JSON.stringify(prompt, null, 2));
    } else if (format === 'markdown') {
      console.log(`# Prompt: ${prompt.name}\n`);
      
      if (prompt.description) {
        console.log(`## Description\n${prompt.description}\n`);
      }
      
      console.log(`## Metadata\n`);
      console.log(`- Status: ${prompt.status || 'draft'}`);
      console.log(`- Created: ${prompt.created_at ? new Date(prompt.created_at).toLocaleString() : 'N/A'}`);
      console.log(`- Updated: ${prompt.updated_at ? new Date(prompt.updated_at).toLocaleString() : 'N/A'}`);
      console.log(`- File: ${prompt.file_path || 'N/A'}`);
      console.log(`- Category: ${prompt.prompt_categories ? prompt.prompt_categories[0]?.name : 'None'}\n`);
      
      console.log(`## Content\n`);
      console.log(prompt.content);
    } else {
      // Default text format
      console.log(`Prompt: ${prompt.name}`);
      console.log(`Status: ${prompt.status || 'draft'}`);
      console.log(`Created: ${prompt.created_at ? new Date(prompt.created_at).toLocaleString() : 'N/A'}`);
      console.log(`Updated: ${prompt.updated_at ? new Date(prompt.updated_at).toLocaleString() : 'N/A'}`);
      console.log(`File: ${prompt.file_path || 'N/A'}`);
      console.log(`Category: ${prompt.prompt_categories ? prompt.prompt_categories[0]?.name : 'None'}`);
      console.log('\nContent:');
      console.log('--------------------------------------------------------------------------------');
      console.log(prompt.content);
      console.log('--------------------------------------------------------------------------------');
    }
    
  } catch (error) {
    console.error(`Error viewing prompt: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}