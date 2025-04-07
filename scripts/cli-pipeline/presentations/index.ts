#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../packages/shared/utils/logger';
import { PresentationService } from './services/presentation-service';
import { PresentationRepairService } from './services/presentation-repair-service';
import { ExpertDocumentService } from './services/expert-document-service';
import { ClaudeService } from '../../../packages/shared/services/claude-service';
import { generateSummaryCommand } from './commands/generate-summary';

// Create the main program
const program = new Command()
  .name('presentations-cli')
  .description('CLI for managing and enhancing presentations and related expert documents')
  .version('0.1.0');

// Define review-presentations command
program
  .command('review-presentations')
  .description('Review presentations status, document types, and raw content previews in a markdown table')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to review')
  .option('-e, --expert-id <id>', 'Filter presentations by expert ID')
  .option('-s, --status <status>', 'Filter by status (complete, incomplete, missing-transcript, etc.)')
  .option('-l, --limit <number>', 'Limit the number of presentations to review', '1000')
  .option('--folder-id <id>', 'Filter presentations by folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
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
        folderId: options.folderId,
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
      console.log('| Presentation           | Expert      | Whisper Status  | Doc Type     | Raw Content Preview      |');
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
              // Get document type from the document_types object
              let docType = "Unknown";
              if (doc.document_type) {
                docType = doc.document_type;
              } else if (doc.document_types && doc.document_types.name) {
                docType = doc.document_types.name;
              }
              
              const docTypePadded = docType.substring(0, 10).padEnd(12, ' ');
              
              const contentPreview = doc.raw_content_preview 
                ? doc.raw_content_preview.substring(0, 24).replace(/\n/g, ' ').trim() + '...'
                : 'No content';
              
              console.log(`| ${titlePadded} | ${expertPadded} | ${statusPadded} | ${docTypePadded} | ${contentPreview.padEnd(24, ' ')} |`);
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

// Add the generate-summary command
program.commands.push(generateSummaryCommand);

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

// Define check-professional-documents command
program
  .command('check-professional-documents')
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

// Parse command line arguments without debug info
const isDebug = process.argv.indexOf('--debug') !== -1;
if (isDebug) {
  console.log("Debug: Command line arguments:", process.argv);
}

// Parse command line arguments
program.parse(process.argv);

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
  
  generate-expert-bio        Generate AI expert bio/profile from presentation content
  check-professional-docs    Check for professional documents associated with presentations
  create-missing-assets      Create missing presentation_asset records
  export-status              Export presentation transcription status to markdown
  repair-presentations       Repair presentations with missing main_video_id
  create-from-expert-docs    Create presentations from expert documents
  show-missing-content       Show presentations without content that need reprocessing
  
For detailed help on a specific command, run:
  presentations-cli [command] --help
`);
  program.outputHelp();
}

// More debug information only when --debug is passed
if (isDebug) {
  console.log("Debug: After parsing, commands:", program.commands.map((cmd: any) => cmd.name()));
}

// Handle any unhandled exceptions
process.on('unhandledRejection', (error) => {
  Logger.error('Unhandled rejection:', error);
  process.exit(1);
});