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

// Set command description and options
processMp4FilesCommand
  .description('Process MP4 files in sources_google, find related expert_documents, and generate AI summaries')
  .option('-d, --document-id <id>', 'Specific expert document ID to process (for testing)')
  .option('-l, --limit <limit>', 'Maximum number of MP4 files to process (default: 5)', '5')
  .option('-b, --batch-size <size>', 'Number of files to process in each batch (default: 3)', '3')
  .option('--dry-run', 'Preview processing without saving to database', false)
  .option('-o, --output <path>', 'Output file path for the JSON results (default: mp4-processing-results.json)', 'mp4-processing-results.json')
  .action(async (options: any) => {
    try {
      Logger.info('Starting MP4 files processing command');
      
      // Get supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      const promptQueryService = PromptQueryService.getInstance();
      
      // Get the summary prompt from the database
      Logger.info('Fetching video summary prompt from database...');
      let promptTemplate = '';
      try {
        const { prompt: summaryPrompt } = await promptQueryService.getPromptWithQueryResults('final_video-summary-prompt');
        if (summaryPrompt) {
          promptTemplate = summaryPrompt.content;
          Logger.info(`Found prompt: ${summaryPrompt.name}`);
        }
      } catch (error) {
        Logger.error('Error fetching prompt:', error);
        process.exit(1);
      }
      
      // Verify we have a prompt template
      if (!promptTemplate) {
        Logger.error('Failed to get prompt template from database');
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
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Get the full expert document including raw_content
    const { data: expertDoc, error } = await supabase
      .from('expert_documents')
      .select('id, raw_content, processed_content, title, document_type_id, ai_summary_status')
      .eq('id', documentId)
      .single();
      
    if (error || !expertDoc) {
      return {
        success: false,
        error: `Error fetching expert document: ${error?.message || 'Document not found'}`
      };
    }
    
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
    
    // Replace the placeholder in the prompt with the document content
    const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', expertDoc.raw_content);
    
    Logger.info('Generating summary using Claude...');
    
    let summaryResponse: string;
    try {
      // Call Claude API to generate JSON summary
      summaryResponse = await claudeService.sendPrompt(customizedPrompt);
      
      // Extract JSON if it's wrapped in markdown code blocks
      let jsonString = summaryResponse;
      const jsonMatch = summaryResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }
      
      // Parse JSON to validate and extract title
      let parsedJson;
      try {
        parsedJson = JSON.parse(jsonString);
      } catch (jsonError) {
        Logger.warn(`Claude response is not valid JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
        return {
          success: false,
          error: 'Invalid JSON response from Claude',
          ai_response: summaryResponse
        };
      }
      
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
      // Update status to error if Claude API call fails
      await supabase
        .from('expert_documents')
        .update({
          ai_summary_status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);
      
      return {
        success: false,
        error: `Error generating summary with Claude: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}