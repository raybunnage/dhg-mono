import { PromptService } from '../../../packages/shared/services/prompt-service';
import * as fs from 'fs';
import * as path from 'path';

async function checkPrompt() {
  console.log('Checking prompt in database vs file...');
  const promptService = PromptService.getInstance();
  
  try {
    // Get prompt from database
    const result = await promptService.loadPrompt('final_video-summary-prompt');
    const dbPrompt = result.prompt;
    
    console.log('Database prompt:');
    console.log('--------------');
    
    if (!dbPrompt) {
      console.log('Prompt not found in database!');
      return;
    }
    
    console.log(`Name: ${dbPrompt.name}`);
    console.log(`Content length: ${dbPrompt.content?.length || 0} characters`);
    
    if (dbPrompt.content) {
      console.log(`First 100 chars: ${dbPrompt.content.substring(0, 100)}...`);
      
      // Check if it's a JSON string (has escaped quotes/newlines)
      const isJsonEscaped = dbPrompt.content.startsWith('"') || 
                           dbPrompt.content.includes('\\n') || 
                           dbPrompt.content.includes('\\"');
      
      console.log(`Appears to be JSON escaped: ${isJsonEscaped}`);
      
      // Check for Jane Smith
      if (dbPrompt.content.includes('Jane Smith')) {
        console.log('⚠️ ISSUE FOUND: Database prompt contains "Jane Smith" example!');
      }
      
      // Try parsing if it looks like JSON
      if (isJsonEscaped) {
        try {
          const parsed = JSON.parse(dbPrompt.content);
          console.log(`Successfully parsed as JSON`);
          console.log(`Parsed content length: ${typeof parsed === 'string' ? parsed.length : 'N/A'} characters`);
          
          // Check for Jane Smith in parsed content
          if (typeof parsed === 'string' && parsed.includes('Jane Smith')) {
            console.log('⚠️ ISSUE FOUND: Parsed JSON content contains "Jane Smith" example!');
          }
        } catch (err: any) { // Type assertion for error
          console.log(`Failed to parse as JSON: ${err?.message || 'Unknown error'}`);
        }
      }
    }
    
    // Get file prompt
    console.log('\nFile prompt:');
    console.log('-----------');
    
    const filePath = path.resolve(process.cwd(), 'prompts/final_video-summary-prompt.md');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    console.log(`File path: ${filePath}`);
    console.log(`Content length: ${fileContent.length} characters`);
    console.log(`First 100 chars: ${fileContent.substring(0, 100)}...`);
    
    // Check file for Jane Smith
    if (fileContent.includes('Jane Smith')) {
      console.log('⚠️ ISSUE FOUND: File prompt contains "Jane Smith" example!');
    }
    
    // Compare contents
    console.log('\nComparison:');
    console.log('-----------');
    console.log(`Contents match exactly: ${dbPrompt.content === fileContent}`);
    
    // If the database contains a JSON string, compare with parsed
    const isDbJsonEscaped = dbPrompt.content.startsWith('"') || 
                        dbPrompt.content.includes('\\n') || 
                        dbPrompt.content.includes('\\"');
                        
    if (isDbJsonEscaped) {
      try {
        const parsed = JSON.parse(dbPrompt.content);
        console.log(`Parsed JSON content matches file: ${parsed === fileContent}`);
      } catch (err: any) {
        // Ignore parsing errors here
        console.log(`Failed to parse JSON for comparison: ${err?.message || 'Unknown error'}`);
      }
    }
    
  } catch (error) {
    console.error('Error checking prompt:', error);
  }
}

checkPrompt();