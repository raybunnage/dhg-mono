import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
import { PromptService } from '../../../../packages/shared/services/prompt-service';
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
    const promptService = PromptService.getInstance();
    
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
      const promptResult = await promptService.loadPrompt('final_video-summary-prompt');
      
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
    const concurrency = parseInt(options.concurrency || '1', 10);
    let processed = 0;
    let results: any[] = [];
    
    Logger.info(`Will process up to ${totalLimit} MP4 files in batches of ${batchSize} with concurrency ${concurrency}`);
    
    // Simple concurrency limiter
    const processConcurrently = async <T, R>(
      items: T[],
      fn: (item: T) => Promise<R>,
      maxConcurrent: number
    ): Promise<R[]> => {
      const results: R[] = [];
      const inProgress: Promise<void>[] = [];
      const itemsCopy = [...items]; // Create a copy to avoid modifying the original
      
      const executeNext = async (): Promise<void> => {
        if (itemsCopy.length === 0) return;
        
        const item = itemsCopy.shift()!;
        try {
          const result = await fn(item);
          results.push(result);
        } catch (error) {
          Logger.error(`Error in concurrent execution: ${error}`);
          // Still count as a result to maintain correct order
          results.push(null as unknown as R);
        }
        
        // Process next item if there are any left
        if (itemsCopy.length > 0) {
          await executeNext();
        }
      };
      
      // Start up to maxConcurrent tasks
      for (let i = 0; i < Math.min(maxConcurrent, items.length); i++) {
        inProgress.push(executeNext());
      }
      
      // Wait for all tasks to complete
      await Promise.all(inProgress);
      return results;
    };
    
    while (processed < totalLimit) {
      // Get a batch of MP4 files
      const batchLimit = Math.min(batchSize, totalLimit - processed);
      const batch = await getNextBatchOfMp4Files(batchLimit, options.force);
      
      if (batch.length === 0) {
        Logger.info('No more MP4 files to process');
        break;
      }
      
      Logger.info(`Processing batch of ${batch.length} MP4 files with concurrency ${concurrency}`);
      
      // Process files concurrently with our limiter
      const batchResults = await processConcurrently(
        batch,
        async (file) => {
          Logger.info(`Processing MP4 file: ${file.name} (${file.id})`);
          
          // Verify file mime type is actually MP4
          if (file.mime_type !== 'video/mp4') {
            Logger.warn(`Skipping file: ${file.name} - Not an MP4 file (mime type: ${file.mime_type})`);
            return {
              source_id: file.id,
              source_name: file.name,
              processed: false,
              error: 'Not an MP4 file'
            };
          }
          
          // Find related expert document
          const expertDocument = await findExpertDocumentForSource(file.id);
          
          if (!expertDocument) {
            Logger.warn(`No expert document found for source ID: ${file.id}`);
            return {
              source_id: file.id,
              source_name: file.name,
              processed: false,
              error: 'No expert document found'
            };
          }
          
          // Check if document has raw_content
          if (!expertDocument.raw_content) {
            Logger.warn(`Skipping document: ${expertDocument.id} - No raw content found`);
            return {
              source_id: file.id,
              source_name: file.name,
              expert_document_id: expertDocument.id,
              processed: false,
              error: 'Document has no raw content'
            };
          }
          
          Logger.info(`Found expert document: ${expertDocument.id} with raw content (${expertDocument.raw_content.length} bytes)`);
          
          // Process document
          const result = await processSingleDocument(expertDocument.id, promptTemplate, options);
          
          if (result.success) {
            Logger.info(chalk.green(`Successfully processed document for ${file.name}`));
          } else {
            Logger.error(`Failed to process document for ${file.name}: ${result.error}`);
          }
          
          return {
            source_id: file.id,
            source_name: file.name,
            expert_document_id: expertDocument.id,
            processed: result.success,
            error: result.error || null,
            title_updated: result.title_updated || false,
            ai_result: result.ai_result || null
          };
        },
        concurrency
      );
      
      // Add batch results to overall results
      results = results.concat(batchResults.filter(r => r !== null));
      
      processed += batch.length;
      Logger.info(`Processed ${processed}/${totalLimit} MP4 files`);
      
      // Count files by error type for this batch
      const batchWithNoRawContent = batchResults.filter(r => r && !r.processed && r.error === 'Document has no raw content').length;
      const batchWithNoExpertDoc = batchResults.filter(r => r && !r.processed && r.error === 'No expert document found').length;
      
      // Log the specific issues we're encountering
      if (batchWithNoRawContent > 0) {
        Logger.warn(`${batchWithNoRawContent} files in this batch had no raw content in their expert documents`);
      }
      
      if (batchWithNoExpertDoc > 0) {
        Logger.warn(`${batchWithNoExpertDoc} files in this batch had no associated expert documents`);
      }
      
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
    
    // Get count of specific errors
    const noRawContentCount = results.filter(r => !r.processed && r.error === 'Document has no raw content').length;
    const noExpertDocCount = results.filter(r => !r.processed && r.error === 'No expert document found').length;
    const notMp4Count = results.filter(r => !r.processed && r.error === 'Not an MP4 file').length;
    
    Logger.info(chalk.green(`\nProcessing complete. Processed ${processed} MP4 files.`));
    Logger.info(`${successCount} documents processed successfully`);
    Logger.info(`${titleUpdatedCount} documents had titles updated`);
    Logger.info(`${errorCount} documents had processing errors`);
    
    // Display detailed error breakdown
    if (errorCount > 0) {
      Logger.info(`\nError breakdown:`);
      if (noRawContentCount > 0) Logger.info(`- ${noRawContentCount} documents had no raw content`);
      if (noExpertDocCount > 0) Logger.info(`- ${noExpertDocCount} documents had no associated expert document`);
      if (notMp4Count > 0) Logger.info(`- ${notMp4Count} documents were not MP4 files`);
      
      const otherErrors = errorCount - (noRawContentCount + noExpertDocCount + notMp4Count);
      if (otherErrors > 0) Logger.info(`- ${otherErrors} documents had other errors`);
      
      Logger.info(`\nTo see all errors in detail, check the output file: ${options.output}`);
    }
    
    if (options.dryRun) {
      Logger.info(chalk.yellow('\nThis was a dry run. No changes were made to the database.'));
    }
    
    // If there were no successful conversions, provide suggestions
    if (successCount === 0 && processed > 0) {
      Logger.info(chalk.yellow('\nTroubleshooting suggestions:'));
      Logger.info('1. Check that your MP4 files have corresponding expert documents');
      Logger.info('2. Ensure expert documents have raw_content populated');
      Logger.info('3. Try processing a specific document with: --document-id <id>');
      Logger.info('4. Consider using --force to reprocess already processed documents');
    }
    
  } catch (error) {
    Logger.error('Error in process-mp4-files command:', error);
    process.exit(1);
  }
}

/**
* Get the next batch of MP4 files from sources_google
*/
async function getNextBatchOfMp4Files(limit: number, force: boolean = false): Promise<any[]> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // DIRECT APPROACH: Find expert documents with raw_content but missing processed_content or title
  // This is exactly what you would process if given a specific document ID
  if (force) {
    Logger.info('FORCE mode: Finding ALL expert documents with raw content (including already processed ones)...');
  } else {
    Logger.info('Finding expert documents with raw content but missing processed content or title...');
  }
  
  // Now we can use the foreign key relationship properly
  // Let's be explicit about finding documents with sources that are MP4 files
  const { data: docsToProcess, error: docsError } = await supabase
    .from('google_expert_documents')
    .select(`
      id,
      title,
      source_id,
      raw_content,
      processed_content,
      sources_google!inner(id, name, mime_type, drive_id, path, web_view_link, is_deleted)
    `)
    .not('raw_content', 'is', null)  // Must have raw content
    .or(force ? 'raw_content.neq.null' : 'processed_content.is.null,title.is.null')  // If force, get all with raw content, otherwise only incomplete
    .not('source_id', 'is', null)  // Must have a source ID
    .eq('sources_google.mime_type', 'video/mp4')  // Only select MP4 files
    .is('sources_google.is_deleted', false)  // That aren't deleted
    .order('created_at', { ascending: false })  // Newest first
    .limit(limit);
    
  // Log what we got to help with debugging
  if (docsToProcess && docsToProcess.length > 0) {
    Logger.info(`First returned document source details: ${JSON.stringify(docsToProcess[0].sources_google || 'No sources', null, 2)}`);
  }
  
  if (docsError) {
    Logger.error(`Error finding documents to process: ${docsError.message}`);
    return [];
  }
  
  if (!docsToProcess || docsToProcess.length === 0) {
    Logger.info('No expert documents with raw content but missing processed content or title found.');
    Logger.info('Use --force to reprocess documents that already have content.');
    return [];
  }
  
  Logger.info(`Found ${docsToProcess.length} documents with raw content that need processing`);
  
  // With the new relationship structure, we can directly filter the documents that have mp4 sources
  const mp4Sources = [];
  
  for (const doc of docsToProcess) {
    // Each doc now has sources_google array or object with the joined records
    const sourceData = doc.sources_google;
    
    // Log what we're seeing to help with debugging
    Logger.info(`Processing doc ${doc.id} with source_id ${doc.source_id}, source data type: ${typeof sourceData}`);
    
    // Skip if no source data
    if (!sourceData) {
      Logger.info(`- No source data found for document ${doc.id}`);
      continue;
    }
    
    // Handle both array and single object response formats
    const source = Array.isArray(sourceData) ? sourceData[0] : sourceData;
    
    if (!source) {
      Logger.info(`- No valid source object for document ${doc.id}`);
      continue;
    }
    
    Logger.info(`- Source ${source.id}: mime_type=${source.mime_type}, is_deleted=${source.is_deleted}`);
    
    if (source.mime_type === 'video/mp4' && source.is_deleted !== true) {
      Logger.info(`- Adding source ${source.id} (${source.name}) to processing list`);
      mp4Sources.push(source);
    }
  }
  
  if (mp4Sources.length === 0) {
    Logger.info('No MP4 files found for the expert documents');
    return [];
  }
  
  Logger.info(`Found ${mp4Sources.length} MP4 files from ${docsToProcess.length} expert documents`);
  
  return mp4Sources;
}

/**
* Find the expert document for a given source ID
*/
async function findExpertDocumentForSource(sourceId: string): Promise<any> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // First, check if there's an expert document with raw content for this source
  const { data: docWithContent, error: contentError } = await supabase
    .from('google_expert_documents')
    .select('id, raw_content, processed_content, title, document_type_id, ai_summary_status')
    .eq('source_id', sourceId)
    .not('raw_content', 'is', null)
    .maybeSingle();
  
  if (docWithContent) {
    Logger.info(`Found expert document with raw content: ${docWithContent.id}`);
    return docWithContent;
  }
  
  // If no document with content found, get any document
  const { data, error } = await supabase
    .from('google_expert_documents')
    .select('id, raw_content, processed_content, title, document_type_id, ai_summary_status')
    .eq('source_id', sourceId)
    .maybeSingle();
  
  if (error) {
    Logger.error(`Error finding expert document for source ${sourceId}:`, error);
    return null;
  }
  
  if (data) {
    if (!data.raw_content) {
      Logger.warn(`Found expert document ${data.id} for source ${sourceId}, but it has no raw content`);
    }
  } else {
    Logger.warn(`No expert document found for source ${sourceId}`);
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
      .from('google_expert_documents')
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
    
    // Log the content length for debugging
    writeDebugLog(`Document has ${expertDoc.raw_content.length} bytes of raw content`);
    
    // Additional sanity check for empty raw content
    if (expertDoc.raw_content.trim().length === 0) {
      writeDebugLog(`Expert document has empty raw content (zero length after trimming)`);
      return {
        success: false,
        error: 'Expert document has empty raw content'
      };
    }
    
    // Check if already processed and has a title (unless force option is used)
    if (expertDoc.processed_content && expertDoc.title && !options.force) {
      writeDebugLog(`Document already has processed content and title. ai_summary_status=${expertDoc.ai_summary_status}`);
      
      // If it's been processed but status isn't 'completed', update it
      if (expertDoc.ai_summary_status !== 'completed') {
        try {
          const { error: updateError } = await supabase
            .from('google_expert_documents')
            .update({
              ai_summary_status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', expertDoc.id);
            
          if (updateError) {
            writeDebugLog(`Error updating expert document status to completed: ${updateError.message}`);
          } else {
            writeDebugLog(`Updated expert document status to 'completed'`);
          }
        } catch (updateError) {
          writeDebugLog(`Exception updating status: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
        }
      }
      
      return {
        success: true,
        already_processed: true,
        title_updated: false,
        message: 'Document already has processed content and title',
        ai_summary_status: expertDoc.ai_summary_status
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
        .from('google_expert_documents')
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
        .from('google_expert_documents')
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