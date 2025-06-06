#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../packages/shared/utils/logger';
import { PresentationService } from './services/presentation-service';
import { PresentationRepairService } from './services/presentation-repair-service';
import { ExpertDocumentService } from './services/expert-document-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { generateSummaryCommand } from './commands/generate-summary';
import { presentationAssetBioCommand } from './commands/presentation-asset-bio';
import { createPresentationsFromMp4Command } from './commands/create-presentations-from-mp4';
import { createPresentationAssetsCommand } from './commands/create-presentation-assets';
import { processMp4FilesCommand } from './commands/process-mp4-files';
import { testProcessDocumentCommand } from './commands/test-process-document';
// Archived: import checkVideoConsistencyCommand from './commands/check-video-consistency';
import repairMismatchedVideoIdsCommand from './commands/repair-mismatched-video-ids';
import findMissingPresentationsCommand from './commands/find-missing-presentations';
import createMissingPresentationsCommand from './commands/create-missing-presentations';
import findDuplicateFolderNamesCommand from './commands/find-duplicate-folder-names';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Create the main program
const program = new Command()
  .name('presentations-cli')
  .description('CLI for managing and enhancing presentations and related expert documents')
  .version('0.1.0');

// Debug program state
console.log("DEBUG: Adding commands directly");

// Define review-presentations command
program
  .command('review-presentations')
  .description('Review presentations status, document types, and raw content previews in a markdown table')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to review')
  .option('-e, --expert-id <id>', 'Filter presentations by expert ID')
  .option('-s, --status <status>', 'Filter by status (complete, incomplete, missing-transcript, etc.)')
  .option('-l, --limit <number>', 'Limit the number of presentations to review', '1000')
  .option('--folder-id <id>', 'Filter presentations by folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--skip-folder-filter', 'Skip filtering by folder ID', false)
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .option('-o, --output-file <path>', 'Path to write markdown output to', '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/transcribe_status.md')
  .option('-c, --create-assets', 'Create missing presentation_asset records', false)
  .action(async (options: any) => {
    try {
      Logger.info('Reviewing presentations...');
      
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.reviewPresentations({
        presentationId: options.presentationId,
        expertId: options.expertId,
        status: options.status,
        limit: parseInt(options.limit),
        createAssets: options.createAssets,
        folderId: options.skipFolderFilter ? null : options.folderId,
        skipFolderFilter: options.skipFolderFilter,
      });
      
      if (presentations.length === 0) {
        Logger.info('No presentations found matching the criteria.');
        return;
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(presentations, null, 2));
        return;
      }
      
      // Display table format as markdown
      console.log('\nPRESENTATION REVIEW SUMMARY');
      console.log('==========================\n');
      
      // Display as markdown table in console with fixed column widths
      console.log('| Presentation           | Expert      | Whisper Status  | AI Summary   | Raw Content Preview      |');
      console.log('|------------------------|-------------|-----------------|--------------|--------------------------|');
      
      for (const presentation of presentations) {
        const title = presentation.title || 'Untitled';
        const expert = presentation.expert_name || 'N/A';
        const status = presentation.status;
        
        // Pad strings to fixed width for alignment
        const titlePadded = title.substring(0, 22).padEnd(22, ' ');
        const expertPadded = (expert || 'N/A').substring(0, 11).padEnd(11, ' ');
        
        // Determine status based on availability of raw content
        let displayStatus = "No Content";
        
        // Change status to reflect if we have content based on raw_content availability
        const hasRawContent = presentation.expert_documents?.some(doc => doc.has_raw_content);
        if (hasRawContent) {
          displayStatus = "Has Content";
        }
        
        const statusPadded = displayStatus.substring(0, 14).padEnd(14, ' ');
        
        if (presentation.expert_documents && presentation.expert_documents.length > 0) {
          // Filter for documents that have raw_content or presentations with complete status
          const relevantDocs = presentation.expert_documents.filter(doc => 
            doc.has_raw_content || status === 'complete'
          );
          
          if (relevantDocs.length > 0) {
            // Output each document as a separate row
            for (const doc of relevantDocs) {
              // Get AI summary status instead of document type
              let aiSummaryStatus = "Unknown";
              if (doc.ai_summary_status) {
                aiSummaryStatus = doc.ai_summary_status;
              } else {
                aiSummaryStatus = "pending";
              }
              
              const aiSummaryPadded = aiSummaryStatus.substring(0, 10).padEnd(12, ' ');
              
              const contentPreview = doc.raw_content_preview 
                ? doc.raw_content_preview.substring(0, 24).replace(/\n/g, ' ').trim() + '...'
                : 'No content';
              
              console.log(`| ${titlePadded} | ${expertPadded} | ${statusPadded} | ${aiSummaryPadded} | ${contentPreview.padEnd(24, ' ')} |`);
            }
          } else {
            // If no relevant documents, still show the presentation
            console.log(`| ${titlePadded} | ${expertPadded} | ${statusPadded} | No docs     | N/A                      |`);
          }
        } else {
          // If no documents at all
          console.log(`| ${titlePadded} | ${expertPadded} | ${statusPadded} | No docs     | N/A                      |`);
        }
      }
      
      // Create the output file data as before (if needed)
      const tableHeader = '| Title | ID | Status | Assets | Next Steps |';
      const tableDivider = '|-------|----|---------|---------|--------------------|';
      
      let markdownOutput = '# Presentation Transcription Status\n\n';
      markdownOutput += tableHeader + '\n' + tableDivider + '\n';
      
      for (const presentation of presentations) {
        const title = presentation.title || 'Untitled';
        const id = presentation.id;
        const status = presentation.status;
        
        // Format assets
        let assets = 'None';
        if (presentation.assets && presentation.assets.length > 0) {
          assets = presentation.assets.map(asset => `${asset.type}`).join(', ');
        }
        
        // Format next steps for the output file
        const simpleNextSteps = presentation.next_steps && presentation.next_steps.length > 0 
          ? presentation.next_steps.map((step, index) => `${index + 1}. ${step}`).join('<br>') 
          : 'None';
        
        markdownOutput += `| ${title} | ${id} | ${status} | ${assets} | ${simpleNextSteps} |\n`;
      }
      
      console.log('\n');
      
      // Write to output file if requested
      if (options.outputFile) {
        try {
          const fs = require('fs');
          fs.writeFileSync(options.outputFile, markdownOutput);
          Logger.info(`Markdown output written to ${options.outputFile}`);
        } catch (writeError) {
          Logger.error('Error writing to output file:', writeError);
        }
      }
      
      Logger.info(`Reviewed ${presentations.length} presentations.`);
      
    } catch (error) {
      Logger.error('Error reviewing presentations:', error);
      process.exit(1);
    }
  });

// Add commands to the program
console.log("DEBUG: Adding commands directly");

// Register presentation-asset-bio command directly
program
  .command('presentation-asset-bio')
  .description('Match non-transcript expert documents with presentations and create presentation assets')
  .option('-d, --dry-run', 'Preview matches without creating presentation assets', false)
  .option('-l, --limit <number>', 'Limit the number of documents to process', '100')
  .option('-f, --folder-id <id>', 'Filter by specific folder ID (default: Dynamic Healing Discussion Group)', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('-c, --confirm-all', 'Automatically confirm all matches without prompting', false)
  .option('-t, --document-type <type>', 'Filter by specific document type (e.g., "Presentation Announcement")')
  .option('-m, --min-confidence <level>', 'Minimum confidence level for auto-confirmation (high, medium, low)', 'high')
  .action(async (options: any) => {
    try {
      console.log('DEBUG: Executing presentation-asset-bio command');
      
      const presentationService = PresentationService.getInstance();
      
      // Get non-transcript expert documents
      Logger.info('Finding non-transcript expert documents...');
      
      // Real implementation
      const documents = await presentationService.getNonTranscriptDocuments({
        limit: parseInt(options.limit),
        folderId: options.folderId,
        documentType: options.documentType
      });
      
      if (documents.length === 0) {
        Logger.info('No non-transcript expert documents found.');
        return;
      }
      
      Logger.info(`Found ${documents.length} non-transcript expert documents.`);
      
      // Match documents with presentations
      Logger.info('Matching documents with presentations by folder structure...');
      const matches = await presentationService.matchDocumentsWithPresentations(documents);
      
      if (matches.length === 0) {
        Logger.info('No matches found between documents and presentations.');
        return;
      }
      
      // Count by confidence level
      const highConfidence = matches.filter(m => m.confidence === 'high').length;
      const mediumConfidence = matches.filter(m => m.confidence === 'medium').length;
      const lowConfidence = matches.filter(m => m.confidence === 'low').length;
      
      // Display matches summary
      console.log(`\nFound ${matches.length} possible matches: ${highConfidence} high confidence, ${mediumConfidence} medium confidence, ${lowConfidence} low confidence`);
      
      // Display matches in a table format
      console.log('\n| Document Name | Document Type | Presentation | Confidence | Folder Path |');
      console.log('|---------------|--------------|--------------|------------|-------------|');
      
      // Show up to 10 matches for preview
      const matchesToShow = matches.slice(0, 10);
      for (const match of matchesToShow) {
        // Truncate long names for display
        const docName = (match.documentName || 'Unknown').substring(0, 20).padEnd(20);
        const docType = (match.documentType || 'Unknown').substring(0, 12).padEnd(12);
        const presTitle = (match.presentationTitle || 'No match').substring(0, 20).padEnd(20);
        const confidence = match.confidence.padEnd(10);
        const folderPath = (match.folderPath || 'Unknown').substring(0, 30);
        
        console.log(`| ${docName} | ${docType} | ${presTitle} | ${confidence} | ${folderPath} |`);
      }
      
      if (matches.length > 10) {
        console.log(`\n... and ${matches.length - 10} more matches (use --limit to see more)`);
      }
      
      if (options.dryRun) {
        Logger.info('\nDry run - no presentation assets will be created.');
        return;
      }
      
      // Process matches if confirm-all is true
      if (options.confirmAll) {
        const confidenceLevels: Record<string, number> = {
          high: 3,
          medium: 2,
          low: 1
        };
        
        const minConfidence = options.minConfidence || 'high';
        const minConfidenceLevel = confidenceLevels[minConfidence] || 3;
        
        let createdCount = 0;
        
        Logger.info(`\nCreating presentation assets for matches with confidence >= ${minConfidence}...`);
        
        for (const match of matches) {
          // Skip if no presentation match found or asset already exists
          if (!match.presentationId || match.assetExists) {
            continue;
          }
          
          // Skip if confidence level is below minimum
          const matchConfidence = match.confidence || 'low';
          const matchConfidenceLevel = confidenceLevels[matchConfidence] || 0;
          if (matchConfidenceLevel < minConfidenceLevel) {
            continue;
          }
          
          // Create presentation asset
          Logger.info(`Creating asset for document "${match.documentName}" linked to presentation "${match.presentationTitle || match.presentationId}"`);
          
          // Debug the asset type mapping
          Logger.info(`Document type: ${match.documentType}`);
          
          // Map document type to asset type
          let assetType = 'document'; // Changed from 'supportingDoc' to valid enum value 'document'
          if (match.documentType === 'Presentation Announcement') {
            assetType = 'document'; // Changed from 'announcement' to valid enum value 'document'
          } else if (match.documentType?.toLowerCase().includes('transcript')) {
            assetType = 'transcript';
          }
          
          Logger.info(`Mapped asset type: ${assetType}`);
          
          const success = await presentationService.createPresentationAsset({
            presentationId: match.presentationId,
            expertDocumentId: match.expertDocumentId,
            assetType: assetType
          });
          
          if (success) {
            createdCount++;
            Logger.info(`Successfully created presentation asset`);
          } else {
            Logger.warn(`Failed to create presentation asset`);
          }
        }
        
        Logger.info(`\nCreated ${createdCount} new presentation assets.`);
      } else {
        Logger.info('\nTo create presentation assets, run with --confirm-all flag:');
        Logger.info('  presentations-cli presentation-asset-bio --confirm-all');
        Logger.info('  presentations-cli presentation-asset-bio --confirm-all --min-confidence medium');
      }
    } catch (error) {
      Logger.error('Error matching documents with presentations:', error);
      process.exit(1);
    }
  });

// Function to normalize options - handle common typos
function normalizeOptions(args: string[]): string[] {
  // Handle common mistakes like ---dry-run (three dashes)
  return args.map(arg => {
    if (arg.startsWith('---')) {
      return '--' + arg.substring(3);
    }
    return arg;
  });
}

// Get normalized args
const normalizedArgs = normalizeOptions(process.argv);
if (JSON.stringify(normalizedArgs) !== JSON.stringify(process.argv)) {
  console.log('INFO: Fixed command line arguments. If you see unexpected behavior, please check your command syntax.');
}

// Use the standard way to add the commands
// FOR DEBUG: Let's log what the process-mp4-files command looks like
console.log("DEBUG: processMp4FilesCommand =", {
  name: processMp4FilesCommand.name(),
  description: processMp4FilesCommand.description(),
  options: processMp4FilesCommand.opts()
});

// Issue: Let's directly register the process-mp4-files command
program
  .command('process-mp4-files')
  .description('DIRECT: Process MP4 files in sources_google, find related expert_documents, and generate AI summaries')
  .option('-d, --document-id <id>', 'Specific expert document ID to process (for testing)')
  .option('-l, --limit <limit>', 'Maximum number of MP4 files to process (default: 5)', '5')
  .option('-b, --batch-size <size>', 'Number of files to process in each batch (default: 3)', '3')
  .option('-c, --concurrency <num>', 'Number of files to process concurrently (default: 1)', '1')
  .option('--dry-run', 'Preview processing without saving to database', false)
  .option('--verbose', 'Show detailed logs during processing', false)
  .option('-f, --force', 'Force processing even if already processed', false)
  .option('-o, --output <path>', 'Output file path for the JSON results (default: mp4-processing-results.json)', 'mp4-processing-results.json')
  .action(async (options: any) => {
    // Extract only the needed options to avoid circular references
    const extractedOptions = {
      documentId: options.documentId,
      limit: options.limit,
      batchSize: options.batchSize,
      concurrency: options.concurrency,
      dryRun: options.dryRun,
      verbose: options.verbose,
      force: options.force,
      output: options.output
    };
    
    console.log("DEBUG: DIRECT Action handler starting for process-mp4-files with options:", extractedOptions);
    
    // Load and run the command
    const { processMp4FilesAction } = require('./commands/process-mp4-files-action');
    await processMp4FilesAction(extractedOptions);
  });

// Add commands using addCommand method
program.addCommand(generateSummaryCommand);
program.addCommand(testProcessDocumentCommand);
// Archived: program.addCommand(checkVideoConsistencyCommand);
program.addCommand(repairMismatchedVideoIdsCommand);
program.addCommand(findMissingPresentationsCommand);
program.addCommand(findDuplicateFolderNamesCommand);
  
console.log("DEBUG: Commands after adding commands:", program.commands.map((cmd: any) => cmd.name()));

// Define generate-expert-bio command
program
  .command('generate-expert-bio')
  .description('Generate AI expert bio/profile from presentation content')
  .option('-e, --expert-id <id>', 'Expert ID to generate bio for (required)')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to source content from')
  .option('-f, --force', 'Force regeneration of bio even if it already exists', false)
  .option('--dry-run', 'Show what would be generated without saving', false)
  .option('--style <style>', 'Bio style (professional, narrative, academic)', 'professional')
  .action(async (options: any) => {
    try {
      if (!options.expertId) {
        Logger.error('Error: --expert-id is required');
        process.exit(1);
      }
      
      Logger.info(`Generating expert bio for expert ID: ${options.expertId}`);
      // Implementation goes here
    } catch (error) {
      Logger.error('Error generating expert bio:', error);
      process.exit(1);
    }
  });

// Define check-professional-docs command
program
  .command('check-professional-docs')
  .description('Check for professional documents (CV, bio, announcement) associated with presentations')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to check')
  .option('-e, --expert-id <id>', 'Filter by expert ID')
  .option('-d, --document-type <type>', 'Filter by document type: "cv", "bio", or "announcement"')
  .option('-l, --limit <number>', 'Limit the number of presentations to check', '10')
  .option('--missing-only', 'Show only presentations missing professional documents', false)
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (options: any) => {
    try {
      Logger.info('Checking professional documents for presentations...');
      // Implementation goes here
    } catch (error) {
      Logger.error('Error checking professional documents:', error);
      process.exit(1);
    }
  });

// Define create-missing-assets command
program
  .command('create-missing-assets')
  .description('Create missing presentation_asset records for presentations with transcripts')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to create assets for')
  .option('-l, --limit <number>', 'Limit the number of presentations to process', '100')
  .action(async (options: any) => {
    try {
      Logger.info('Creating missing presentation_asset records...');
      
      // Use the review-presentations with create-assets option
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.reviewPresentations({
        presentationId: options.presentationId,
        limit: parseInt(options.limit),
        createAssets: true,
      });
      
      // Count how many assets were created
      let assetsCreated = 0;
      for (const presentation of presentations) {
        if (presentation.assets && presentation.assets.some((asset: any) => asset.type === 'transcript' && asset.justCreated)) {
          assetsCreated++;
        }
      }
      
      Logger.info(`Processed ${presentations.length} presentations, created ${assetsCreated} new transcript assets.`);
      
    } catch (error) {
      Logger.error('Error creating missing assets:', error);
      process.exit(1);
    }
  });

// Define export-status command
program
  .command('export-status')
  .description('Export presentation transcription status to markdown file')
  .option('-o, --output-file <path>', 'Path to write markdown output to', '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/transcribe_status.md')
  .option('-l, --limit <number>', 'Limit the number of presentations to include', '300')
  .action(async (options: any) => {
    try {
      Logger.info('Exporting presentation status to markdown...');
      
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.reviewPresentations({
        limit: parseInt(options.limit),
      });
      
      if (presentations.length === 0) {
        Logger.info('No presentations found.');
        return;
      }
      
      // Create markdown table 
      const tableHeader = '| Title | ID | Status | Assets | Next Steps |';
      const tableDivider = '|-------|----|---------|---------|--------------------|';
      
      let markdownOutput = '# Presentation Transcription Status\n\n';
      markdownOutput += tableHeader + '\n' + tableDivider + '\n';
      
      for (const presentation of presentations) {
        const title = presentation.title || 'Untitled';
        const id = presentation.id;
        const status = presentation.status;
        
        // Format assets
        let assets = 'None';
        if (presentation.assets && presentation.assets.length > 0) {
          assets = presentation.assets.map(asset => `${asset.type}`).join(', ');
        }
        
        // Format next steps
        const simpleNextSteps = presentation.next_steps && presentation.next_steps.length > 0 
          ? presentation.next_steps.map((step: string, index: number) => `${index + 1}. ${step}`).join('<br>') 
          : 'None';
        
        markdownOutput += `| ${title} | ${id} | ${status} | ${assets} | ${simpleNextSteps} |\n`;
      }
      
      // Write to output file
      try {
        const fs = require('fs');
        fs.writeFileSync(options.outputFile, markdownOutput);
        Logger.info(`Markdown output written to ${options.outputFile}`);
      } catch (writeError) {
        Logger.error('Error writing to output file:', writeError);
      }
      
      Logger.info(`Exported status for ${presentations.length} presentations.`);
      
    } catch (error) {
      Logger.error('Error exporting presentation status:', error);
      process.exit(1);
    }
  });

// Define repair-presentations command
program
  .command('repair-presentations')
  .description('Repair presentations with missing main_video_id')
  .option('--dry-run', 'Show what would be repaired without making changes', true)
  .option('--setup', 'Create database functions for repairing presentations', false)
  .option('--db-function', 'Use database function for repairs (more efficient)', false)
  .action(async (options: any) => {
    try {
      Logger.info('Analyzing presentations with missing video IDs...');

      const repairService = new PresentationRepairService();

      // Create database functions if requested
      if (options.setup) {
        Logger.info('Setting up database functions for presentation repair...');
        const success = await repairService.createDatabaseFunctions();
        if (success) {
          Logger.info('Database functions created successfully!');
        } else {
          Logger.error('Failed to create database functions');
          process.exit(1);
        }
        return;
      }

      // Use database function if requested
      if (options.dbFunction && !options.dryRun) {
        Logger.info('Using database function to repair presentations...');
        const { repaired, details } = await repairService.repairPresentationsWithDatabaseFunction();
        Logger.info(`Repaired ${repaired} presentations using database function`);
        return;
      }

      // Otherwise use the TypeScript implementation
      const { total, repaired, details } = await repairService.analyzeAndRepairPresentations(options.dryRun);
      
      if (options.dryRun) {
        Logger.info(`Found ${total} presentations that need repair`);
        Logger.info('Run with --no-dry-run to actually repair the presentations');
      } else {
        Logger.info(`Repaired ${repaired}/${total} presentations`);
      }
    } catch (error) {
      Logger.error('Error repairing presentations:', error);
      process.exit(1);
    }
  });

// Define create-from-expert-docs command
program
  .command('create-from-expert-docs')
  .description('Create presentations from expert documents for MP4 files without presentations')
  .option('--no-dry-run', 'Actually create the presentations instead of just showing what would be created')
  .option('--folder-id <id>', 'Specify a folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--limit <number>', 'Limit the number of expert documents to process')
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options: any) => {
    try {
      Logger.info('Analyzing expert documents for MP4 files without presentations...');

      const expertDocService = new ExpertDocumentService();

      // Get expert documents for MP4 files without presentations
      const { 
        totalDocuments,
        docsInFolder,
        docsWithoutPresentations,
        documents 
      } = await expertDocService.getExpertDocsForMp4Files({
        folderId: options.folderId,
        limit: options.limit ? parseInt(options.limit, 10) : undefined
      });

      Logger.info(`Found ${totalDocuments} total expert documents`);
      Logger.info(`${docsInFolder} are for MP4 files in the specified folder`);
      Logger.info(`${docsWithoutPresentations} are for MP4 files without presentations`);

      if (docsWithoutPresentations === 0) {
        Logger.info('No expert documents to process. All MP4 files with expert documents already have presentations.');
        return;
      }

      // Show sample of expert documents to process
      if (documents.length > 0) {
        Logger.info('\nSample expert documents to process:');
        const sampleSize = Math.min(5, documents.length);
        for (let i = 0; i < sampleSize; i++) {
          const doc = documents[i];
          const source = doc.sources_google;
          Logger.info(`${i + 1}. ${source.name} (${source.id})`);
          Logger.info(`   Expert Document: ${doc.id} (Created: ${new Date(doc.created_at).toLocaleDateString()})`);
        }
      }

      if (options.dryRun !== false) {
        Logger.info(`\nDRY RUN: Would create ${docsWithoutPresentations} presentations`);
        Logger.info('Run with --no-dry-run to actually create the presentations');
      } else {
        Logger.info(`\nCreating ${docsWithoutPresentations} presentations...`);

        const result = await expertDocService.createPresentationsFromExpertDocs({
          expertDocs: documents,
          isDryRun: false
        });

        Logger.info(`Successfully created ${result.created} presentations with links to expert documents`);
      }

    } catch (error) {
      Logger.error('Error creating presentations from expert documents:', error);
      process.exit(1);
    }
  });

// Define scan-for-ai-summaries command
program
  .command('scan-for-ai-summaries')
  .description('Scan for documents that need AI summarization')
  .option('-l, --limit <number>', 'Limit the number of documents to process', '130')
  .option('--update', 'Update documents without AI summary status to have status "pending"', false)
  .option('--reset', 'Reset all documents to have AI summary status "pending"', false)
  .option('--reset-to-null', 'Reset all documents to have NULL AI summary status (more compatible with some database setups)', false)
  .option('--folder-id <id>', 'Filter by specific folder ID (default: Dynamic Healing Discussion Group)', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--update-dhg', 'Update documents in Dynamic Healing Discussion Group to have status "pending" using SQL criteria', false)
  .action(async (options: any) => {
    try {
      const presentationService = PresentationService.getInstance();
      Logger.info('Scanning for documents needing AI summarization...');
      
      // Get the document type ID for "Video Summary Transcript"
      const videoSummaryTypeId = await presentationService.getVideoSummaryTranscriptTypeId();
      
      if (!videoSummaryTypeId) {
        Logger.error('Could not find document type ID for "Video Summary Transcript"');
        return;
      }
      
      Logger.info(`Using document type ID for Video Summary Transcript: ${videoSummaryTypeId}`);
      
      // Get the Dynamic Healing Discussion Group folder ID or use the one provided in options
      const dhgFolderId = options.folderId || '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
      Logger.info(`Using folder ID: ${dhgFolderId}`);
      
      // Get sources for the specified folder
      const { data: dhgSources, error: dhgError } = await presentationService.supabaseClient
        .from('google_sources')
        .select('id')
        .eq('drive_id', dhgFolderId)
        .limit(100); // Limit to avoid query size issues
      
      if (dhgError) {
        Logger.error('Error fetching folder sources:', dhgError);
        return;
      }
      
      if (!dhgSources || dhgSources.length === 0) {
        Logger.info('No sources found in specified folder');
        return;
      }
      
      const sourceIds = dhgSources.map((s: any) => s.id);
      Logger.info(`Found ${sourceIds.length} sources in the specified folder (limited to 100)`);
      
      // Find documents with missing AI summary status
      const { data: missingStatusDocs, error: countError } = await presentationService.supabaseClient
        .from('google_expert_documents')
        .select('id, document_type_id, expert_id, ai_summary_status, source_id')
        .eq('document_type_id', videoSummaryTypeId)
        .not('raw_content', 'is', null)
        .is('ai_summary_status', null)
        .in('source_id', sourceIds);
      
      if (countError) {
        Logger.error('Error counting documents without AI summary status:', countError);
        return;
      }
      
      Logger.info(`Found ${missingStatusDocs?.length || 0} Video Summary Transcript documents with raw content but no AI summary status in the specified folder`);
      
      // Count documents with completed AI summaries in this folder
      const { data: completedDocs, error: completedError } = await presentationService.supabaseClient
        .from('google_expert_documents')
        .select('id')
        .eq('document_type_id', videoSummaryTypeId)
        .eq('ai_summary_status', 'completed')
        .in('source_id', sourceIds);
      
      if (completedError) {
        Logger.error('Error counting completed documents:', completedError);
      } else {
        Logger.info(`Found ${completedDocs?.length || 0} Video Summary Transcript documents with completed AI summaries in the specified folder`);
      }
      
      // Count documents with pending AI summaries in this folder
      const { data: pendingDocs, error: pendingError } = await presentationService.supabaseClient
        .from('google_expert_documents')
        .select('id')
        .eq('document_type_id', videoSummaryTypeId)
        .eq('ai_summary_status', 'pending')
        .in('source_id', sourceIds);
      
      if (pendingError) {
        Logger.error('Error counting pending documents:', pendingError);
      } else {
        Logger.info(`Found ${pendingDocs?.length || 0} Video Summary Transcript documents with pending AI summaries in the specified folder`);
      }
      
      // Update documents if requested
      if (options.resetToNull) {
        // Use the direct SQL method to set ai_summary_status to NULL
        Logger.info("Using global reset method to set all documents to NULL status...");
        const { success, failed } = await presentationService.resetAllVideoSummaryTranscriptsStatus(null, options.folderId);
        
        Logger.info(`Successfully reset ${success} Video Summary Transcript documents to NULL status`);
        if (failed > 0) {
          Logger.warn(`Failed to reset ${failed} documents`);
        }
      } else if (options.updateDhg) {
        // Use the new method for updating documents that match the DHG criteria
        Logger.info("Using new method to update documents in Dynamic Healing Discussion Group to pending status...");
        const videoSummaryTypeId = await presentationService.getVideoSummaryTranscriptTypeId();
        
        if (!videoSummaryTypeId) {
          Logger.error('Could not find document type ID for "Video Summary Transcript"');
          return;
        }
        
        // Call the new method to update DHG documents
        const { success, failed } = await presentationService.updateDhgExpertDocumentsStatus('pending', videoSummaryTypeId);
        
        Logger.info(`Successfully updated ${success} documents to pending status using DHG criteria`);
        if (failed > 0) {
          Logger.warn(`Failed to update ${failed} documents`);
        }
      } else if (options.reset) {
        // Use the new method to reset all documents to pending
        Logger.info("Using global reset method to set all documents to pending status...");
        const { success, failed } = await presentationService.resetAllVideoSummaryTranscriptsStatus('pending', options.folderId);
        
        Logger.info(`Successfully reset ${success} Video Summary Transcript documents to pending status`);
        if (failed > 0) {
          Logger.warn(`Failed to reset ${failed} documents`);
        }
      } else if (options.update && missingStatusDocs && missingStatusDocs.length > 0) {
        // Only update documents with missing status using batch method
        const docIds = missingStatusDocs.map((doc: { id: string }) => doc.id);
        
        Logger.info(`Updating ${docIds.length} documents to 'pending' status using batch method...`);
        const { success, failed } = await presentationService.updateMultipleAiSummaryStatus(docIds, 'pending');
        
        Logger.info(`Successfully updated ${success} Video Summary Transcript documents to pending status`);
        if (failed > 0) {
          Logger.warn(`Failed to update ${failed} documents`);
        }
      }
      
      // Get and display a sample of documents that need processing using our enhanced method
      const limit = parseInt(options.limit);
      const docs = await presentationService.getDocumentsNeedingAiSummary(limit, options.folderId);
      
      if (docs.length === 0) {
        Logger.info('No documents found needing AI summary processing that match all criteria.');
        return;
      }
      
      Logger.info(`\nSample of ${docs.length} documents needing AI summary processing:\n`);
      
      // Display as a table
      console.log('| ID | Document Type | Expert ID | Source ID |');
      console.log('|----|--------------|-----------|-----------|');
      
      for (const doc of docs as Array<{id: string, document_types?: {document_type?: string}, expert_id?: string, source_id?: string}>) {
        const docType = doc.document_types?.document_type || 'Unknown';
        console.log(`| ${doc.id} | ${docType} | ${doc.expert_id || 'None'} | ${doc.source_id || 'None'} |`);
      }
      
      Logger.info('\nTo process these documents, run:');
      Logger.info('  ./scripts/cli-pipeline/presentations/presentations-cli.sh generate-summary --status pending --limit 10');
      
      // Show the expected number of documents that should match the criteria
      Logger.info(`\nExpected filtered count: Approximately 109 documents should match all criteria:`);
      Logger.info(`  - From Dynamic Healing Discussion Group`);
      Logger.info(`  - Document type is "Video Summary Transcript"`);
      Logger.info(`  - Has raw_content (not null)`);
      Logger.info(`  - Status is "Completed"`);
      Logger.info(`  - AI summary status is pending or null`);
      Logger.info(`Current count from this sample: ${docs.length} documents (limited to ${limit})`);
      
      // Check if we need to run additional count query to get the full count
      if (docs.length === limit) {
        Logger.info(`Note: There may be more documents than shown here (sample limited to ${limit})`);
      }
      
    } catch (error) {
      Logger.error('Error scanning for AI summaries:', error);
      process.exit(1);
    }
  });

// Define show-missing-content command
program
  .command('show-missing-content')
  .description('Show presentations without raw content that need to be reprocessed')
  .option('-l, --limit <number>', 'Limit the number of presentations to check', '1000')
  .option('--folder-id <id>', 'Filter presentations by folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('-o, --output-file <path>', 'Path to write results to', '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/missing_content.md')
  .action(async (options: any) => {
    try {
      Logger.info('Checking for presentations without content...');
      
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.reviewPresentations({
        limit: parseInt(options.limit),
        folderId: options.folderId,
      });
      
      if (presentations.length === 0) {
        Logger.info('No presentations found matching the criteria.');
        return;
      }
      
      // Filter for presentations without raw content
      const presentationsWithoutContent = presentations.filter(presentation => {
        // Check if presentation has any expert documents with raw content
        const hasRawContent = presentation.expert_documents?.some(doc => doc.has_raw_content);
        return !hasRawContent;
      });
      
      if (presentationsWithoutContent.length === 0) {
        Logger.info('All presentations have content.');
        return;
      }
      
      // Display table format as markdown
      console.log('\nPRESENTATIONS MISSING CONTENT');
      console.log('===========================\n');
      
      // Display as markdown table in console
      console.log('| Presentation | Expert | Status | ID |');
      console.log('|--------------|--------|--------|-------|');
      
      for (const presentation of presentationsWithoutContent) {
        const title = presentation.title || 'Untitled';
        const expert = presentation.expert_name || 'N/A';
        const status = presentation.status;
        
        console.log(`| ${title} | ${expert} | ${status} | ${presentation.id} |`);
      }
      
      // Create output file data
      const tableHeader = '| Title | Expert | Status | ID |';
      const tableDivider = '|-------|--------|---------|-------|';
      
      let markdownOutput = '# Presentations Missing Content\n\n';
      markdownOutput += `Found ${presentationsWithoutContent.length} presentations without raw content.\n\n`;
      markdownOutput += tableHeader + '\n' + tableDivider + '\n';
      
      for (const presentation of presentationsWithoutContent) {
        const title = presentation.title || 'Untitled';
        const expert = presentation.expert_name || 'N/A';
        const status = presentation.status;
        
        markdownOutput += `| ${title} | ${expert} | ${status} | ${presentation.id} |\n`;
      }
      
      // Add instructions for reprocessing
      markdownOutput += '\n## How to Reprocess\n\n';
      markdownOutput += 'To reprocess these presentations, use the following command for each ID:\n\n';
      markdownOutput += '```bash\n';
      markdownOutput += '# Replace PRESENTATION_ID with the ID from the table above\n';
      markdownOutput += 'pnpm cli presentations-cli review-presentations --presentation-id PRESENTATION_ID --create-assets\n';
      markdownOutput += '```\n';
      
      console.log('\n');
      
      // Write to output file if requested
      if (options.outputFile) {
        try {
          const fs = require('fs');
          fs.writeFileSync(options.outputFile, markdownOutput);
          Logger.info(`Missing content report written to ${options.outputFile}`);
        } catch (writeError) {
          Logger.error('Error writing to output file:', writeError);
        }
      }
      
      Logger.info(`Found ${presentationsWithoutContent.length} presentations without content.`);
      
    } catch (error) {
      Logger.error('Error checking for missing content:', error);
      process.exit(1);
    }
  });

// Define show-ai-summary-status command
program
  .command('show-ai-summary-status')
  .description('Show AI summary status for expert documents')
  .option('-l, --limit <number>', 'Limit the number of documents to check', '125')
  .option('--folder-id <id>', 'Filter by folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('-o, --output-file <path>', 'Path to write results to', '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/ai_summary_status.md')
  .action(async (options: any) => {
    try {
      Logger.info('Checking AI summary status for expert documents...');
      
      const presentationService = PresentationService.getInstance();
      
      // Get the document type ID for "Video Summary Transcript"
      const videoSummaryTypeId = await presentationService.getVideoSummaryTranscriptTypeId();
      
      if (!videoSummaryTypeId) {
        Logger.error('Could not find document type ID for "Video Summary Transcript"');
        return;
      }
      
      Logger.info(`Using document type ID for Video Summary Transcript: ${videoSummaryTypeId}`);
      
      // Query for expert documents with non-null ai_summary_status
      const { data, error } = await presentationService.supabaseClient
        .from('google_expert_documents')
        .select(`
          id,
          document_type_id,
          document_types(document_type),
          expert_id,
          experts(expert_name),
          ai_summary_status,
          source_id,
          sources_google(name),
          updated_at
        `)
        .eq('document_type_id', videoSummaryTypeId)
        .not('ai_summary_status', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(parseInt(options.limit));
      
      if (error) {
        Logger.error('Error fetching documents with AI summary status:', error);
        return;
      }
      
      if (!data || data.length === 0) {
        Logger.info('No documents found with AI summary status.');
        return;
      }
      
      // Group documents by status
      const documentsByStatus: Record<string, any[]> = {};
      data.forEach((doc: { ai_summary_status: string }) => {
        const status = doc.ai_summary_status;
        if (!documentsByStatus[status]) {
          documentsByStatus[status] = [];
        }
        documentsByStatus[status].push(doc);
      });
      
      // Count by status
      const statusCounts: Record<string, number> = {};
      Object.keys(documentsByStatus).forEach(status => {
        statusCounts[status] = documentsByStatus[status].length;
      });
      
      // Display status counts
      console.log('\nAI SUMMARY STATUS COUNTS');
      console.log('=======================\n');
      console.log('| Status     | Count |');
      console.log('|------------|-------|');
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`| ${status.padEnd(10)} | ${count.toString().padStart(5)} |`);
      });
      console.log('\n');
      
      // Display detailed results in a markdown table
      console.log('AI SUMMARY STATUS DETAILS');
      console.log('========================\n');
      
      console.log('| Document ID | Expert | Status | Updated At | Source |');
      console.log('|-------------|--------|--------|------------|--------|');
      
      // Show completed first, then pending, then error
      const displayOrder = ['completed', 'processing', 'pending', 'error'];
      
      displayOrder.forEach(status => {
        if (documentsByStatus[status]) {
          documentsByStatus[status].slice(0, 10).forEach(doc => {
            const id = doc.id.substring(0, 8);
            const expertName = doc.experts?.expert_name || 'Unknown';
            const sourceName = doc.sources_google?.name || 'Unknown';
            const timestamp = new Date(doc.updated_at).toLocaleString();
            
            console.log(`| ${id} | ${expertName.padEnd(6)} | ${status.padEnd(6)} | ${timestamp} | ${sourceName.padEnd(6)} |`);
          });
        }
      });
      
      // Create markdown output file
      let markdownOutput = '# AI Summary Status Report\n\n';
      
      // Add status counts
      markdownOutput += '## Status Counts\n\n';
      markdownOutput += '| Status | Count |\n';
      markdownOutput += '|--------|-------|\n';
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        markdownOutput += `| ${status} | ${count} |\n`;
      });
      
      // Add detailed tables for each status
      displayOrder.forEach(status => {
        if (documentsByStatus[status]) {
          markdownOutput += `\n## ${status.charAt(0).toUpperCase() + status.slice(1)} Documents\n\n`;
          markdownOutput += '| Document ID | Expert | Status | Updated At | Source |\n';
          markdownOutput += '|-------------|--------|--------|------------|--------|\n';
          
          documentsByStatus[status].forEach(doc => {
            const expertName = doc.experts?.expert_name || 'Unknown';
            const sourceName = doc.sources_google?.name || 'Unknown';
            const timestamp = new Date(doc.updated_at).toLocaleString();
            
            markdownOutput += `| ${doc.id} | ${expertName} | ${status} | ${timestamp} | ${sourceName} |\n`;
          });
        }
      });
      
      // Add instructions for processing
      markdownOutput += '\n## How to Process Documents\n\n';
      markdownOutput += 'To process pending documents and generate summaries, use:\n\n';
      markdownOutput += '```bash\n';
      markdownOutput += 'pnpm cli presentations-cli generate-summary --status pending --limit 10\n';
      markdownOutput += '```\n\n';
      
      markdownOutput += 'To update document statuses, use:\n\n';
      markdownOutput += '```bash\n';
      markdownOutput += 'pnpm cli presentations-cli scan-for-ai-summaries --update\n';
      markdownOutput += '```\n';
      
      // Write to output file if requested
      if (options.outputFile) {
        try {
          const fs = require('fs');
          fs.writeFileSync(options.outputFile, markdownOutput);
          Logger.info(`AI summary status report written to ${options.outputFile}`);
        } catch (writeError) {
          Logger.error('Error writing to output file:', writeError);
        }
      }
      
      Logger.info(`Found ${data.length} documents with AI summary status.`);
      
    } catch (error) {
      Logger.error('Error checking AI summary status:', error);
      process.exit(1);
    }
  });

// Define add-specific-files command
program
  .command('add-specific-files')
  .description('Add specific files from sources_google to presentations, create expert documents and assets')
  .option('--dry-run', 'Show what would be added without making changes', false)
  .option('--source-ids <ids>', 'Comma-separated list of source_ids to add')
  .option('--verbose', 'Show detailed logs', false)
  
// Health check command
program
  .command('health-check')
  .description('Check the health of presentations pipeline infrastructure')
  .option('--skip-database', 'Skip database connection check')
  .option('--skip-presentations', 'Skip presentations table check')
  .option('--skip-claude', 'Skip Claude service check')
  .option('-v, --verbose', 'Show verbose output')
  .action(async (options: any) => {
    try {
      // Import the healthCheckCommand function
      const { healthCheckCommand } = require('./commands/health-check');
      
      // Run the health check
      await healthCheckCommand({
        skipDatabase: options.skipDatabase,
        skipPresentations: options.skipPresentations,
        skipClaude: options.skipClaude,
        verbose: options.verbose
      });
    } catch (error) {
      Logger.error('Error running health check:', error);
      process.exit(1);
    }
  });

// Define update-root-drive-id command
program
  .command('update-root-drive-id')
  .description('Fill in the root_drive_id for all records with the value of 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .option('-v, --verbose', 'Show detailed logs', false)
  .action(async (options: any) => {
    try {
      // Import the updateRootDriveIdCommand function
      const { updateRootDriveIdCommand } = require('./commands/update-root-drive-id');
      
      // Run the command
      await updateRootDriveIdCommand({
        dryRun: options.dryRun,
        verbose: options.verbose
      });
    } catch (error) {
      Logger.error('Error updating root_drive_id:', error);
      process.exit(1);
    }
  });

// Define create-presentations-from-mp4 command
program
  .command('create-presentations-from-mp4')
  .description('Create presentation records for MP4 files in sources_google')
  .option('--no-dry-run', 'Actually create the presentations instead of just showing what would be created')
  .option('-l, --limit <number>', 'Limit the number of MP4 files to process', '150')
  .option('-v, --verbose', 'Show detailed logs')
  .option('--fix-missing-folders', 'Fix presentations with missing high-level folder source IDs')
  .action(async (options: any) => {
    try {
      if (options.fixMissingFolders) {
        Logger.info('Fixing presentations with missing high-level folder IDs...');
      } else {
        Logger.info('Creating presentations from MP4 files...');
      }
      
      const result = await createPresentationsFromMp4Command({
        dryRun: options.dryRun !== false,
        limit: parseInt(options.limit),
        verbose: options.verbose,
        fixMissingFolders: options.fixMissingFolders
      });
      
      if (result.success) {
        if (options.fixMissingFolders) {
          if (result.dryRun) {
            if (result.wouldFix) {
              Logger.info(`DRY RUN: Would update ${result.wouldFix} presentations with high-level folder IDs.`);
              Logger.info('Run with --no-dry-run to actually apply the updates.');
            } else {
              Logger.info('No presentations need updating.');
            }
          } else if (result.fixed !== undefined) {
            Logger.info(`Successfully updated ${result.fixed} presentations with high-level folder IDs.`);
            if (result.failed && result.failed > 0) {
              Logger.error(`Failed to update ${result.failed} presentations.`);
            }
          }
        } else {
          if (result.dryRun) {
            Logger.info(`Found ${result.count} MP4 files that need presentations.`);
            Logger.info('Run without --dry-run to actually create the presentations.');
          } else {
            Logger.info(`Created ${result.created} presentation records successfully.`);
            if (result.failed && result.failed > 0) {
              Logger.error(`Failed to create ${result.failed} presentation records.`);
            }
          }
        }
      } else {
        Logger.error(options.fixMissingFolders 
          ? 'Error fixing presentations with missing high-level folder IDs.' 
          : 'Error creating presentations from MP4 files.');
      }
    } catch (error) {
      Logger.error('Error creating presentations from MP4 files:', error);
      process.exit(1);
    }
  });

// Define create-presentation-assets command
program
  .command('create-presentation-assets')
  .description('Create presentation_assets for all supported files in each presentation\'s high-level folder')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to process')
  .option('--dry-run', 'Show what would be created without making any changes', false)
  .option('-l, --limit <number>', 'Limit the number of presentations to process')
  .option('-d, --depth <number>', 'Maximum folder depth to search (default: 6)')
  .option('--skip-existing [boolean]', 'Skip presentations with existing assets (default: true)', true)
  .action(async (options: any) => {
    try {
      Logger.info('Creating presentation assets for files in high-level folders...');
      
      // Convert skip-existing option to boolean if it's a string
      let skipExisting = options.skipExisting;
      if (typeof skipExisting === 'string') {
        skipExisting = skipExisting.toLowerCase() !== 'false';
      }
      
      const result = await createPresentationAssetsCommand({
        presentationId: options.presentationId,
        dryRun: options.dryRun,
        limit: options.limit ? parseInt(options.limit) : undefined,
        depth: options.depth ? parseInt(options.depth) : undefined,
        skipExisting: skipExisting
      });
      
      if (result.success) {
        Logger.info(result.message || 'Successfully created presentation assets');
      } else {
        Logger.error(`Error creating presentation assets: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      Logger.error('Error running create-presentation-assets command:', error);
      process.exit(1);
    }
  });

// Define add-specific-files command (moved below health-check)
program
  .command('add-specific-files')
  .description('Add specific files from sources_google to presentations, create expert documents and assets')
  .option('--dry-run', 'Show what would be added without making changes', false)
  .option('--source-ids <ids>', 'Comma-separated list of source_ids to add')
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options: any) => {
    try {
      Logger.info('Adding specific files to presentations...');
      
      // Define default source IDs (the 3 files you specified)
      const defaultSourceIds = [
        '835a6c30-b043-44f3-8918-4dbc902511db', // Gevirtz.3.19.25.mp4
        '5eab1200-c1eb-47ed-91ae-5b2165a25547', // Sommer-Anderson.mp4
        'a29ac5ee-b7a6-4ffc-a072-d6caacd65a70'  // Stockdale_Seigel_2.19.25.mp4
      ];
      
      // Use provided source IDs or defaults
      const sourceIds = options.sourceIds ? options.sourceIds.split(',') : defaultSourceIds;
      
      Logger.info(`Will process ${sourceIds.length} files with IDs: ${sourceIds.join(', ')}`);
      
      // Get the sources from database
      const { data: sources, error: sourcesError } = await SupabaseClientService.getInstance().getClient()
        .from('google_sources')
        .select('id, name, mime_type, path, drive_id, modified_at')
        .in('id', sourceIds);
      
      if (sourcesError) {
        Logger.error('Error fetching sources:', sourcesError);
        process.exit(1);
      }
      
      if (!sources || sources.length === 0) {
        Logger.info('No sources found with the specified IDs.');
        return;
      }
      
      Logger.info(`Found ${sources.length} sources in database:`);
      sources.forEach((source: any) => {
        Logger.info(`- ${source.name} (${source.id})`);
      });
      
      // Check if any of these sources already have presentations
      const { data: existingPresentations, error: presentationsError } = await SupabaseClientService.getInstance().getClient()
        .from('media_presentations')
        .select('id, title, main_video_id')
        .in('main_video_id', sourceIds);
      
      if (presentationsError) {
        Logger.error('Error checking existing presentations:', presentationsError);
      } else if (existingPresentations && existingPresentations.length > 0) {
        Logger.info(`Found ${existingPresentations.length} existing presentations for these sources:`);
        existingPresentations.forEach((p: any) => {
          Logger.info(`- ${p.title} (${p.id}), main_video_id: ${p.main_video_id}`);
        });
        
        // Remove sources that already have presentations
        const existingSourceIds = existingPresentations.map((p: any) => p.main_video_id);
        const filteredSources = sources.filter((s: any) => !existingSourceIds.includes(s.id));
        
        if (filteredSources.length === 0) {
          Logger.info('All sources already have presentations. Nothing to do.');
          return;
        }
        
        Logger.info(`Will process ${filteredSources.length} sources that don't have presentations.`);
        sources.length = 0;
        sources.push(...filteredSources);
      }
      
      if (options.dryRun) {
        Logger.info('DRY RUN: Would create presentations for these sources:');
        sources.forEach((source: any) => {
          Logger.info(`- ${source.name} (${source.id})`);
          
          // Show what would be created
          const newPresentation = {
            main_video_id: source.id,
            filename: source.name,
            folder_path: source.path || '/',
            title: source.name.replace(/\.[^.]+$/, ''), // Remove file extension
            recorded_date: source.modified_at,
            is_public: false,
            transcript_status: 'pending'
          };
          
          if (options.verbose) {
            Logger.info(`  Presentation data: ${JSON.stringify(newPresentation, null, 2)}`);
          }
        });
        
        Logger.info('Run without --dry-run to actually create the presentations.');
        return;
      }
      
      // Actually create presentations, expert documents, and assets
      const createdPresentations = [];
      let createdExpertDocs = 0;
      let createdAssets = 0;
      
      for (const source of sources) {
        try {
          Logger.info(`Processing ${source.name}...`);
          
          // Create presentation record
          const newPresentation = {
            main_video_id: source.id,
            filename: source.name,
            folder_path: source.path || '/',
            title: source.name.replace(/\.[^.]+$/, ''), // Remove file extension
            recorded_date: source.modified_at,
            is_public: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            transcript_status: 'pending'
          };
          
          const { data: presentationData, error: presError } = await SupabaseClientService.getInstance().getClient()
            .from('media_presentations')
            .insert(newPresentation)
            .select();
          
          if (presError) {
            Logger.error(`Error creating presentation for ${source.name}:`, presError);
            continue;
          }
          
          if (!presentationData || presentationData.length === 0) {
            Logger.error(`No presentation data returned for ${source.name}`);
            continue;
          }
          
          const presentation = presentationData[0];
          createdPresentations.push(presentation);
          Logger.info(`Created presentation: ${presentation.title} (${presentation.id})`);
          
          // Get document type for Video Summary Transcript
          const { data: docTypeData, error: docTypeError } = await SupabaseClientService.getInstance().getClient()
            .from('document_types')
            .select('id')
            .eq('document_type', 'Video Summary Transcript')
            .single();
            
          if (docTypeError || !docTypeData) {
            Logger.error('Error getting document type for Video Summary Transcript:', docTypeError);
            continue;
          }
          
          // Create expert document (if it doesn't exist)
          const docTypeId = docTypeData.id;
          
          // Check for existing expert document
          const { data: existingDoc, error: docCheckError } = await SupabaseClientService.getInstance().getClient()
            .from('google_expert_documents')
            .select('id')
            .eq('source_id', source.id)
            .eq('document_type_id', docTypeId)
            .maybeSingle();
            
          let expertDocId;
          
          if (docCheckError) {
            Logger.error('Error checking for existing expert document:', docCheckError);
            continue;
          }
          
          if (existingDoc) {
            Logger.info(`Found existing expert document: ${existingDoc.id}`);
            expertDocId = existingDoc.id;
          } else {
            // Create expert document
            const newExpertDoc = {
              source_id: source.id,
              document_type_id: docTypeId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ai_summary_status: 'pending'
            };
            
            const { data: newDoc, error: newDocError } = await SupabaseClientService.getInstance().getClient()
              .from('google_expert_documents')
              .insert(newExpertDoc)
              .select();
            
            if (newDocError || !newDoc || newDoc.length === 0) {
              Logger.error('Error creating expert document:', newDocError);
              continue;
            }
            
            expertDocId = newDoc[0].id;
            createdExpertDocs++;
            Logger.info(`Created expert document: ${expertDocId}`);
          }
          
          // Create presentation asset
          const newAsset = {
            presentation_id: presentation.id,
            asset_type: 'transcript',
            asset_role: 'main',
            expert_document_id: expertDocId,
            source_id: source.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { data: assetData, error: assetError } = await SupabaseClientService.getInstance().getClient()
            .from('media_presentation_assets')
            .insert(newAsset)
            .select();
          
          if (assetError || !assetData || assetData.length === 0) {
            Logger.error('Error creating presentation asset:', assetError);
            continue;
          }
          
          createdAssets++;
          Logger.info(`Created presentation asset: ${assetData[0].id}`);
          
        } catch (error: any) {
          Logger.error(`Error processing ${source.name}:`, error);
        }
      }
      
      Logger.info(`Successfully processed ${sources.length} sources.`);
      Logger.info(`Created ${createdPresentations.length} presentations, ${createdExpertDocs} expert documents, and ${createdAssets} presentation assets.`);
      
    } catch (error: any) {
      Logger.error('Error adding specific files:', error);
      process.exit(1);
    }
  });

// Parse command line arguments without debug info
const isDebug = process.argv.indexOf('--debug') !== -1;
if (isDebug) {
  console.log("Debug: Command line arguments:", process.argv);
}

// Parse command line arguments with normalized options
program.parse(normalizedArgs);

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  console.log(`
Presentations Pipeline CLI
=========================

The presentations pipeline provides commands for managing expert presentations, including generating AI 
summaries from transcriptions, creating expert profiles, and managing presentation assets.

Available Commands:
  review-presentations       Review presentation status, document types, and content
  generate-summary           Generate AI summaries from presentation transcripts using Claude
    Options:
      -p, --presentation-id <id>   Process a specific presentation ID
      -e, --expert-id <id>         Process presentations for a specific expert
      -f, --force                  Regenerate summaries even if they exist
      --dry-run                    Preview mode: generate but don't save to database
      -l, --limit <number>         Max presentations to process (default: 5)
      -o, --output <path>          Output file for JSON results
      --format <format>            Summary style:
                                     concise: 2-3 paragraph summary (default)
                                     detailed: 5-7 paragraph thorough summary
                                     bullet-points: 5-10 key bullet points
      --status <status>            Filter by presentation status
  
  presentation-asset-bio     Match non-transcript expert documents (bios, announcements) with presentations
    Options:
      -d, --dry-run                Preview matches without creating presentation assets
      -l, --limit <number>         Limit the number of documents to process (default: 100)
      -f, --folder-id <id>         Filter by specific folder ID
      -c, --confirm-all            Automatically confirm all matches without prompting
      -t, --document-type <type>   Filter by specific document type
      -m, --min-confidence <level> Minimum confidence level for auto-confirmation (high, medium, low)
  
  generate-expert-bio        Generate AI expert bio/profile from presentation content
  check-professional-docs    Check for professional documents associated with presentations
  create-missing-assets      Create missing presentation_asset records
  export-status              Export presentation transcription status to markdown
  repair-presentations       Repair presentations with missing main_video_id
  create-from-expert-docs    Create presentations from expert documents
  show-missing-content       Show presentations without content that need reprocessing
  show-ai-summary-status     Show AI summary status for expert documents in markdown table
  update-root-drive-id       Fill in the root_drive_id for all records with the specified value
  
For detailed help on a specific command, run:
  presentations-cli [command] --help
`);
  program.outputHelp();
}

// More debug information only when --debug is passed
if (isDebug) {
  console.log("Debug: After parsing, commands:", program.commands.map((cmd: any) => cmd.name()));
  console.log("Debug: Is generate-summary command registered?", program.commands.some((cmd: any) => cmd.name() === 'generate-summary'));
  
  // Check if we got a specific command
  const cmdArg = process.argv[2]; 
  console.log("Debug: Command argument:", cmdArg);
  console.log("Debug: All args:", process.argv);
}

// Define check-presentation-titles command
program
  .command('check-presentation-titles')
  .description('Check presentation titles against their processed content to identify inconsistencies')
  .option('-o, --output-path <path>', 'Path to write report to', '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/presentation-titles-check.md')
  .option('-l, --limit <number>', 'Limit the number of presentations to check', '100')
  .action(async (options: any) => {
    try {
      // Import the command implementation function
      const { checkPresentationTitlesCommand } = require('./commands/check-presentation-titles');
      
      // Run the command
      const result = await checkPresentationTitlesCommand({
        outputPath: options.outputPath,
        limit: parseInt(options.limit)
      });
      
      if (result.success) {
        Logger.info(result.message);
      } else {
        Logger.error(result.message);
        process.exit(1);
      }
    } catch (error) {
      Logger.error('Error checking presentation titles:', error);
      process.exit(1);
    }
  });

// Note: check-video-consistency command is now imported from its own file and added to program.commands

// Handle any unhandled exceptions
process.on('unhandledRejection', (error) => {
  Logger.error('Unhandled rejection:', error);
  process.exit(1);
});