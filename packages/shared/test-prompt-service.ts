#!/usr/bin/env ts-node
/**
 * Test the Prompt Service with Direct Supabase Access
 * 
 * This script tests the updated PromptService which now uses direct
 * Supabase access instead of the client library. This approach
 * should work around authentication issues with the Supabase client.
 */

import { promptService } from './services/prompt-service/prompt-service';

async function testPromptService() {
  console.log('=== Testing Prompt Service with Direct Supabase Access ===');
  
  try {
    // Try to load a prompt by name
    const promptName = 'document-classification-prompt';
    console.log(`\n--- Loading prompt "${promptName}" ---`);
    
    const prompt = await promptService.getPromptByName(promptName);
    
    if (prompt) {
      console.log(`✅ Successfully loaded prompt "${promptName}"`);
      console.log(`ID: ${prompt.id}`);
      console.log(`Description: ${prompt.description || 'No description'}`);
      console.log(`Content length: ${prompt.content.length} characters`);
      
      if (prompt.id !== 'local-file') {
        // Try to get relationships for database prompts
        console.log(`\n--- Fetching relationships for prompt ID: ${prompt.id} ---`);
        const relationships = await promptService.getRelationshipsByPromptId(prompt.id);
        
        console.log(`✅ Found ${relationships.length} relationships`);
        if (relationships.length > 0) {
          console.table(relationships.map(rel => ({
            id: rel.id,
            type: rel.relationship_type,
            path: rel.asset_path
          })));
        }
      }
      
      // Test query execution
      console.log(`\n--- Testing database query execution ---`);
      try {
        const data = await promptService.executeQuery("SELECT document_type FROM document_types WHERE category = 'Documentation' LIMIT 5");
        console.log('✅ Query executed successfully');
        console.table(data || []);
      } catch (queryError) {
        console.error('❌ Query execution failed:', queryError instanceof Error ? queryError.message : String(queryError));
      }
      
      // Test full prompt loading
      console.log(`\n--- Testing full prompt loading with context ---`);
      try {
        const promptResult = await promptService.loadPrompt(promptName);
        console.log('✅ Full prompt load successful');
        console.log(`Loaded prompt: ${promptResult.prompt?.name}`);
        console.log(`Relationships: ${promptResult.relationships.length}`);
        console.log(`Related files: ${promptResult.relatedFiles.length}`);
        console.log(`Database queries: ${promptResult.databaseQueries.length}`);
        console.log(`Combined content length: ${promptResult.combinedContent.length} characters`);
      } catch (loadError) {
        console.error('❌ Full prompt load failed:', loadError instanceof Error ? loadError.message : String(loadError));
      }
    } else {
      console.log(`❌ Could not find prompt "${promptName}"`);
    }
  } catch (error) {
    console.error('Unhandled error:', error);
  }
}

// Run the test
testPromptService().catch(console.error);