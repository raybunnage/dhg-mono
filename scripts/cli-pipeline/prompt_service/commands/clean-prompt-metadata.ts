import { promptManagementService } from '../../../../packages/shared/services/prompt-service/prompt-management-service';

/**
 * Command to clean the "content" field from prompt metadata
 */
export async function cleanPromptMetadataCommand() {
  try {
    console.log('Cleaning "content" field from prompt metadata records...');
    
    // Get all prompts from the database
    const prompts = await promptManagementService.getDatabasePrompts();
    
    if (prompts.length === 0) {
      console.log('No prompts found in database.');
      return;
    }
    
    console.log(`Found ${prompts.length} prompts in database.`);
    
    // Track prompts that were updated
    let updatedCount = 0;
    let unchangedCount = 0;
    
    // Process each prompt
    for (const prompt of prompts) {
      let needsUpdate = false;
      
      // Check if metadata has content field
      if (prompt.metadata && 'content' in prompt.metadata) {
        console.log(`Prompt "${prompt.name}" has content field in metadata. Removing...`);
        
        // Create a copy of metadata without the content field
        const updatedMetadata = { ...prompt.metadata };
        delete updatedMetadata.content;
        
        // Update the prompt with cleaned metadata
        const updated = await promptManagementService.updatePrompt(prompt.id, {
          metadata: updatedMetadata
        });
        
        if (updated) {
          console.log(`Successfully cleaned metadata for prompt "${prompt.name}"`);
          updatedCount++;
        } else {
          console.error(`Failed to update metadata for prompt "${prompt.name}"`);
        }
        
        // Show the updated metadata
        console.log(`Updated metadata for "${prompt.name}":`);
        console.log(JSON.stringify(updatedMetadata, null, 2));
        console.log(''); // Empty line for readability
      } else {
        console.log(`Prompt "${prompt.name}" does not have content field in metadata. No changes needed.`);
        unchangedCount++;
      }
    }
    
    // Show summary
    console.log('\nMetadata Cleaning Summary:');
    console.log(`Total prompts: ${prompts.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`No changes needed: ${unchangedCount}`);
    
  } catch (error) {
    console.error(`Error cleaning prompt metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}