#!/usr/bin/env node

/**
 * Script to fix database queries in prompts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { promptManagementService, DatabasePrompt } from '../../../packages/shared/services/prompt-service/prompt-management-service';

// Load environment variables from .env files
const envFiles = ['.env', '.env.local', '.env.development'];
envFiles.forEach(file => {
  const envPath = resolve(process.cwd(), '..', '..', '..', file);
  console.log(`Loading environment variables from ${envPath}`);
  config({ path: envPath });
});

async function main() {
  try {
    console.log('Fixing database queries in prompts...');
    
    // Get all prompts from the database
    const prompts = await promptManagementService.getDatabasePrompts();
    
    // Define the queries to update
    const queriesToUpdate = [
      {
        promptName: 'document-classification-prompt-new',
        query: 'select id, category, document_type, description, mime_type, file_extension from document_types where classifier = \'docx\';'
      },
      {
        promptName: 'scientific-document-analysis-prompt',
        query: 'select id, category, document_type, description, mime_type, file_extension from document_types where classifier = \'pdf\';'
      },
      {
        promptName: 'scientific-powerpoint',
        query: 'select id, category, document_type, description, mime_type, file_extension from document_types where classifier = \'powerpoint\';'
      }
    ];
    
    // Process each query update
    for (const { promptName, query } of queriesToUpdate) {
      console.log(`Updating query for prompt: ${promptName}`);
      
      // Find the prompt by name
      const prompt = prompts.find((p: DatabasePrompt) => p.name === promptName);
      
      if (!prompt) {
        console.error(`Prompt "${promptName}" not found in the database.`);
        continue;
      }
      
      console.log(`Found prompt: ${promptName} (ID: ${prompt.id})`);
      
      // Create updated metadata with the database query
      const updatedMetadata = {
        ...prompt.metadata,
        databaseQuery: query
      };
      
      // Update the prompt with the new metadata
      console.log(`Setting databaseQuery for prompt: ${promptName}`);
      const result = await promptManagementService.updatePrompt(prompt.id, {
        metadata: updatedMetadata
      });
      
      if (result) {
        console.log(`✅ Successfully updated databaseQuery for prompt: ${promptName}`);
        console.log(`Full query: ${query}`);
      } else {
        console.error(`❌ Failed to update metadata for prompt: ${promptName}`);
      }
    }
    
  } catch (error) {
    console.error(`Error updating prompt metadata: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});