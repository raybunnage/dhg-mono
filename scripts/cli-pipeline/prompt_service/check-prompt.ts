/**
 * Script to check if a prompt exists in the database
 */
import { promptManagementService, DatabasePrompt } from '../../../packages/shared/services/prompt-service/prompt-management-service';
import { Logger } from '../../../packages/shared/utils';

// Prompt name to check
const PROMPT_NAME = 'document-classification-prompt-new';

async function checkPrompt() {
  try {
    // Get all prompts from the database
    const prompts = await promptManagementService.getDatabasePrompts();
    
    // Find the prompt by name
    const prompt = prompts.find((p: DatabasePrompt) => p.name === PROMPT_NAME);
    
    if (prompt) {
      Logger.info('Prompt found:');
      Logger.info(`ID: ${prompt.id}`);
      Logger.info(`Name: ${prompt.name}`);
      Logger.info(`Description: ${prompt.description}`);
      Logger.info(`Status: ${prompt.status}`);
      Logger.info(`Last Updated: ${prompt.updated_at}`);
      Logger.info(`File Path: ${prompt.file_path}`);
    } else {
      Logger.info(`Prompt "${PROMPT_NAME}" not found in the database.`);
    }
  } catch (error) {
    Logger.error(`Error checking prompt: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the script
checkPrompt();