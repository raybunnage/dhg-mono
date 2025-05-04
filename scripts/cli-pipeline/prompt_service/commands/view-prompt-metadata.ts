import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

/**
 * View the metadata of a prompt
 * @param promptName Name of the prompt to view
 */
export async function viewPromptMetadataCommand(promptName: string): Promise<void> {
  try {
    const supabaseService = SupabaseClientService.getInstance();
    const supabase = supabaseService.getClient();
    
    // Fetch the prompt
    const { data: prompt, error } = await supabase
      .from('prompts')
      .select(`
        id,
        name,
        metadata
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
    
    // Display the prompt metadata
    console.log(`Metadata for prompt: ${prompt.name}\n`);
    console.log(JSON.stringify(prompt.metadata, null, 2));
    
  } catch (error) {
    console.error(`Error viewing prompt metadata: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}