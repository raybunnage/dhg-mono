/**
 * Script to view the metadata of a prompt
 */
import { promptManagementService, DatabasePrompt } from '../packages/shared/services/prompt-service/prompt-management-service';
import { Logger } from '../packages/shared/utils';

// Prompt name to view
const PROMPT_NAME = 'document-classification-prompt-new';

async function viewPromptMetadata() {
  try {
    // Get all prompts from the database
    const prompts = await promptManagementService.getDatabasePrompts();
    
    // Find the prompt by name
    const prompt = prompts.find((p: DatabasePrompt) => p.name === PROMPT_NAME);
    
    if (!prompt) {
      Logger.error(`Prompt "${PROMPT_NAME}" not found in the database.`);
      return;
    }
    
    Logger.info(`Metadata for prompt: ${PROMPT_NAME} (ID: ${prompt.id})`);
    Logger.info('-------------------------------------------');
    Logger.info(JSON.stringify(prompt.metadata, null, 2));
    Logger.info('-------------------------------------------');
    
    // Specifically check for database query
    if (prompt.metadata.databaseQuery) {
      Logger.info(`Database Query: ${prompt.metadata.databaseQuery}`);
    } else {
      Logger.warn('No database query found in metadata');
    }
  } catch (error) {
    Logger.error(`Error viewing prompt metadata: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the script
viewPromptMetadata();