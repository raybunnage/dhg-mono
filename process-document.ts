import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from './packages/shared/services/supabase-client';
import { claudeService } from './packages/shared/services/claude-service/claude-service';

const DOCUMENT_ID = '7487db13-5979-430d-a4f4-d7b31c3d98f6';
const PROMPT_NAME = 'final_video-summary-prompt';
const OUTPUT_FILE = 'processed-document.json';

async function processDocument() {
  try {
    console.log('Starting document processing script');
    
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get document
    console.log(`Fetching document with ID: ${DOCUMENT_ID}`);
    const { data: document, error: docError } = await supabase
      .from('expert_documents')
      .select('id, raw_content, title, processed_content')
      .eq('id', DOCUMENT_ID)
      .single();
      
    if (docError || !document) {
      console.error(`Error fetching document: ${docError?.message || 'Document not found'}`);
      return;
    }
    
    console.log(`Found document with title: ${document.title || 'No title'}`);
    console.log(`Raw content length: ${document.raw_content?.length || 0} characters`);
    
    // Get prompt template
    console.log(`Reading prompt template from file: ${PROMPT_NAME}`);
    let promptTemplate = '';
    try {
      // Read the prompt directly from the file
      const promptPath = path.join(process.cwd(), 'prompts', `${PROMPT_NAME}.md`);
      promptTemplate = fs.readFileSync(promptPath, 'utf8');
      console.log(`Found prompt template (${promptTemplate.length} characters)`);
    } catch (promptError) {
      console.error('Error reading prompt:', promptError);
      return;
    }
    
    // Create customized prompt with the transcript
    const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', document.raw_content || '');
    console.log(`Customized prompt length: ${customizedPrompt.length} characters`);
    
    // Save customized prompt to file for checking
    const promptOutputPath = path.join(process.cwd(), 'customized-prompt.md');
    fs.writeFileSync(promptOutputPath, customizedPrompt);
    console.log(`Saved customized prompt to: ${promptOutputPath}`);
    
    // Process with Claude
    console.log('Sending prompt to Claude...');
    try {
      const response = await claudeService.sendPrompt(customizedPrompt);
      console.log(`Received response from Claude (${response.length} characters)`);
      
      // Save raw response
      const rawResponsePath = path.join(process.cwd(), 'claude-raw-response.txt');
      fs.writeFileSync(rawResponsePath, response);
      console.log(`Saved raw Claude response to: ${rawResponsePath}`);
      
      // Try to extract JSON
      let jsonString = response;
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
        console.log('Successfully extracted JSON from markdown code block');
      } else {
        console.log('No JSON code block found, attempting to parse entire response');
      }
      
      // Attempt to parse JSON
      try {
        const parsedJson = JSON.parse(jsonString);
        console.log('Successfully parsed JSON with keys:', Object.keys(parsedJson));
        
        // Format and save JSON
        const formattedJson = JSON.stringify(parsedJson, null, 2);
        const outputPath = path.join(process.cwd(), OUTPUT_FILE);
        fs.writeFileSync(outputPath, formattedJson);
        console.log(`Saved formatted JSON to: ${outputPath}`);
        
        // Update document in database
        console.log('Updating document in database...');
        const { data: updatedDoc, error: updateError } = await supabase
          .from('expert_documents')
          .update({
            processed_content: formattedJson,
            title: parsedJson.title || document.title,
            ai_summary_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', DOCUMENT_ID)
          .select('id, title, updated_at');
          
        if (updateError) {
          console.error('Error updating document:', updateError);
        } else {
          console.log('Successfully updated document:', updatedDoc);
        }
        
      } catch (jsonError) {
        console.error('Error parsing JSON:', jsonError);
        
        // Save the problematic response for inspection
        const errorPath = path.join(process.cwd(), 'json-error.txt');
        fs.writeFileSync(errorPath, jsonString);
        console.log(`Saved problematic response to: ${errorPath}`);
      }
      
    } catch (claudeError) {
      console.error('Error calling Claude:', claudeError);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run processing
processDocument();