import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';
import * as fs from 'fs';
import * as path from 'path';

// Create a new command
// Set up global error handling to catch unhandled errors
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
});

export const testProcessDocumentCommand = new Command('test-process-document');

// Set command description and options
testProcessDocumentCommand
  .description('Test processing a single document with the video summary prompt')
  .option('-d, --document-id <id>', 'Specific expert document ID to process')
  .option('-o, --output <path>', 'Output file path for the JSON results', 'test-document-result.json')
  .option('--save', 'Save the results to the database', false)
  .action(async (options: any) => {
    try {
      console.log('Starting document processing test with options:', JSON.stringify(options));
      console.log('Working directory:', process.cwd());
      Logger.info('Starting document processing test');
      
      // Check for required document ID
      if (!options.documentId) {
        Logger.error('Required parameter missing: --document-id');
        process.exit(1);
      }
      
      // Get supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      const promptQueryService = PromptQueryService.getInstance();
      
      // Get document ID
      const documentId = options.documentId;
      Logger.info(`Processing document with ID: ${documentId}`);
      
      // Get the document with raw content
      const { data: document, error: docError } = await supabase
        .from('expert_documents')
        .select('id, raw_content, title, processed_content')
        .eq('id', documentId)
        .single();
        
      if (docError || !document) {
        Logger.error(`Error fetching document: ${docError?.message || 'Document not found'}`);
        process.exit(1);
      }
      
      Logger.info(`Found document with title: ${document.title || 'No title'}`);
      Logger.info(`Raw content length: ${document.raw_content?.length || 0} characters`);
      
      // Get the summary prompt from the database
      Logger.info('Fetching video summary prompt from database...');
      let promptTemplate = '';
      try {
        const { prompt: summaryPrompt } = await promptQueryService.getPromptWithQueryResults('final_video-summary-prompt');
        if (summaryPrompt) {
          promptTemplate = summaryPrompt.content;
          Logger.info(`Found prompt: ${summaryPrompt.name}`);
          Logger.info(`Prompt template length: ${promptTemplate.length} characters`);
        }
      } catch (error) {
        Logger.error('Error fetching prompt:', error);
        process.exit(1);
      }
      
      // Replace the placeholder with the document content
      const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', document.raw_content);
      Logger.info(`Customized prompt length: ${customizedPrompt.length} characters`);
      
      // Call Claude
      Logger.info('Sending prompt to Claude...');
      let summaryResponse: string;
      try {
        summaryResponse = await claudeService.sendPrompt(customizedPrompt);
        Logger.info(`Received response from Claude (${summaryResponse.length} characters)`);
        
        // Save raw response to a file for debugging
        console.log(`Output path: ${options.output}`);
        const outputDir = process.cwd();
        console.log(`Current working directory: ${outputDir}`);
        const rawResponsePath = path.join(outputDir, `${options.output}-raw.txt`);
        console.log(`Writing raw response to: ${rawResponsePath}`);
        fs.writeFileSync(rawResponsePath, summaryResponse);
        Logger.info(`Raw Claude response saved to ${rawResponsePath}`);
      } catch (claudeError) {
        Logger.error(`Error calling Claude: ${claudeError instanceof Error ? claudeError.message : 'Unknown error'}`);
        // Save the customized prompt for debugging
        const outputDir = process.cwd();
        const promptPath = path.join(outputDir, `${options.output}-prompt.txt`);
        console.log(`Writing prompt to: ${promptPath}`);
        fs.writeFileSync(promptPath, customizedPrompt);
        Logger.info(`Prompt saved to ${promptPath}`);
        process.exit(1);
      }
      
      // Extract JSON if wrapped in code blocks
      let jsonString = summaryResponse;
      const jsonMatch = summaryResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
        Logger.info('Extracted JSON from markdown code block');
      } else {
        Logger.warn('No JSON code block found, attempting to parse the entire response');
      }
      
      // Try to parse the JSON
      let parsedJson;
      try {
        parsedJson = JSON.parse(jsonString);
        Logger.info('Successfully parsed JSON response');
        Logger.info(`JSON has keys: ${Object.keys(parsedJson).join(', ')}`);
        
        // Extract title
        const title = parsedJson.title || document.title || 'Untitled';
        Logger.info(`Extracted title: "${title}"`);
        
        // Format the JSON nicely
        const formattedJson = JSON.stringify(parsedJson, null, 2);
        
        // Save formatted JSON to output file
        const outputDir = process.cwd();
        const outputPath = path.join(outputDir, options.output);
        console.log(`Writing formatted JSON to: ${outputPath}`);
        fs.writeFileSync(outputPath, formattedJson);
        Logger.info(`Formatted JSON saved to ${outputPath}`);
        
        // Save to database if requested
        if (options.save) {
          Logger.info('Saving results to database...');
          const { data: updatedDoc, error: updateError } = await supabase
            .from('expert_documents')
            .update({
              processed_content: formattedJson,
              title: title,
              ai_summary_status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', documentId)
            .select();
          
          if (updateError) {
            Logger.error(`Error updating document: ${updateError.message}`);
          } else {
            Logger.info('Successfully updated document in database');
          }
        } else {
          Logger.info('Skipping database update (--save flag not provided)');
        }
        
      } catch (jsonError) {
        Logger.error(`Failed to parse JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
        Logger.info('Saving problematic response for inspection');
        const outputDir = process.cwd();
        const errorPath = path.join(outputDir, `${options.output}-error.txt`);
        console.log(`Writing error content to: ${errorPath}`);
        fs.writeFileSync(errorPath, jsonString);
      }
      
    } catch (error) {
      Logger.error('Error in test-process-document command:', error);
      process.exit(1);
    }
  });