import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';
import * as fs from 'fs';
import * as path from 'path';
// Use require for chalk to avoid ESM compatibility issues
const chalk = require('chalk');

// Create a new command
export const processMp4FilesCommand = new Command('process-mp4-files');

// Helper function to write debug logs and also output to console
function writeDebugLog(message: string) {
  const logPath = '/Users/raybunnage/Documents/github/dhg-mono/logs/process-mp4-debug.log';
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  try {
    fs.appendFileSync(logPath, logMessage);
    // Also log to console for visibility
    console.log(`DEBUG: ${message}`);
  } catch (error) {
    console.error(`Failed to write to debug log: ${error}`);
  }
}

// Set command description and options
processMp4FilesCommand
  .description('Process MP4 files in sources_google, find related expert_documents, and generate AI summaries')
  .option('-d, --document-id <id>', 'Specific expert document ID to process (for testing)')
  .option('-l, --limit <limit>', 'Maximum number of MP4 files to process (default: 5)', '5')
  .option('-b, --batch-size <size>', 'Number of files to process in each batch (default: 3)', '3')
  .option('-c, --concurrency <num>', 'Number of files to process concurrently (default: 1)', '1')
  .option('--dry-run', 'Preview processing without saving to database', false)
  .option('-o, --output <path>', 'Output file path for the JSON results (default: mp4-processing-results.json)', 'mp4-processing-results.json')
  .action(async (options: any) => {
    // Print clear start message to the console
    console.log(`\n===== STARTING PROCESS-MP4-FILES COMMAND =====`);
    console.log(`Options: ${JSON.stringify(options, null, 2)}\n`);
    
    // Write to debug log
    writeDebugLog(`Action handler started with options: ${JSON.stringify(options)}`);
    try {
      Logger.info('Starting MP4 files processing command');
      
      // Get supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      const promptQueryService = PromptQueryService.getInstance();
      
      // Get the summary prompt from the database
      console.log('Fetching video summary prompt from database...');
      let promptTemplate = '';
      
      try {
        // Load from database
        const { prompt: summaryPrompt } = await promptQueryService.getPromptWithQueryResults('final_video-summary-prompt');
        
        if (summaryPrompt) {
          console.log(`Found prompt in database: ${summaryPrompt.name}`);
          console.log(`Raw content length: ${summaryPrompt.content?.length || 0} characters`);
          
          // Handle possible JSON serialization in the database content
          if (typeof summaryPrompt.content === 'string') {
            // Check if content is a JSON string that needs parsing
            if (summaryPrompt.content.startsWith('"') || summaryPrompt.content.includes('\\n')) {
              try {
                // Try to parse as JSON string
                const parsedContent = JSON.parse(summaryPrompt.content);
                if (typeof parsedContent === 'string') {
                  console.log(`Parsed JSON string successfully, using parsed content`);
                  promptTemplate = parsedContent;
                } else {
                  console.log(`Parsed JSON but result is not a string, using raw content`);
                  promptTemplate = summaryPrompt.content;
                }
              } catch (parseErr) {
                console.log(`Content looks like JSON but failed to parse, using as-is`);
                promptTemplate = summaryPrompt.content;
              }
            } else {
              // Not JSON encoded, use as-is
              console.log(`Using prompt content as-is`);
              promptTemplate = summaryPrompt.content;
            }
          }
          
          // Check for problematic content
          if (promptTemplate.includes('Jane Smith')) {
            console.warn(`⚠️ WARNING: Prompt contains Jane Smith example - this may affect the summary!`);
          }
        }
      } catch (dbError) {
        console.error(`Error getting prompt from database: ${dbError}`);
        console.log('Falling back to file prompt...');
        
        // Fallback to file if database fails
        try {
          const promptFilePath = '/Users/raybunnage/Documents/github/dhg-mono/prompts/final_video-summary-prompt.md';
          promptTemplate = fs.readFileSync(promptFilePath, 'utf8');
          console.log(`Successfully loaded fallback prompt from file`);
        } catch (fileError) {
          console.error('Error loading fallback prompt file:', fileError);
          process.exit(1);
        }
      }
      
      // Verify we have a prompt template
      if (!promptTemplate) {
        console.error('Failed to get prompt template');
        process.exit(1);
      }
      
      console.log(`Final prompt length: ${promptTemplate.length} characters`);
      console.log(`Prompt starts with: ${promptTemplate.substring(0, 100)}...`);

      // If document ID is provided, process just that one document directly
      if (options.documentId) {
        Logger.info(chalk.blue(`==========================================`));
        Logger.info(chalk.blue(`Processing single expert document with ID: ${options.documentId}`));
        Logger.info(chalk.blue(`==========================================`));
        
        // First, get the document to see what we're working with
        const supabase = SupabaseClientService.getInstance().getClient();
        const { data: doc, error: docErr } = await supabase
          .from('expert_documents')
          .select('id, title, document_type_id, source_id, raw_content')
          .eq('id', options.documentId)
          .single();
          
        if (docErr) {
          Logger.error(`Failed to fetch document: ${docErr.message}`);
          return;
        }
        
        Logger.info(`Document found - Title: "${doc.title || 'No title'}"`);
        Logger.info(`Document Type ID: ${doc.document_type_id}`);
        Logger.info(`Source ID: ${doc.source_id}`);
        Logger.info(`Raw Content Length: ${doc.raw_content?.length || 0} characters`);
        Logger.info(`Raw Content Preview: ${doc.raw_content?.substring(0, 200).replace(/\n/g, ' ')}...`);
        Logger.info(chalk.blue(`-----------------------------------------`));
        
        const result = await processSingleDocument(options.documentId, promptTemplate, options);
        
        if (result.success) {
          Logger.info(chalk.green('Successfully processed expert document'));
          Logger.info(`Title: ${result.new_title}`);
          Logger.info(`JSON keys: ${Object.keys(result.ai_result).join(', ')}`);
          
          if (options.output) {
            fs.writeFileSync(path.resolve(options.output), JSON.stringify(result, null, 2));
            Logger.info(`Results saved to ${options.output}`);
          }
        } else {
          Logger.error(`Failed to process expert document: ${result.error}`);
        }
        
        return;
      }
      
      // Find MP4 files in sources_google
      const batchSize = parseInt(options.batchSize, 10);
      const totalLimit = parseInt(options.limit, 10);
      let processed = 0;
      let results: any[] = [];
      
      Logger.info(`Will process up to ${totalLimit} MP4 files in batches of ${batchSize}`);
      
      while (processed < totalLimit) {
        // Get a batch of MP4 files
        const batchLimit = Math.min(batchSize, totalLimit - processed);
        const batch = await getNextBatchOfMp4Files(batchLimit);
        
        if (batch.length === 0) {
          Logger.info('No more MP4 files to process');
          break;
        }
        
        Logger.info(`Processing batch of ${batch.length} MP4 files`);
        
        // Process each file in the batch
        for (const file of batch) {
          Logger.info(`Processing MP4 file: ${file.name} (${file.id})`);
          
          // Find related expert document
          const expertDocument = await findExpertDocumentForSource(file.id);
          
          if (!expertDocument) {
            Logger.warn(`No expert document found for source ID: ${file.id}`);
            results.push({
              source_id: file.id,
              source_name: file.name,
              processed: false,
              error: 'No expert document found'
            });
            continue;
          }
          
          Logger.info(`Found expert document: ${expertDocument.id}`);
          
          // Process document
          const result = await processSingleDocument(expertDocument.id, promptTemplate, options);
          
          if (result.success) {
            Logger.info(chalk.green(`Successfully processed document for ${file.name}`));
          } else {
            Logger.error(`Failed to process document for ${file.name}: ${result.error}`);
          }
          
          results.push({
            source_id: file.id,
            source_name: file.name,
            expert_document_id: expertDocument.id,
            processed: result.success,
            error: result.error || null,
            title_updated: result.title_updated || false,
            ai_result: result.ai_result || null
          });
        }
        
        processed += batch.length;
        Logger.info(`Processed ${processed}/${totalLimit} MP4 files`);
        
        // Save intermediate results
        if (options.output) {
          fs.writeFileSync(path.resolve(options.output), JSON.stringify(results, null, 2));
          Logger.info(`Intermediate results saved to ${options.output}`);
        }
        
        // Break if fewer records returned than batch limit
        if (batch.length < batchLimit) {
          break;
        }
      }
      
      // Display summary
      const successCount = results.filter(r => r.processed).length;
      const titleUpdatedCount = results.filter(r => r.title_updated).length;
      const errorCount = results.filter(r => !r.processed).length;
      
      Logger.info(chalk.green(`\nProcessing complete. Processed ${processed} MP4 files.`));
      Logger.info(`${successCount} documents processed successfully`);
      Logger.info(`${titleUpdatedCount} documents had titles updated`);
      Logger.info(`${errorCount} documents had processing errors`);
      
      if (options.dryRun) {
        Logger.info(chalk.yellow('\nThis was a dry run. No changes were made to the database.'));
      }
      
    } catch (error) {
      Logger.error('Error in process-mp4-files command:', error);
      process.exit(1);
    }
  });

/**
 * Get the next batch of MP4 files from sources_google
 */
async function getNextBatchOfMp4Files(limit: number): Promise<any[]> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Find MP4 files that don't have .mp4 in the name but mime_type is video/mp4
  const { data, error } = await supabase
    .from('sources_google')
    .select('id, name, mime_type, drive_id, path, web_view_link')
    .eq('mime_type', 'video/mp4')
    .not('name', 'ilike', '%.mp4')
    .is('is_deleted', false)
    .order('modified_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    Logger.error('Error fetching MP4 files:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Find the expert document for a given source ID
 */
async function findExpertDocumentForSource(sourceId: string): Promise<any> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  const { data, error } = await supabase
    .from('expert_documents')
    .select('id, raw_content, processed_content, title, document_type_id, ai_summary_status')
    .eq('source_id', sourceId)
    .maybeSingle();
  
  if (error) {
    Logger.error(`Error finding expert document for source ${sourceId}:`, error);
    return null;
  }
  
  return data;
}

/**
 * Process a single expert document
 */
async function processSingleDocument(documentId: string, promptTemplate: string, options: any): Promise<any> {
  console.log(`\n==== PROCESSING DOCUMENT: ${documentId} ====`);
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    console.log(`Fetching expert document from Supabase...`);
    // Get the full expert document including raw_content
    const { data: expertDoc, error } = await supabase
      .from('expert_documents')
      .select('id, raw_content, processed_content, title, document_type_id, ai_summary_status')
      .eq('id', documentId)
      .single();
      
    if (error || !expertDoc) {
      console.error(`ERROR: Failed to fetch expert document: ${error?.message || 'Document not found'}`);
      return {
        success: false,
        error: `Error fetching expert document: ${error?.message || 'Document not found'}`
      };
    }
    
    console.log(`Successfully fetched document. Title: "${expertDoc.title || 'No title'}"`);
    console.log(`Raw content length: ${expertDoc.raw_content?.length || 0} characters`);
    console.log(`Document type ID: ${expertDoc.document_type_id}`);
    console.log(`AI summary status: ${expertDoc.ai_summary_status || 'Not set'}`);
    
    
    // Check if document has raw content
    if (!expertDoc.raw_content) {
      return {
        success: false,
        error: 'Expert document has no raw content'
      };
    }
    
    // Check if already processed and has a title (unless force option is used)
    if (expertDoc.processed_content && expertDoc.title && !options.force) {
      return {
        success: true,
        already_processed: true,
        title_updated: false,
        message: 'Document already has processed content and title'
      };
    }
    
    // Create debug directory
    const debugDir = path.resolve(__dirname, '../debug-output');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Save the raw transcript content for debugging
    const rawContentPath = path.resolve(debugDir, `raw-content-${documentId.substring(0, 8)}.txt`);
    fs.writeFileSync(rawContentPath, expertDoc.raw_content);
    writeDebugLog(`Saved raw content to ${rawContentPath} (${expertDoc.raw_content.length} characters)`);
    
    // Extract the actual transcript content (first 4000 chars) for logging
    const previewContent = expertDoc.raw_content.length > 4000 
        ? expertDoc.raw_content.substring(0, 4000) + "...(truncated)"
        : expertDoc.raw_content;
    writeDebugLog(`Processing transcript starts with: ${previewContent.substring(0, 200).replace(/\n/g, ' ')}...`);
    
    // Inject the transcript into the template
    console.log(`Creating customized prompt by injecting transcript...`);
    
    // Handle the different prompt formats for transcript injection
    let customizedPrompt = '';
    
    // Check for {{TRANSCRIPT}} placeholder first (single placeholder)
    if (promptTemplate.includes('{{TRANSCRIPT}}')) {
      console.log(`Found {{TRANSCRIPT}} placeholder, replacing with transcript content`);
      customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', expertDoc.raw_content);
    } 
    // Check for {{TRANSCRIPT START}} and {{TRANSCRIPT END}} markers
    else if (promptTemplate.includes('{{TRANSCRIPT START}}') && promptTemplate.includes('{{TRANSCRIPT END}}')) {
      console.log(`Found {{TRANSCRIPT START/END}} markers, replacing content between them`);
      
      // Find the markers
      const startMarker = '{{TRANSCRIPT START}}';
      const endMarker = '{{TRANSCRIPT END}}';
      
      // Calculate positions
      const startIndex = promptTemplate.indexOf(startMarker);
      const endIndex = promptTemplate.indexOf(endMarker) + endMarker.length;
      
      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        // Replace the section between markers
        const before = promptTemplate.substring(0, startIndex + startMarker.length);
        const after = promptTemplate.substring(promptTemplate.indexOf(endMarker));
        customizedPrompt = before + '\n' + expertDoc.raw_content + '\n' + after;
      } else {
        console.warn(`Markers found but in wrong order, using simple append fallback`);
        customizedPrompt = promptTemplate + '\n\n' + expertDoc.raw_content;
      }
    }
    // No recognized format, just append transcript
    else {
      console.warn(`No transcript placeholders found in prompt, appending transcript at end`);
      customizedPrompt = promptTemplate + '\n\n' + expertDoc.raw_content;
    }
    
    // Save the customized prompt for debugging
    const promptPath = path.resolve(debugDir, `customized-prompt-${documentId.substring(0, 8)}.md`);
    fs.writeFileSync(promptPath, customizedPrompt);
    console.log(`Injected raw transcript (${expertDoc.raw_content?.length || 0} characters) into prompt template`);
    console.log(`Saved customized prompt to: ${promptPath}`);
    
    // Log transcript information for verification
    if (expertDoc.raw_content?.length > 0) {
      console.log(`Transcript preview (first 200 chars): ${expertDoc.raw_content.substring(0, 200)}...`);
    } else {
      console.warn(`WARNING: Raw content is empty!`);
    }
    
    // Verify no example transcript remains
    if (customizedPrompt.includes('Jane Smith')) {
      console.warn(`⚠️ WARNING: 'Jane Smith' example text detected in final prompt - may affect results!`);
    }
    
    
    Logger.info('Generating summary using Claude...');
    
    let summaryResponse: string;
    try {
      // Call Claude API to generate JSON summary
      writeDebugLog(`Calling Claude API for document ${documentId} using getJsonResponse...`);
      
      let parsedJson;
      
      // Use the getJsonResponse method to get structured JSON
      try {
        // Call Claude API to generate structured JSON from the transcript
        console.log(`\n=== CALLING CLAUDE API ===`);
        console.log(`Sending transcript to Claude for JSON summary generation...`);
        
        const jsonResult = await claudeService.getJsonResponse(customizedPrompt, {
          jsonMode: true,
          temperature: 0
        });
        
        // Log the successfully received response
        console.log(`\n=== CLAUDE API RESPONSE RECEIVED ===`);
        console.log(`Successfully received JSON response with keys: ${Object.keys(jsonResult).join(', ')}`);
        
        // Save the JSON response for reference
        const jsonResponsePath = path.resolve(debugDir, `claude-json-${documentId.substring(0, 8)}.json`);
        fs.writeFileSync(jsonResponsePath, JSON.stringify(jsonResult, null, 2));
        console.log(`Saved JSON response to: ${jsonResponsePath}`);
        
        // Use the structured JSON result
        parsedJson = jsonResult;
        summaryResponse = JSON.stringify(jsonResult);
        
        // Log key fields from the response
        console.log(`\n=== GENERATED SUMMARY DETAILS ===`);
        console.log(`Title: "${parsedJson.title}"`);
        console.log(`Speaker: ${parsedJson.speakerProfile?.name} (${parsedJson.speakerProfile?.title})`);
        console.log(`Core Topic: ${parsedJson.presentationEssence?.coreTopic}`);
        console.log(`Key Takeaways: ${parsedJson.keyTakeaways?.length} items`);
        console.log(`Memorable Quotes: ${parsedJson.memorableQuotes?.length} items`);
        console.log(`Target Audience: ${parsedJson.whyWatch?.targetAudience}`);
        console.log(`Summary Length: ${parsedJson.summary?.length || 0} characters`);
        
      } catch (jsonApiError) {
        // Log the error
        const errorMessage = jsonApiError instanceof Error ? jsonApiError.message : 'Unknown error';
        console.error(`\n=== ERROR CALLING CLAUDE API ===`);
        console.error(`JSON API call failed: ${errorMessage}`);
        
        // Return failure
        return {
          success: false,
          error: `Failed to generate JSON from transcript: ${errorMessage}`
        };
      }
      
      // Format the JSON nicely for storage
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      
      // Extract title from the JSON
      const title = parsedJson.title || expertDoc.title || 'Untitled';
      writeDebugLog(`Using title for update: "${title}" (original title: "${expertDoc.title || 'None'}")`);
      
      // Save the final processed JSON content to be stored
      const finalJsonPath = path.resolve(debugDir, `final-json-${documentId.substring(0, 8)}.json`);
      fs.writeFileSync(finalJsonPath, formattedJson);
      writeDebugLog(`Saved final formatted JSON to ${finalJsonPath} (${formattedJson.length} characters)`);
      
      // If dry run, return the result without saving
      if (options.dryRun) {
        console.log(`\n=== DRY RUN - NO DATABASE UPDATES ===`);
        console.log(`Would update document ${documentId} with new title: "${title}"`);
        console.log(`Would update processed_content with JSON (${formattedJson.length} characters)`);
        console.log(`Would set ai_summary_status to 'completed'`);
        
        return {
          success: true,
          dry_run: true,
          title_updated: title !== expertDoc.title,
          new_title: title,
          old_title: expertDoc.title,
          ai_result: parsedJson
        };
      }
      
      // Update the document with the processed content and title
      console.log(`\n=== UPDATING DATABASE ===`);
      console.log(`Updating document ${documentId} with:`);
      console.log(` - New title: "${title}"`);
      console.log(` - Processed content: ${formattedJson.length} characters`);
      console.log(` - AI summary status: 'completed'`);
      
      const updateData = {
        processed_content: formattedJson,
        title: title,
        ai_summary_status: 'completed',
        updated_at: new Date().toISOString()
      };
      
      console.log(`Sending update to Supabase...`);
      const { data: updatedDoc, error: updateError } = await supabase
        .from('expert_documents')
        .update(updateData)
        .eq('id', documentId)
        .select();
      
      if (updateError) {
        console.error(`ERROR updating document: ${updateError.message}`);
        return {
          success: false,
          error: `Error updating expert document: ${updateError.message}`,
          ai_result: parsedJson
        };
      }
      
      // Update successful
      console.log(`Update successful!`);
      
      // Verify by fetching the document again
      console.log(`Verifying update by fetching updated document...`);
      const { data: verifyDoc, error: verifyError } = await supabase
        .from('expert_documents')
        .select('id, title, processed_content')
        .eq('id', documentId)
        .single();
        
      if (verifyError) {
        console.log(`Warning: Could not verify update: ${verifyError.message}`);
      } else {
        console.log(`Verification successful:`);
        console.log(` - Updated title: "${verifyDoc.title}"`);
        console.log(` - Updated processed_content length: ${verifyDoc.processed_content?.length || 0} characters`);
      }
      
      console.log(`\n=== PROCESSING COMPLETE ===`);
      console.log(`Successfully generated AI summary and updated document "${title}"`);
      
      return {
        success: true,
        title_updated: title !== expertDoc.title,
        new_title: title,
        old_title: expertDoc.title,
        ai_result: parsedJson
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      writeDebugLog(`ERROR in Claude API or processing: ${errorMessage}`);
      
      // Save error details to debug file
      const errorPath = path.resolve(debugDir, `error-${documentId.substring(0, 8)}.txt`);
      fs.writeFileSync(errorPath, `Error processing document ${documentId}:\n${errorMessage}\n\nTimestamp: ${new Date().toISOString()}`);
      
      // Update status to error if Claude API call fails
      writeDebugLog(`Updating document ${documentId} status to 'error'`);
      try {
        const { error: updateError } = await supabase
          .from('expert_documents')
          .update({
            ai_summary_status: 'error',
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId);
          
        if (updateError) {
          writeDebugLog(`ERROR updating error status: ${updateError.message}`);
        } else {
          writeDebugLog(`Successfully updated status to 'error'`);
        }
      } catch (updateError) {
        writeDebugLog(`EXCEPTION updating error status: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
      }
      
      return {
        success: false,
        error: `Error generating summary with Claude: ${errorMessage}`
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    writeDebugLog(`UNEXPECTED ERROR processing document ${documentId}: ${errorMessage}`);
    
    // Create debug directory if it doesn't exist yet
    const debugDir = path.resolve(__dirname, '../debug-output');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Save error details
    const fatalErrorPath = path.resolve(debugDir, `fatal-error-${documentId.substring(0, 8)}.txt`);
    fs.writeFileSync(fatalErrorPath, `Fatal error processing document ${documentId}:\n${errorMessage}\n\nTimestamp: ${new Date().toISOString()}`);
    
    return {
      success: false,
      error: `Unexpected error: ${errorMessage}`
    };
  }
}