import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';
import * as fs from 'fs';
import * as path from 'path';
// Let's skip using chalk since it's causing compatibility issues
// and just use plain text output
const chalk = {
  green: (text: string) => text,
  yellow: (text: string) => text,
  red: (text: string) => text
};

// Helper function to write debug logs
function writeDebugLog(message: string) {
  const logPath = '/Users/raybunnage/Documents/github/dhg-mono/logs/process-mp4-debug.log';
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (error) {
    console.error(`Failed to write to debug log: ${error}`);
  }
}

export async function processMp4FilesAction(options: any) {
  try {
    writeDebugLog(`Action handler started with options: ${JSON.stringify(options)}`);
    console.log(`DEBUG: Action handler started with options: ${JSON.stringify(options)}`);
    
    Logger.info('Starting MP4 files processing command');
    
    // Get supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    const promptQueryService = PromptQueryService.getInstance();
    
    // Get the summary prompt from the database with proper error handling
    Logger.info('Fetching video summary prompt from database...');
    let promptTemplate = '';
    let promptLoaded = false;
    
    // Create a debug directory for detailed debugging output
    const debugDir = path.resolve(__dirname, '../debug-output');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    try {
      // Fetch the prompt from the database using the PromptQueryService
      writeDebugLog(`Attempting to load prompt 'final_video-summary-prompt' from database`);
      const promptResult = await promptQueryService.getPromptWithQueryResults('final_video-summary-prompt');
      
      if (promptResult.error) {
        writeDebugLog(`Error loading prompt: ${promptResult.error}`);
        Logger.warn(`Error loading prompt: ${promptResult.error}`);
      }
      
      if (promptResult.prompt) {
        promptTemplate = promptResult.prompt.content;
        promptLoaded = true;
        writeDebugLog(`Successfully loaded prompt from database: ${promptResult.prompt.name}`);
        Logger.info(`Found prompt: ${promptResult.prompt.name}`);
        
        // Save the prompt to a debug file
        const promptDebugPath = path.resolve(debugDir, 'prompt-template.md');
        fs.writeFileSync(promptDebugPath, promptTemplate);
        Logger.info(`Saved prompt template to ${promptDebugPath} for inspection`);
      }
    } catch (promptError) {
      writeDebugLog(`Exception loading prompt: ${promptError instanceof Error ? promptError.message : 'Unknown error'}`);
      Logger.warn(`Could not get prompt from database due to exception: ${promptError instanceof Error ? promptError.message : 'Unknown error'}`);
    }
    
    // Use a fallback prompt if database load failed
    if (!promptLoaded) {
      Logger.warn('Using fallback prompt template for JSON generation');
      writeDebugLog('Using fallback prompt template');
      
      promptTemplate = `# Expert Video Summary Generation Prompt

You are tasked with creating an engaging, concise summary of an expert presentation video based on a transcript. Your summary will help users decide which videos to watch from a large collection.

## Output Format
Create a JSON object with the following structure:

\`\`\`json
{
  "title": "Clear, concise title that captures the essence of the presentation",
  "speakerProfile": {
    "name": "Full name of the speaker",
    "title": "Professional title or role",
    "expertise": "Brief description of expertise and what makes them valuable"
  },
  "presentationEssence": {
    "coreTopic": "Main subject or focus of the presentation",
    "uniqueApproach": "What makes this presentation's perspective distinctive",
    "problemAddressed": "Problem being addressed or opportunity explored",
    "insightSummary": "Summary of the core insight or message"
  },
  "keyTakeaways": [
    "First key insight or actionable advice",
    "Second key insight or actionable advice",
    "Third key insight or actionable advice",
    "Fourth key insight or actionable advice (optional)"
  ],
  "memorableQuotes": [
    {
      "quote": "Direct quote from the speaker",
      "context": "Brief context for the quote"
    },
    {
      "quote": "Another direct quote (optional)",
      "context": "Brief context for the second quote"
    }
  ],
  "discussionHighlights": {
    "exchanges": "Notable exchanges or insights from Q&A",
    "challenges": "Interesting challenges or debates that emerged",
    "additionalContext": "Any additional context from the discussion"
  },
  "whyWatch": {
    "targetAudience": "Who would benefit most from this presentation",
    "uniqueValue": "What distinguishes this from other videos on similar topics"
  },
  "summary": "A vibrant, informative 200-300 word summary that captures the overall presentation, combining elements from all sections above in an engaging narrative format"
}
\`\`\`

IMPORTANT: Respond with ONLY valid JSON. Do not include any text outside the JSON object.

TRANSCRIPT:
{{TRANSCRIPT}}`;

      // Save the fallback prompt for debugging
      const fallbackPath = path.resolve(debugDir, 'fallback-prompt.md');
      fs.writeFileSync(fallbackPath, promptTemplate);
      Logger.info(`Saved fallback prompt to ${fallbackPath} for inspection`);
    }
    
    // Verify we have a prompt template
    if (!promptTemplate) {
      Logger.error('Failed to get prompt template from database and fallback failed');
      process.exit(1);
    }

    // If document ID is provided, process just that one document directly
    if (options.documentId) {
      Logger.info(`Processing single expert document with ID: ${options.documentId}`);
      const result = await processSingleDocument(options.documentId, promptTemplate, options);
      
      if (result.success) {
        Logger.info(chalk.green('Successfully processed expert document'));
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
}

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
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    writeDebugLog(`Processing document ${documentId}`);
    
    // Get the full expert document including raw_content
    const { data: expertDoc, error } = await supabase
      .from('expert_documents')
      .select('id, raw_content, processed_content, title, document_type_id, ai_summary_status')
      .eq('id', documentId)
      .single();
      
    if (error || !expertDoc) {
      writeDebugLog(`Error fetching expert document: ${error?.message || 'Document not found'}`);
      return {
        success: false,
        error: `Error fetching expert document: ${error?.message || 'Document not found'}`
      };
    }
    
    // Check if document has raw content
    if (!expertDoc.raw_content) {
      writeDebugLog(`Expert document has no raw content`);
      return {
        success: false,
        error: 'Expert document has no raw content'
      };
    }
    
    // Check if already processed and has a title (unless force option is used)
    if (expertDoc.processed_content && expertDoc.title && !options.force) {
      writeDebugLog(`Document already has processed content and title`);
      return {
        success: true,
        already_processed: true,
        title_updated: false,
        message: 'Document already has processed content and title'
      };
    }
    
    // Replace the placeholder in the prompt with the document content
    const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', expertDoc.raw_content);
    
    Logger.info('Generating summary using Claude...');
    
    // Save content and customized prompt for debugging in the correct debug directory
    const debugDir = path.resolve(__dirname, '../debug-output');
    // Ensure debug directory exists
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const debugContentPath = path.resolve(debugDir, `raw-content-${documentId.substring(0, 8)}.txt`);
    const debugPromptPath = path.resolve(debugDir, `customized-prompt-${documentId.substring(0, 8)}.md`);
    
    // Write files with truncated content if too large
    if (expertDoc.raw_content) {
      const contentPreview = expertDoc.raw_content.length > 5000 
        ? expertDoc.raw_content.substring(0, 5000) + "\n\n... [Content truncated for debug file] ..."
        : expertDoc.raw_content;
      fs.writeFileSync(debugContentPath, contentPreview);
      writeDebugLog(`Saved content preview to ${debugContentPath}`);
    }
    
    fs.writeFileSync(debugPromptPath, customizedPrompt);
    writeDebugLog(`Saved customized prompt to ${debugPromptPath}`);
    
    // Use proper JSON response method
    try {
      writeDebugLog(`Calling Claude API with jsonMode enabled to get structured response`);
      Logger.info(`Calling Claude to generate JSON summary (this might take a moment)...`);
      
      // Use getJsonResponse which is specifically designed for JSON output
      const jsonResponse = await claudeService.getJsonResponse(customizedPrompt, {
        jsonMode: true,  // Enforce JSON-only output
        temperature: 0,  // Use 0 temperature for most consistent JSON structure
        system: "You are a helpful AI assistant that ONLY responds with valid JSON. Do not include any text before or after the JSON object."
      });
      
      // Log the JSON response for debugging
      const responsePreview = JSON.stringify(jsonResponse).substring(0, 200);
      writeDebugLog(`Claude returned valid JSON response: ${responsePreview}...`);
      
      // Save the full JSON response for inspection
      const jsonResponsePath = path.resolve(debugDir, `claude-json-${documentId.substring(0, 8)}.json`);
      fs.writeFileSync(jsonResponsePath, JSON.stringify(jsonResponse, null, 2));
      writeDebugLog(`Saved complete JSON response to ${jsonResponsePath}`);
      
      // Assign the parsed JSON from the validated response
      const parsedJson = jsonResponse;
      
      // Format the JSON nicely for storage
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      
      // Extract title from the JSON
      const title = parsedJson.title || expertDoc.title || 'Untitled';
      
      // If dry run, return the result without saving
      if (options.dryRun) {
        Logger.info(chalk.yellow(`[DRY RUN] Would update document ${documentId} with new title: ${title}`));
        Logger.info(chalk.yellow(`[DRY RUN] Would update processed_content with Claude's JSON response`));
        
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
        writeDebugLog(`Error updating expert document: ${updateError.message}`);
        return {
          success: false,
          error: `Error updating expert document: ${updateError.message}`,
          ai_result: parsedJson
        };
      }
      
      return {
        success: true,
        title_updated: title !== expertDoc.title,
        new_title: title,
        old_title: expertDoc.title,
        ai_result: parsedJson
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      writeDebugLog(`Error generating summary with Claude: ${errorMessage}`);
      Logger.error(`Claude API error: ${errorMessage}`);
      
      // Save the error to a debug file
      const errorPath = path.resolve(debugDir, `error-${documentId.substring(0, 8)}.txt`);
      fs.writeFileSync(errorPath, `Error generating summary with Claude: ${errorMessage}\n\nTimestamp: ${new Date().toISOString()}`);
      
      // Update document status to error
      await supabase
        .from('expert_documents')
        .update({
          ai_summary_status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);
      
      return {
        success: false,
        error: `Error generating summary with Claude: ${errorMessage}`
      };
    }
  } catch (error) {
    writeDebugLog(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}