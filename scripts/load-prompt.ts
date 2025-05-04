/**
 * Script to load a prompt file into the database
 */
import * as fs from 'fs';
import * as path from 'path';
import { PromptManagementService } from '../packages/shared/services/prompt-service/prompt-management-service';
import { SupabaseClientService } from '../packages/shared/services/supabase-client';
import { Logger } from '../packages/shared/utils';

// Configure the name and file path
const PROMPT_NAME = 'document-classification-prompt-new';
const FILE_PATH = path.resolve(process.cwd(), 'prompts/document-classification-prompt-new.md');

async function main() {
  try {
    // Ensure the file exists
    if (!fs.existsSync(FILE_PATH)) {
      Logger.error(`Error: File not found: ${FILE_PATH}`);
      process.exit(1);
    }
    
    // Get the prompt service instance
    const promptService = PromptManagementService.getInstance();
    const supabaseService = SupabaseClientService.getInstance();
    const supabase = supabaseService.getClient();
    
    // Read the file content
    const content = fs.readFileSync(FILE_PATH, 'utf8');
    
    Logger.info(`Loading prompt: ${PROMPT_NAME}`);
    Logger.info(`File: ${FILE_PATH}`);
    
    // Check if the prompt already exists
    const { data: existingPrompt } = await supabase
      .from('prompts')
      .select('id, name')
      .eq('name', PROMPT_NAME)
      .maybeSingle();
    
    // Parse any frontmatter in the content
    const { metadata, content: parsedContent } = promptService.parseMarkdownFrontmatter(content);
    
    if (existingPrompt) {
      Logger.info(`Updating existing prompt: ${PROMPT_NAME}`);
      
      const result = await promptService.updatePrompt(existingPrompt.id, {
        content,
        description: metadata.description || 'Document classification prompt',
      });
      
      if (result) {
        Logger.info(`Successfully updated prompt: ${PROMPT_NAME}`);
      } else {
        Logger.error(`Failed to update prompt: ${PROMPT_NAME}`);
      }
    } else {
      Logger.info(`Creating new prompt: ${PROMPT_NAME}`);
      
      // Use the full markdown content for the prompt
      const result = await promptService.createPrompt(
        PROMPT_NAME,
        content,
        {
          description: metadata.description || 'Document classification prompt',
          filePath: FILE_PATH
        }
      );
      
      if (result) {
        Logger.info(`Successfully created prompt: ${PROMPT_NAME} with ID: ${result.id}`);
      } else {
        Logger.error(`Failed to create prompt: ${PROMPT_NAME}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    Logger.error(`Error loading prompt: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the script
main();