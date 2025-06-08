#!/usr/bin/env ts-node
/**
 * Test script for PromptService using SupabaseClientService 
 */
import { promptService } from '../../../packages/shared/services/prompt-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function testPromptService() {
  console.log('=== Testing PromptService with SupabaseClientService Integration ===');
  
  try {
    // Test Supabase connection first
    console.log('\n=== Testing Supabase Connection ===');
    const supabaseService = SupabaseClientService.getInstance();
    const connectionTest = await supabaseService.testConnection();
    
    if (!connectionTest.success) {
      console.error('❌ Supabase connection test failed:', connectionTest.error);
      return;
    }
    
    console.log('✅ Supabase connection test successful');
    
    // Test getting a prompt by name
    console.log('\n=== Testing getPromptByName ===');
    const promptName = 'document-classification-prompt'; // Change to an existing prompt in your system
    const prompt = await promptService.getPromptByName(promptName);
    
    if (prompt) {
      console.log('✅ Successfully retrieved prompt:', prompt.name);
      console.log('Prompt ID:', prompt.id);
      console.log('Description:', prompt.description);
      console.log('Content snippet:', prompt.content.substring(0, 100) + '...');
      
      if (prompt.id !== 'local-file') {
        // Test getting relationships
        console.log('\n=== Testing getRelationshipsByPromptId ===');
        const relationships = await promptService.getRelationshipsByPromptId(prompt.id);
        console.log(`Found ${relationships.length} relationships`);
        
        if (relationships.length > 0) {
          console.log('First relationship:', {
            id: relationships[0].id,
            type: relationships[0].relationship_type,
            path: relationships[0].asset_path,
          });
        }
      }
      
      // Test executing a query
      console.log('\n=== Testing executeQuery ===');
      try {
        const queryResults = await promptService.executeQuery('SELECT document_type FROM document_types LIMIT 5');
        console.log('✅ Query executed successfully');
        console.log('Results:', queryResults.length > 0 ? queryResults.slice(0, 5) : queryResults);
      } catch (queryError) {
        console.error('❌ Error executing query:', queryError instanceof Error ? queryError.message : queryError);
      }
      
      // Test loading a prompt with all related data
      console.log('\n=== Testing loadPrompt ===');
      const loadResult = await promptService.loadPrompt(promptName, {
        includeDatabaseQueries: true,
        includeRelationships: true,
        includeRelatedFiles: true,
        executeQueries: true
      });
      
      console.log('✅ Successfully loaded prompt with all related data');
      console.log('- Prompt loaded:', loadResult.prompt ? 'Yes' : 'No');
      console.log('- Relationships loaded:', loadResult.relationships.length);
      console.log('- Related files loaded:', loadResult.relatedFiles.length);
      console.log('- Database queries executed:', loadResult.databaseQueries.length);
      console.log('- Combined content length:', loadResult.combinedContent.length);
    } else {
      console.log(`❌ Prompt '${promptName}' not found`);
    }
    
    console.log('\n=== Tests Complete ===');
    
  } catch (error) {
    console.error('❌ Error in test:', error instanceof Error ? error.message : error);
  }
}

// Run the tests
testPromptService().catch(console.error);