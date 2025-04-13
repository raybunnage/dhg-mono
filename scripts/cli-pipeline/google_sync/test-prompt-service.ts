#!/usr/bin/env ts-node
/**
 * Test script for the new PromptService
 */
import { promptService } from '../../../packages/shared/services/prompt-service';

async function testPromptService() {
  console.log('Testing PromptService...');
  
  try {
    // Test loading a prompt
    const promptName = 'document-classification-prompt-new';
    console.log(`Loading prompt: ${promptName}`);
    
    const result = await promptService.loadPrompt(promptName, {
      includeDatabaseQueries: true,
      executeQueries: true,
      includeRelationships: true,
      includeRelatedFiles: true
    });
    
    console.log('Prompt load result:');
    console.log('- Prompt name:', result.prompt?.name);
    console.log('- Content length:', result.prompt?.content.length);
    console.log('- Relationships:', result.relationships.length);
    console.log('- Related files:', result.relatedFiles.length);
    console.log('- Database queries:', result.databaseQueries.length);
    console.log('- Combined content length:', result.combinedContent.length);
    
    // Write the result to a markdown file
    const outputPath = await promptService.writeResultsToMarkdown(
      'prompt-test-result.md',
      promptService.formatPromptResultAsMarkdown(promptName, result)
    );
    
    console.log(`Results written to: ${outputPath}`);
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error testing PromptService:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPromptService();
}