import * as fs from 'fs';
import * as path from 'path';
import { PromptManagementService } from '../../../../packages/shared/services/prompt-service/prompt-management-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';

interface LoadPromptOptions {
  replace?: boolean;
  name?: string;
  category?: string;
}

/**
 * Load a prompt file into the database
 * @param filePath Path to the prompt file
 * @param options Command options
 */
export async function loadPromptCommand(filePath: string, options: LoadPromptOptions): Promise<void> {
  await trackCommandExecution('prompt_service', 'load', async () => {
  try {
    // Ensure the file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    
    // Get the prompt service instance
    const promptService = PromptManagementService.getInstance();
    const supabaseService = SupabaseClientService.getInstance();
    const supabase = supabaseService.getClient();
    
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Determine the prompt name
    const promptName = options.name || path.basename(filePath, path.extname(filePath));
    
    console.log(`Loading prompt: ${promptName}`);
    console.log(`File: ${filePath}`);
    
    // Check if the prompt already exists
    const { data: existingPrompt } = await supabase
      .from('ai_prompts')
      .select('id, name')
      .eq('name', promptName)
      .maybeSingle();
    
    if (existingPrompt && !options.replace) {
      console.error(`Error: Prompt with name "${promptName}" already exists.`);
      console.error(`Use --replace flag to update the existing prompt.`);
      process.exit(1);
    }
    
    // Extract metadata from the content (if available)
    const { metadata: extractedMetadata, content: cleanContent } = promptService.parseMarkdownFrontmatter(content);
    
    // Build properly structured metadata object
    const metadataObj = promptService.buildMetadataObject(extractedMetadata, cleanContent, path.basename(filePath));
    
    // Determine if updating or creating
    if (existingPrompt && options.replace) {
      console.log(`Updating existing prompt: ${promptName}`);
      
      const { data, error } = await supabase
        .from('ai_prompts')
        .update({
          content: cleanContent,
          metadata: metadataObj,
          updated_at: new Date().toISOString(),
          file_path: filePath,
        })
        .eq('id', existingPrompt.id)
        .select();
      
      if (error) {
        console.error(`Error updating prompt: ${error.message}`);
        process.exit(1);
      }
      
      console.log(`Successfully updated prompt: ${promptName}`);
    } else {
      console.log(`Creating new prompt: ${promptName}`);
      
      // Look up category ID if provided
      let categoryId = null;
      if (options.category) {
        const { data: category } = await supabase
          .from('ai_prompt_categories')
          .select('id')
          .eq('name', options.category)
          .maybeSingle();
        
        if (category) {
          categoryId = category.id;
        } else {
          console.warn(`Warning: Category "${options.category}" not found. Creating prompt without category.`);
        }
      }
      
      const { data, error } = await supabase
        .from('ai_prompts')
        .insert({
          name: promptName,
          content: cleanContent,
          metadata: metadataObj,
          category_id: categoryId,
          status: extractedMetadata.status || 'active',
          file_path: filePath,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select();
      
      if (error) {
        console.error(`Error creating prompt: ${error.message}`);
        process.exit(1);
      }
      
      console.log(`Successfully created prompt: ${promptName}`);
    }
    
    // Return tracking info
    return {
      promptName,
      operation: existingPrompt && options.replace ? 'update' : 'create',
      filePath: path.basename(filePath)
    };
    
  } catch (error) {
    console.error(`Error loading prompt: ${error instanceof Error ? error.message : String(error)}`);
    throw error; // Let tracking wrapper handle the error
  }
  }, {
    getResultSummary: (result) => ({
      recordsAffected: 1,
      affectedEntity: 'prompts',
      summary: result.operation === 'update' 
        ? `Updated prompt "${result.promptName}" from file ${result.filePath}`
        : `Created new prompt "${result.promptName}" from file ${result.filePath}`
    })
  });
}