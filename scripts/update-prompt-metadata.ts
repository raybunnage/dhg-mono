/**
 * Script to update the metadata of a prompt
 */
import { promptManagementService, DatabasePrompt } from '../packages/shared/services/prompt-service/prompt-management-service';
import { Logger } from '../packages/shared/utils';

// Prompt name to update
const PROMPT_NAME = 'document-classification-prompt-new';

// Database query to add to the metadata
const DATABASE_QUERY = "select id, category, document_type, description, mime_type, file_extension from document_types;";

async function updatePromptMetadata() {
  try {
    // Get all prompts from the database
    const prompts = await promptManagementService.getDatabasePrompts();
    
    // Find the prompt by name
    const prompt = prompts.find((p: DatabasePrompt) => p.name === PROMPT_NAME);
    
    if (!prompt) {
      Logger.error(`Prompt "${PROMPT_NAME}" not found in the database.`);
      return;
    }
    
    Logger.info(`Updating metadata for prompt: ${PROMPT_NAME} (ID: ${prompt.id})`);
    
    // Create updated metadata with the database query
    const updatedMetadata = {
      ...prompt.metadata,
      databaseQuery: DATABASE_QUERY
    };
    
    // Update the prompt with the new metadata
    const result = await promptManagementService.updatePrompt(prompt.id, {
      metadata: updatedMetadata
    });
    
    if (result) {
      Logger.info(`Successfully updated metadata for prompt: ${PROMPT_NAME}`);
      Logger.info(`Added database query: ${DATABASE_QUERY}`);
    } else {
      Logger.error(`Failed to update metadata for prompt: ${PROMPT_NAME}`);
    }
  } catch (error) {
    Logger.error(`Error updating prompt metadata: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the script
updatePromptMetadata();