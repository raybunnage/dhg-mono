#!/usr/bin/env node

/**
 * Add Database Query Command
 * 
 * This command adds or updates a database query in a prompt's metadata.
 * The query is used by the prompt when fetching data from the database.
 * 
 * Usage:
 *   npx ts-node add-query-command.ts <prompt-name> <database-query> [--query2] [--dry-run]
 */
import { promptManagementService, DatabasePrompt } from '../../../packages/shared/services/prompt-service/prompt-management-service';
import { Logger } from '../../../packages/shared/utils';

// Parse command-line arguments
const args = process.argv.slice(2);

// Display help if requested
if (args.includes('-h') || args.includes('--help') || args.length === 0) {
  console.log(`
Add Database Query Command

Adds or updates a database query in a prompt's metadata.
The query is used by the prompt when fetching data from the database.

Usage:
  npx ts-node add-query-command.ts <prompt-name> <database-query> [--query2] [--dry-run]

Arguments:
  prompt-name       Name of the prompt to update
  database-query    SQL query to add to the prompt metadata

Options:
  --query2          Use databaseQuery2 field instead of databaseQuery
  --dry-run         Show what would be updated without making changes
  -h, --help        Show this help message

Examples:
  npx ts-node add-query-command.ts my-prompt "SELECT * FROM document_types"
  npx ts-node add-query-command.ts my-prompt "SELECT * FROM experts" --query2
  `);
  process.exit(0);
}

// Check for minimum required arguments
if (args.length < 2) {
  Logger.error('Error: Missing required arguments');
  Logger.error('Usage: npx ts-node add-query-command.ts <prompt-name> <database-query> [--query2] [--dry-run]');
  Logger.error('Run with --help for more information');
  process.exit(1);
}

// Extract arguments
const promptName = args[0];
const databaseQuery = args[1];
const useQuery2 = args.includes('--query2');
const dryRun = args.includes('--dry-run');

// Define the main function
async function addQueryToPrompt() {
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
    const queryField = useQuery2 ? 'databaseQuery2' : 'databaseQuery';
    
    // Create updated metadata with the database query
    const updatedMetadata = {
      ...prompt.metadata,
      [queryField]: databaseQuery
    };
    
    // In dry-run mode, just show what would be updated
    if (dryRun) {
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

// Run the function
addQueryToPrompt();