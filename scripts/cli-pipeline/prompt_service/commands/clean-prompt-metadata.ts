import { promptManagementService } from '../../../../packages/shared/services/prompt-service/prompt-management-service';

interface CleanOptions {
  fields?: string[];
}

/**
 * Command to clean specified fields from prompt metadata
 */
export async function cleanPromptMetadataCommand(options: CleanOptions = {}) {
  try {
    // Default to removing content and temperature fields if not specified
    const fieldsToRemove = options.fields || ['content', 'temperature'];
    
    console.log(`Cleaning metadata fields ${fieldsToRemove.join(', ')} from prompt records...`);
    
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
      let fieldsRemoved: string[] = [];
      
      // Create a copy of metadata
      const updatedMetadata = { ...prompt.metadata };
      
      // Check for fields to remove
      for (const field of fieldsToRemove) {
        // Check if the field exists in metadata
        if (updatedMetadata && field in updatedMetadata) {
          delete updatedMetadata[field];
          fieldsRemoved.push(field);
          needsUpdate = true;
        }
        
        // Check if the field exists in aiEngine (for temperature specifically)
        if (field === 'temperature' && 
            updatedMetadata.aiEngine && 
            'temperature' in updatedMetadata.aiEngine) {
          delete updatedMetadata.aiEngine.temperature;
          fieldsRemoved.push('aiEngine.temperature');
          needsUpdate = true;
        }
      }
      
      // Update the prompt if needed
      if (needsUpdate) {
        console.log(`Prompt "${prompt.name}" has ${fieldsRemoved.join(', ')} in metadata. Removing...`);
        
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
        console.log(`Prompt "${prompt.name}" does not have fields to remove in metadata. No changes needed.`);
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