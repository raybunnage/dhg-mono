/**
 * Command to add or update a database query for a prompt
 * 
 * This command adds or updates the databaseQuery or databaseQuery2 field in a prompt's metadata.
 * The query is used by the prompt for fetching data when executed.
 */
import { promptManagementService, DatabasePrompt } from '../../../../packages/shared/services/prompt-service/prompt-management-service';
import { Logger } from '../../../../packages/shared/utils';

export interface AddQueryOptions {
  query2?: boolean;  // Flag to use databaseQuery2 instead of databaseQuery
  dryRun?: boolean;  // Show what would be updated without making changes
}

/**
 * Add or update a database query for a prompt
 * @param promptName Name of the prompt to update
 * @param databaseQuery The SQL query to add to the prompt metadata
 * @param options Command options
 */
export async function addQueryCommand(
  promptName: string, 
  databaseQuery: string, 
  options: AddQueryOptions
): Promise<void> {
  try {
    Logger.info(`Looking for prompt: ${promptName}`);
    
    // Get all prompts from the database
    const prompts = await promptManagementService.getDatabasePrompts();
    
    // Find the prompt by name
    const prompt = prompts.find((p: DatabasePrompt) => p.name === promptName);
    
    if (!prompt) {
      Logger.error(`Prompt "${promptName}" not found in the database.`);
      process.exit(1);
    }
    
    Logger.info(`Found prompt: ${promptName} (ID: ${prompt.id})`);
    
    // Determine which field to update
    const queryField = options.query2 ? 'databaseQuery2' : 'databaseQuery';
    
    // Create updated metadata with the database query
    const updatedMetadata = {
      ...prompt.metadata,
      [queryField]: databaseQuery
    };
    
    // In dry-run mode, just show what would be updated
    if (options.dryRun) {
      Logger.info(`DRY RUN: Would update ${queryField} for prompt: ${promptName}`);
      Logger.info(`New query: ${databaseQuery}`);
      return;
    }
    
    // Update the prompt with the new metadata
    Logger.info(`Updating ${queryField} for prompt: ${promptName}`);
    const result = await promptManagementService.updatePrompt(prompt.id, {
      metadata: updatedMetadata
    });
    
    if (result) {
      Logger.info(`✅ Successfully updated ${queryField} for prompt: ${promptName}`);
      Logger.info(`Query: ${databaseQuery}`);
    } else {
      Logger.error(`❌ Failed to update metadata for prompt: ${promptName}`);
      process.exit(1);
    }
  } catch (error) {
    Logger.error(`Error updating prompt metadata: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}