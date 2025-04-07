import { Command } from 'commander';
import { PresentationService } from '../services/presentation-service';
import { claudeService } from '../../shared/services/claude-service';
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
            .select('id, raw_content')
            .eq('id', videoSummaryDoc.id)
            .single();
            
          if (error || !expertDoc || !expertDoc.raw_content) {
            Logger.error(`Error fetching expert document ${videoSummaryDoc.id}:`, error);
            continue;
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
          
          let summary: string;
          try {
            // Call Claude API to generate summary
            summary = await claudeService.sendPrompt(customizedPrompt);
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
    .select('id, raw_content')
    .eq('id', videoSummaryDoc.id)
    .single();
    
  if (error || !expertDoc || !expertDoc.raw_content) {
    Logger.error(`Error fetching expert document ${videoSummaryDoc.id}:`, error);
    process.exit(1);
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
  
  let summary: string;
  try {
    // Call Claude API to generate summary
    summary = await claudeService.sendPrompt(customizedPrompt);
  } catch (error) {
    // Update status to error if Claude API call fails
    await presentationService.updateAiSummaryStatus(videoSummaryDoc.id, 'error');
    Logger.error(`Error generating summary with Claude for document ${videoSummaryDoc.id}:`, error);
    throw error;
  }
  
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
    concise: 'Create a concise 2-3 paragraph summary that captures the key points and main message.',
    detailed: 'Create a detailed summary (5-7 paragraphs) that thoroughly explains the main points, supporting evidence, and conclusions.',
    'bullet-points': 'Create a bullet-point summary with 5-10 key points from the presentation.'
  };
  
  return `
You are an expert medical content summarizer. Your task is to summarize the following transcript from a medical presentation or discussion.

${formatInstructions[format] || formatInstructions.concise}

Focus on capturing:
1. The main topic and thesis
2. Key medical concepts and terminology
3. Important research findings or clinical implications
4. Practical takeaways for health professionals

The summary should be clear, professional, and accurately represent the presentation content.

TRANSCRIPT:
${transcript}
`;
}