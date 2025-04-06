#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../packages/shared/utils/logger';
import { PresentationService } from './services/presentation-service';
import { PresentationRepairService } from './services/presentation-repair-service';
import { ExpertDocumentService } from './services/expert-document-service';
import { ClaudeService } from '../../../packages/shared/services/claude-service';

// Create the main program
const program = new Command()
  .name('presentations-cli')
  .description('CLI for managing and enhancing presentations and related expert documents')
  .version('0.1.0');

// Define review-presentations command
program
  .command('review-presentations')
  .description('Review the state of presentations and their related expert documents')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to review')
  .option('-e, --expert-id <id>', 'Filter presentations by expert ID')
  .option('-s, --status <status>', 'Filter by status (complete, incomplete, missing-transcript, etc.)')
  .option('-l, --limit <number>', 'Limit the number of presentations to review', '300')
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
      });
      
      if (presentations.length === 0) {
        Logger.info('No presentations found matching the criteria.');
        return;
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(presentations, null, 2));
        return;
      }
      
      // Display table format
      console.log('\nPRESENTATION REVIEW SUMMARY');
      console.log('==========================\n');
      
      // Create markdown table for presentations
      const tableHeader = '| Title | ID | Status | Assets | Next Steps |';
      const tableDivider = '|-------|----|---------|---------|--------------------|';
      
      let markdownOutput = '# Presentation Transcription Status\n\n';
      markdownOutput += tableHeader + '\n' + tableDivider + '\n';
      
      console.log('| Title | ID | Expert | Status | Has Transcript | Assets | Expert Documents | Next Steps |');
      console.log('|-------|----|---------|---------|---------|---------|--------------------|----------------|');
      
      for (const presentation of presentations) {
        const title = presentation.title || 'Untitled';
        const id = presentation.id;
        const expert = presentation.expert_name || 'N/A';
        const status = presentation.status;
        
        // Format assets
        let assets = 'None';
        if (presentation.assets && presentation.assets.length > 0) {
          assets = presentation.assets.map(asset => `${asset.type}`).join(', ');
        }
        
        // Format expert documents
        let expertDocs = 'None';
        if (presentation.expert_documents && presentation.expert_documents.length > 0) {
          expertDocs = presentation.expert_documents.map(doc => {
            let linkedInfo = '';
            if (doc.linked_through_asset) {
              linkedInfo = `<br>Linked via: ${doc.asset_type} asset (${doc.linked_through_asset})`;
            }
            return `${doc.document_type} (${doc.id})${linkedInfo}<br>Content: ${doc.raw_content_preview || 'None'}`;
          }).join('<br><br>');
        }
        
        // Format next steps
        let nextSteps = 'None';
        if (presentation.next_steps && presentation.next_steps.length > 0) {
          nextSteps = presentation.next_steps.join('<br>');
        }
        
        console.log(`| ${title} | ${id} | ${expert} | ${status} | ${presentation.has_raw_content ? 'Yes' : 'No'} | ${assets} | ${expertDocs} | ${nextSteps} |`);
        
        // Create simplified markdown table entry for output file
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

// Define generate-summary command
program
  .command('generate-summary')
  .description('Generate AI summary from presentation transcript')
  .option('-p, --presentation-id <id>', 'Presentation ID to generate summary for (required)')
  .option('-f, --force', 'Force regeneration of summary even if it already exists', false)
  .option('--dry-run', 'Show what would be generated without saving', false)
  .option('--format <format>', 'Summary format (concise, detailed, bullet-points)', 'concise')
  .action(async (options: any) => {
    try {
      if (!options.presentationId) {
        Logger.error('Error: --presentation-id is required');
        process.exit(1);
      }
      
      Logger.info(`Generating summary for presentation ID: ${options.presentationId}`);
      // Implementation goes here
    } catch (error) {
      Logger.error('Error generating summary:', error);
      process.exit(1);
    }
  });

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

// Parse command line arguments
program.parse(process.argv);

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// Handle any unhandled exceptions
process.on('unhandledRejection', (error) => {
  Logger.error('Unhandled rejection:', error);
  process.exit(1);
});