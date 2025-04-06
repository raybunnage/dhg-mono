#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../packages/shared/utils/logger';
import { PresentationService } from './services/presentation-service';
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
  .action(async (options: any) => {
    try {
      Logger.info('Reviewing presentations...');
      
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.reviewPresentations({
        presentationId: options.presentationId,
        expertId: options.expertId,
        status: options.status,
        limit: parseInt(options.limit),
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
          expertDocs = presentation.expert_documents.map(doc => 
            `${doc.document_type} (${doc.document_type_id})`
          ).join('<br>');
        }
        
        // Format next steps
        let nextSteps = 'None';
        if (presentation.next_steps && presentation.next_steps.length > 0) {
          nextSteps = presentation.next_steps.join('<br>');
        }
        
        console.log(`| ${title} | ${id} | ${expert} | ${status} | ${presentation.has_raw_content ? 'Yes' : 'No'} | ${assets} | ${expertDocs} | ${nextSteps} |`);
      }
      
      console.log('\n');
      
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