import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * This script fixes the video summary prompt in the database
 * by replacing it with the clean version from the file system.
 */
async function fixPrompt() {
  console.log('Starting to fix the video summary prompt in the database...');
  
  try {
    // Get the clean prompt from file
    const promptFilePath = path.resolve(process.cwd(), 'prompts/final_video-summary-prompt.md');
    const cleanPrompt = fs.readFileSync(promptFilePath, 'utf8');
    
    console.log(`Loaded clean prompt from file: ${promptFilePath}`);
    console.log(`Clean prompt length: ${cleanPrompt.length} characters`);
    
    // Verify clean prompt doesn't have Jane Smith
    if (cleanPrompt.includes('Jane Smith')) {
      console.error('ERROR: The file prompt also contains "Jane Smith" example - please clean the file first!');
      process.exit(1);
    }
    
    // Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Find the prompt ID in the database
    console.log('Looking up prompt ID in database...');
    const { data: promptData, error: lookupError } = await supabase
      .from('prompts')
      .select('id, name, content')
      .eq('name', 'final_video-summary-prompt')
      .maybeSingle();
    
    if (lookupError) {
      console.error(`Error looking up prompt: ${lookupError.message}`);
      process.exit(1);
    }
    
    if (!promptData) {
      console.error('Prompt not found in database - nothing to update');
      process.exit(1);
    }
    
    console.log(`Found prompt in database: ID ${promptData.id}, Name: ${promptData.name}`);
    
    // Check content in database for Jane Smith
    if (promptData.content.includes('Jane Smith')) {
      console.log('⚠️ Confirmed database prompt contains "Jane Smith" example - will update with clean version');
      
      // Update the prompt in the database
      console.log('Updating prompt in database...');
      const { data: updateData, error: updateError } = await supabase
        .from('prompts')
        .update({ 
          content: cleanPrompt,
          updated_at: new Date().toISOString()
        })
        .eq('id', promptData.id)
        .select();
      
      if (updateError) {
        console.error(`Error updating prompt: ${updateError.message}`);
        process.exit(1);
      }
      
      console.log(`Successfully updated prompt in database! Updated at: ${updateData?.[0]?.updated_at}`);
    } else {
      console.log('Database prompt appears to be clean already - no update needed');
    }
    
    console.log('Fix completed successfully!');
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Run the fix
fixPrompt();