import { Command } from 'commander';
import { PresentationService } from '../services/presentation-service';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';
import * as fs from 'fs';
import * as path from 'path';
// Use require for chalk to avoid ESM compatibility issues
const chalk = require('chalk');

// Create a new command
export const generateSummaryCommand = new Command('generate-summary');

// Set command description and options
generateSummaryCommand
  .description('Generate AI summary from presentation transcripts using Claude')
  .option('-p, --presentation-id <id>', 'Presentation ID to generate summary for (process just one presentation)')
  .option('-d, --document-id <id>', 'Expert document ID to directly process (bypasses presentation lookup)')
  .option('-e, --expert-id <id>', 'Expert ID to generate summaries for (filter by expert)')
  .option('-f, --force', 'Force regeneration of summary even if it already exists', false)
  .option('--dry-run', 'Preview mode: generate summaries but do not save them to the database', false)
  .option('-l, --limit <limit>', 'Maximum number of presentations to process (default: 5)', '5')
  .option('-o, --output <path>', 'Output file path for the JSON results (default: presentation-summaries.json)', 'presentation-summaries.json')
  .option('--folder-id <id>', 'Filter presentations by Google Drive folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--format <format>', `Summary format style:
    - concise: 2-3 paragraph summary (default)
    - detailed: 5-7 paragraph thorough summary with supporting evidence
    - bullet-points: 5-10 bullet points covering key presentation points`, 'concise')
  .option('--status <status>', 'Filter by presentation status (default: make-ai-summary)', 'make-ai-summary')
  .option('--clear-existing', 'Clear existing processed_content before generating new summary', false)
  .action(async (options: any) => {
    try {
      console.log("DEBUG: STARTING GENERATE-SUMMARY COMMAND");
      console.log("DEBUG: Starting generate-summary command with options:", JSON.stringify(options));
      console.log("DEBUG: Working directory:", process.cwd());
      
      // Print out any errors in try/catch blocks to make sure they're visible
      process.on('uncaughtException', (error) => {
        console.error('CRITICAL ERROR:', error);
        process.exit(1);
      });
      
      const presentationService = PresentationService.getInstance();
      // Using the claudeService singleton imported from the correct location
      const promptQueryService = new PromptQueryService();

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
        Logger.warn('Error fetching prompt, using default prompt template');
      }
      
      // Use default prompt if none found in database
      if (!promptTemplate) {
        Logger.warn('Using default prompt template');
        promptTemplate = generateDefaultSummaryPrompt('{{TRANSCRIPT}}', options.format);
      }
      
      // Verify we have a prompt template
      if (!promptTemplate) {
        Logger.error('Failed to get prompt template');
        process.exit(1);
      }
      
      // If document ID is provided, process just that one document directly
      if (options.documentId) {
        console.log("DEBUG: Processing single expert document with ID:", options.documentId);
        await processSingleExpertDocument(
          options.documentId as string,
          presentationService,
          promptTemplate,
          options
        );
        console.log("DEBUG: Returned from processSingleExpertDocument");
        return;
      }
      
      // If presentation ID is provided, process just that one
      if (options.presentationId) {
        console.log("DEBUG: About to call processSinglePresentation with ID:", options.presentationId);
        await processSinglePresentation(
          options.presentationId as string,
          presentationService,
          promptTemplate,
          options
        );
        console.log("DEBUG: Returned from processSinglePresentation");
        return;
      }
      
      // Otherwise, find presentations with Video Summary Transcript documents
      Logger.info('Finding presentations with content that can be summarized...');
      const presentationReviews = await presentationService.reviewPresentations({
        limit: parseInt(options.limit, 10),
        expertId: options.expertId,
        folderId: options.folderId,
        status: options.status
      });
      
      if (!presentationReviews || presentationReviews.length === 0) {
        Logger.error('No presentations found');
        process.exit(1);
      }
      
      Logger.info(`Found ${presentationReviews.length} presentations to review`);
      
      // Filter to presentations with content that can be summarized
      // Use status parameter if provided, otherwise look for presentations with raw content
      const presentationsToProcess = presentationReviews.filter(p => {
        const hasStatus = options.status ? true : (p.status === 'make-ai-summary');
        return p.has_raw_content;
      });
      
      if (presentationsToProcess.length === 0) {
        Logger.error('No presentations found with documents that have raw content for processing');
        process.exit(1);
      }
      
      // Check if we're going to process fewer presentations than requested due to 
      // not finding enough eligible presentations
      const requestedLimit = parseInt(options.limit, 10);
      const actualProcessCount = Math.min(requestedLimit, presentationsToProcess.length);
      Logger.info(`BATCH_SIZE_CHECK: Will process ${actualProcessCount} presentations (requested: ${requestedLimit}, found: ${presentationsToProcess.length})`);
      
      // Limit the presentations to process to the requested limit
      const limitedPresentationsToProcess = presentationsToProcess.slice(0, requestedLimit);
      
      Logger.info(`${limitedPresentationsToProcess.length} presentations have documents with raw content ready for processing`);
      
      // Process each presentation
      const results: any[] = [];
      for (const presentation of limitedPresentationsToProcess) {
        try {
          Logger.info(`Processing presentation: ${presentation.title} (${presentation.id})`);
          
          // Check if presentation has expert_documents
          if (!presentation.expert_documents || presentation.expert_documents.length === 0) {
            console.log("DEBUG: No expert documents found for presentation:", presentation.id);
            Logger.warn(`No expert documents found for presentation ${presentation.id}, skipping`);
            continue;
          }
          
          console.log("DEBUG: Expert documents for presentation", presentation.id, ":", 
            JSON.stringify(presentation.expert_documents.map((doc: any) => ({
              id: doc.id,
              document_type: doc.document_type || "unknown",
              has_raw_content: doc.has_raw_content || false
            })))
          );
          
          // Find any document with raw content - not being picky about document type
          const videoSummaryDoc = presentation.expert_documents.find((doc: any) => 
            doc.has_raw_content
          );
          
          if (!videoSummaryDoc) {
            Logger.warn(`No document with raw content found for presentation ${presentation.id}, skipping`);
            continue;
          }
          
          // Get the full expert document including raw_content
          const { data: expertDoc, error } = await presentationService.supabaseClient
            .from('expert_documents')
            .select('id, raw_content, processed_content')
            .eq('id', videoSummaryDoc.id)
            .single();
            
          if (error || !expertDoc) {
            Logger.error(`Error fetching expert document ${videoSummaryDoc.id}:`, error);
            continue;
          }
          
          if (!expertDoc.raw_content) {
            Logger.warn(`No raw content found for expert document ${videoSummaryDoc.id}, checking for existing processed content`);
            
            if (expertDoc.processed_content) {
              Logger.info(`Found existing processed content for document ${videoSummaryDoc.id}, will use that instead`);
              // Add artificial raw_content from processed_content to continue the flow
              expertDoc.raw_content = expertDoc.processed_content;
            } else {
              Logger.error(`No content found for expert document ${videoSummaryDoc.id}`);
              continue;
            }
          }
          
          // Make sure we have expert_id
          const expertId = presentation.expert_id || null;
          
          // Check if summary already exists if we have an expert_id
          let existingSummary = null;
          if (expertId) {
            existingSummary = await presentationService.getExistingSummary(expertId);
          }
          
          if (existingSummary && !options.force) {
            Logger.warn(`Summary already exists for presentation ${presentation.id}. Use --force to regenerate.`);
            
            // Add to results
            results.push({
              presentation_id: presentation.id,
              title: presentation.title,
              expert_id: expertId,
              summary_exists: true,
              summary_preview: existingSummary.processed_content?.substring(0, 200) + '...' || 'No content',
              generated: false
            });
            
            continue;
          }
          
          // Update the AI summary status to processing
          await presentationService.updateAiSummaryStatus(videoSummaryDoc.id, 'processing');
          Logger.info(`Updated AI summary status to 'processing' for document ${videoSummaryDoc.id}`);
          
          // Replace the placeholder in the prompt with the transcript content
          const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', expertDoc.raw_content);
          
          Logger.info(`Generating summary for presentation ${presentation.id} using Claude...`);
          
          let summaryResponse: string;
          try {
            // Call Claude API to generate JSON summary
            summaryResponse = await claudeService.sendPrompt(customizedPrompt);
            
            // Validate that response is valid JSON
            try {
              // Extract JSON if it's wrapped in markdown code blocks
              let jsonString = summaryResponse;
              const jsonMatch = summaryResponse.match(/```json\s*([\s\S]*?)\s*```/);
              if (jsonMatch && jsonMatch[1]) {
                jsonString = jsonMatch[1];
              }
              
              // Parse JSON to validate
              const parsedJson = JSON.parse(jsonString);
              
              // Convert back to string for storage (properly formatted)
              summaryResponse = JSON.stringify(parsedJson, null, 2);
              
              // Log success
              Logger.info('Successfully parsed JSON response from Claude');
            } catch (jsonError) {
              Logger.warn(`Claude response is not valid JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
              Logger.warn('Will save response as-is and attempt to process it later');
              // We'll continue with the raw response
            }
          } catch (error) {
            // Update status to error if Claude API call fails
            await presentationService.updateAiSummaryStatus(videoSummaryDoc.id, 'error');
            Logger.error(`Error generating summary with Claude for document ${videoSummaryDoc.id}:`, error);
            
            // Add to results
            results.push({
              presentation_id: presentation.id,
              title: presentation.title,
              expert_id: expertId,
              error: `Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              generated: false,
              saved: false
            });
            
            continue;
          }
          
          // Assign the summary to use in following code
          const summary = summaryResponse;
          
          console.log("DEBUG: About to show summary preview...");
          if (options.dryRun) {
            console.log("DEBUG: In dry run mode, will show preview");
            Logger.info(chalk.yellow(`[PREVIEW MODE] Generated summary for "${presentation.title}" (ID: ${presentation.id}):`));
            console.log(chalk.green(summary.substring(0, 300) + '...'));
            console.log(chalk.yellow('\n[PREVIEW MODE] Summary would be saved to database in normal mode. Use without --dry-run to save.\n'));
            
            // Add to results
            results.push({
              presentation_id: presentation.id,
              title: presentation.title,
              expert_id: presentation.expert_id,
              summary_preview: summary.substring(0, 300) + '...',
              generated: true,
              saved: false,
              preview_only: true
            });
            
            continue;
          }
          
          // Save the summary
          const saved = await presentationService.saveSummary({
            expertId: presentation.expert_id || '',
            presentationId: presentation.id,
            summary,
            existingSummaryId: existingSummary?.id
          });
          
          if (saved) {
            Logger.info(chalk.green(`Summary generated and saved successfully for presentation ${presentation.id}`));
            
            // Add to results
            results.push({
              presentation_id: presentation.id,
              title: presentation.title,
              expert_id: presentation.expert_id,
              summary_preview: summary.substring(0, 200) + '...',
              generated: true,
              saved: true
            });
          } else {
            Logger.error(`Failed to save summary for presentation ${presentation.id}`);
            
            // Add to results
            results.push({
              presentation_id: presentation.id,
              title: presentation.title,
              expert_id: presentation.expert_id,
              error: 'Failed to save summary',
              generated: true,
              saved: false
            });
          }
        } catch (error) {
          Logger.error(`Error processing presentation ${presentation.id}:`, error);
          
          // Add to results
          results.push({
            presentation_id: presentation.id,
            title: presentation.title,
            expert_id: presentation.expert_id,
            error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            generated: false,
            saved: false
          });
        }
      }
      
      // Save results to output file
      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        Logger.info(chalk.green(`Results saved to ${outputPath}`));
      }
      
      // Display summary
      const successCount = results.filter(r => r.generated && r.saved).length;
      const dryRunCount = results.filter(r => r.generated && !r.saved).length;
      const skippedCount = results.filter(r => r.summary_exists).length;
      const errorCount = results.filter(r => r.error).length;
      
      if (options.dryRun) {
        Logger.info(chalk.yellow(`\n[PREVIEW MODE] Processing complete. Processed ${results.length} presentations in preview mode.`));
        Logger.info(chalk.yellow(`${dryRunCount} summaries were generated but NOT saved to database`));
        Logger.info(chalk.yellow(`${skippedCount} summaries already existed (skipped)`));
        Logger.info(chalk.yellow(`${errorCount} errors occurred`));
        Logger.info(chalk.yellow('\nTo save summaries to the database, run the command without the --dry-run flag'));
      } else {
        Logger.info(chalk.green(`\nProcessing complete. Processed ${results.length} presentations.`));
        Logger.info(`${successCount} summaries generated and saved successfully`);
        Logger.info(`${dryRunCount} summaries generated but not saved (dry run)`);
        Logger.info(`${skippedCount} summaries already existed (skipped)`);
        Logger.info(`${errorCount} errors occurred`);
      }
      
    } catch (error) {
      Logger.error('Error in generate-summary command:', error);
      process.exit(1);
    }
  });

/**
 * Process a single expert document directly by ID
 */
async function processSingleExpertDocument(
  expertDocumentId: string,
  presentationService: PresentationService,
  promptTemplate: string,
  options: any
) {
  console.log("DEBUG: processSingleExpertDocument called with ID:", expertDocumentId);
  Logger.info(`Generating summary for expert document ID: ${expertDocumentId}`);
  
  // Get the full expert document including raw_content
  const { data: expertDoc, error } = await presentationService.supabaseClient
    .from('expert_documents')
    .select('id, raw_content, processed_content, document_type_id, expert_id')
    .eq('id', expertDocumentId)
    .single();
    
  if (error || !expertDoc) {
    Logger.error(`Error fetching expert document ${expertDocumentId}:`, error);
    process.exit(1);
  }
  
  // Get document type for logging
  const { data: docType } = await presentationService.supabaseClient
    .from('document_types')
    .select('document_type')
    .eq('id', expertDoc.document_type_id)
    .single();
  
  Logger.info(`Found expert document ID ${expertDocumentId} (type: ${docType?.document_type || 'Unknown'})`);
  
  // Check content
  if (!expertDoc.raw_content) {
    Logger.error(`No raw content found for expert document ${expertDocumentId}`);
    process.exit(1);
  }
  
  // If clear-existing is set, clear the processed_content field first
  if (options.clearExisting) {
    Logger.info(`Clearing existing processed_content for document ${expertDocumentId}`);
    
    const { error: clearError } = await presentationService.supabaseClient
      .from('expert_documents')
      .update({ processed_content: null })
      .eq('id', expertDocumentId);
      
    if (clearError) {
      Logger.error(`Error clearing processed_content: ${clearError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Successfully cleared processed_content field`);
  }
  
  // Update the AI summary status to processing
  await presentationService.updateAiSummaryStatus(expertDocumentId, 'processing');
  Logger.info(`Updated AI summary status to 'processing' for document ${expertDocumentId}`);
  
  // Replace the placeholder in the prompt with the document content
  const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', expertDoc.raw_content);
  
  Logger.info('Generating summary using Claude...');
  
  let summaryResponse: string;
  try {
    // Call Claude API to generate JSON summary
    summaryResponse = await claudeService.sendPrompt(customizedPrompt);
    
    // Validate that response is valid JSON
    try {
      // Extract JSON if it's wrapped in markdown code blocks
      let jsonString = summaryResponse;
      const jsonMatch = summaryResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }
      
      // Parse JSON to validate
      const parsedJson = JSON.parse(jsonString);
      
      // Convert back to string for storage (properly formatted)
      summaryResponse = JSON.stringify(parsedJson, null, 2);
      
      // Log success
      Logger.info('Successfully parsed JSON response from Claude');
    } catch (jsonError) {
      Logger.warn(`Claude response is not valid JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
      Logger.warn('Will save response as-is and attempt to process it later');
      // We'll continue with the raw response
    }
  } catch (error) {
    // Update status to error if Claude API call fails
    await presentationService.updateAiSummaryStatus(expertDocumentId, 'error');
    Logger.error(`Error generating summary with Claude for document ${expertDocumentId}:`, error);
    throw error;
  }
  
  // Assign the summary to use in following code
  const summary = summaryResponse;
  
  console.log("DEBUG: Expert document - about to show summary preview...");
  if (options.dryRun) {
    console.log("DEBUG: Expert document - in dry run mode, will show preview");
    Logger.info(chalk.yellow(`\n[PREVIEW MODE] Generated summary for expert document (ID: ${expertDocumentId}):`));
    console.log(chalk.green(summary));
    console.log(chalk.yellow('\n[PREVIEW MODE] Summary would be saved to database in normal mode. Use without --dry-run to save.\n'));
    
    // Save results to output file
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, JSON.stringify({
        expert_document_id: expertDocumentId,
        document_type: docType?.document_type || 'Unknown',
        expert_id: expertDoc.expert_id,
        summary: summary,
        generated: true,
        saved: false,
        preview_only: true
      }, null, 2));
      Logger.info(chalk.green(`Preview results saved to ${outputPath}`));
    }
    
    return;
  }
  
  // Save the processed content directly to the expert document
  const { data, error: updateError } = await presentationService.supabaseClient
    .from('expert_documents')
    .update({ 
      processed_content: summary, 
      ai_summary_status: 'completed',
      updated_at: new Date().toISOString()
    })
    .eq('id', expertDocumentId)
    .select();
  
  if (updateError) {
    Logger.error(`Error updating expert document with summary: ${updateError.message}`);
    process.exit(1);
  }
  
  Logger.info(chalk.green('Summary generated and saved successfully to expert document'));
  Logger.info('Preview:');
  console.log(chalk.green(summary.substring(0, 200) + '...'));
  
  // Save results to output file
  if (options.output) {
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify({
      expert_document_id: expertDocumentId,
      document_type: docType?.document_type || 'Unknown',
      expert_id: expertDoc.expert_id,
      summary: summary,
      generated: true,
      saved: true
    }, null, 2));
    Logger.info(chalk.green(`Results saved to ${outputPath}`));
  }
  
  console.log("DEBUG: processSingleExpertDocument completed");
}

/**
 * Process a single presentation by ID
 */
async function processSinglePresentation(
  presentationId: string,
  presentationService: PresentationService,
  promptTemplate: string,
  options: any
) {
  console.log("DEBUG: processSinglePresentation called with ID:", presentationId);
  Logger.info(`Generating summary for presentation ID: ${presentationId}`);
  
  // Get presentation details
  const reviews = await presentationService.reviewPresentations({
    presentationId,
  });
  
  if (!reviews || reviews.length === 0) {
    Logger.error(`Presentation ${presentationId} not found`);
    process.exit(1);
  }
  
  const presentation = reviews[0];
  
  // Check if presentation has expert_documents
  if (!presentation.expert_documents || presentation.expert_documents.length === 0) {
    console.log("DEBUG: No expert documents found for presentation:", presentation.id);
    Logger.error(`No expert documents found for presentation ${presentationId}`);
    process.exit(1);
  }
  
  // Find any document with raw content
  const videoSummaryDoc = presentation.expert_documents.find(doc => 
    doc.has_raw_content
  );
  
  console.log("DEBUG: Expert documents:", JSON.stringify(presentation.expert_documents.map(doc => ({
    id: doc.id,
    document_type: doc.document_type || "unknown",
    has_raw_content: doc.has_raw_content || false
  }))));
  
  if (!videoSummaryDoc) {
    Logger.error(`No document with raw content found for presentation ${presentationId}`);
    process.exit(1);
  }
  
  // Get the full expert document including raw_content
  const { data: expertDoc, error } = await presentationService.supabaseClient
    .from('expert_documents')
    .select('id, raw_content, processed_content')
    .eq('id', videoSummaryDoc.id)
    .single();
    
  if (error || !expertDoc) {
    Logger.error(`Error fetching expert document ${videoSummaryDoc.id}:`, error);
    process.exit(1);
  }
  
  if (!expertDoc.raw_content) {
    Logger.warn(`No raw content found for expert document ${videoSummaryDoc.id}, checking for existing processed content`);
    
    if (expertDoc.processed_content) {
      Logger.info(`Found existing processed content for document ${videoSummaryDoc.id}, will use that instead`);
      // Add artificial raw_content from processed_content to continue the flow
      expertDoc.raw_content = expertDoc.processed_content;
    } else {
      Logger.error(`No content found for expert document ${videoSummaryDoc.id}`);
      process.exit(1);
    }
  }
  
  Logger.info(`Found presentation: ${presentation.title}`);
  
  // Check if summary already exists
  const existingSummary = presentation.expert_id ? await presentationService.getExistingSummary(presentation.expert_id) : null;
  
  if (existingSummary && !options.force) {
    Logger.warn('Summary already exists for this presentation. Use --force to regenerate.');
    Logger.info('Existing summary:');
    console.log(chalk.yellow(existingSummary.processed_content.substring(0, 200) + '...'));
    return;
  }
  
  // Update the AI summary status to processing
  await presentationService.updateAiSummaryStatus(videoSummaryDoc.id, 'processing');
  Logger.info(`Updated AI summary status to 'processing' for document ${videoSummaryDoc.id}`);
  
  // Replace the placeholder in the prompt with the transcript content
  const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', expertDoc.raw_content);
  
  Logger.info('Generating summary using Claude...');
  
  let summaryResponse: string;
  try {
    // Call Claude API to generate JSON summary
    summaryResponse = await claudeService.sendPrompt(customizedPrompt);
    
    // Validate that response is valid JSON
    try {
      // Extract JSON if it's wrapped in markdown code blocks
      let jsonString = summaryResponse;
      const jsonMatch = summaryResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
      }
      
      // Parse JSON to validate
      const parsedJson = JSON.parse(jsonString);
      
      // Convert back to string for storage (properly formatted)
      summaryResponse = JSON.stringify(parsedJson, null, 2);
      
      // Log success
      Logger.info('Successfully parsed JSON response from Claude');
    } catch (jsonError) {
      Logger.warn(`Claude response is not valid JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
      Logger.warn('Will save response as-is and attempt to process it later');
      // We'll continue with the raw response
    }
  } catch (error) {
    // Update status to error if Claude API call fails
    await presentationService.updateAiSummaryStatus(videoSummaryDoc.id, 'error');
    Logger.error(`Error generating summary with Claude for document ${videoSummaryDoc.id}:`, error);
    throw error;
  }
  
  // Assign the summary to use in following code
  const summary = summaryResponse;
  
  console.log("DEBUG: Single presentation - about to show summary preview...");
  if (options.dryRun) {
    console.log("DEBUG: Single presentation - in dry run mode, will show preview");
    Logger.info(chalk.yellow(`\n[PREVIEW MODE] Generated summary for "${presentation.title}" (ID: ${presentation.id}):`));
    console.log(chalk.green(summary));
    console.log(chalk.yellow('\n[PREVIEW MODE] Summary would be saved to database in normal mode. Use without --dry-run to save.\n'));
    
    // Save results to output file
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, JSON.stringify({
        presentation_id: presentation.id,
        title: presentation.title,
        expert_id: presentation.expert_id,
        summary: summary,
        generated: true,
        saved: false,
        preview_only: true
      }, null, 2));
      Logger.info(chalk.green(`Preview results saved to ${outputPath}`));
    }
    
    return;
  }
  
  // Save the summary
  const saved = await presentationService.saveSummary({
    expertId: presentation.expert_id || '',
    presentationId: presentation.id,
    summary,
    existingSummaryId: existingSummary?.id
  });
  
  if (saved) {
    Logger.info(chalk.green('Summary generated and saved successfully'));
    Logger.info('Preview:');
    console.log(chalk.green(summary.substring(0, 200) + '...'));
    
    // Save results to output file
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, JSON.stringify({
        presentation_id: presentation.id,
        title: presentation.title,
        expert_id: presentation.expert_id,
        summary: summary,
        generated: true,
        saved: true
      }, null, 2));
      Logger.info(chalk.green(`Results saved to ${outputPath}`));
    }
  } else {
    Logger.error('Failed to save summary');
  }
  
  console.log("DEBUG: processSinglePresentation completed");
}

/**
 * Generate a default summary prompt if the database prompt is not available
 */
function generateDefaultSummaryPrompt(transcript: string, format: string = 'concise'): string {
  const formatInstructions: Record<string, string> = {
    concise: 'Create a concise summary that captures the key points and main message.',
    detailed: 'Create a detailed summary that thoroughly explains the main points, supporting evidence, and conclusions.',
    'bullet-points': 'Create a summary with clear bullet-point style key takeaways.'
  };
  
  return `
You are an expert medical content summarizer. Your task is to summarize the following transcript from a medical presentation or discussion.

${formatInstructions[format] || formatInstructions.concise}

Create a JSON object with the following structure:
\`\`\`json
{
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

Focus on capturing:
1. The main topic and thesis
2. Key medical concepts and terminology
3. Important research findings or clinical implications
4. Practical takeaways for health professionals

The summary should be clear, professional, and accurately represent the presentation content. 
Ensure valid JSON formatting with proper quoting and escaping of special characters.

TRANSCRIPT:
${transcript}
`;
}