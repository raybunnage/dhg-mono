import { Command } from 'commander';
import { PresentationService } from '../services/presentation-service';
import { Logger } from '../../../../packages/shared/utils/logger';
// Use require for chalk to avoid ESM compatibility issues
const chalk = require('chalk');

// const logger = new Logger('review-presentations-command');

// Create a new command
export const reviewPresentationsCommand = new Command('review-presentations');

// Set command description and options
reviewPresentationsCommand
  .description('Review the state of presentations and their related expert documents')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to review')
  .option('-e, --expert-id <id>', 'Filter presentations by expert ID')
  .option('-s, --status <status>', 'Filter by status (complete, incomplete, missing-transcript, etc.)')
  .option('-l, --limit <number>', 'Limit the number of presentations to review', '125')
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
      
      // Display as markdown table
      console.log(chalk.bold('\nPRESENTATION REVIEW SUMMARY'));
      console.log(chalk.bold('==========================\n'));
      
      // Table headers
      console.log('| Presentation | Expert | Status | Document Type | Raw Content Preview |');
      console.log('|--------------|--------|--------|--------------|---------------------|');
      
      // Table rows
      presentations.forEach((presentation) => {
        const expertName = presentation.expert_name || 'Unknown';
        const status = presentation.status;
        
        if (presentation.expert_documents && presentation.expert_documents.length > 0) {
          presentation.expert_documents.forEach((doc) => {
            // Only include rows that have raw_content or are in completed status
            if (doc.has_raw_content || status === 'complete') {
              const docType = doc.document_type;
              // Get first few words of raw_content preview (if it exists)
              const contentPreview = doc.raw_content_preview 
                ? doc.raw_content_preview.substring(0, 50).replace(/\n/g, ' ').trim() + '...'
                : 'No content';
              
              console.log(`| ${presentation.title.substring(0, 20)}... | ${expertName} | ${status} | ${docType} | ${contentPreview} |`);
            }
          });
        } else {
          // If no documents, still show the presentation with empty document fields
          console.log(`| ${presentation.title.substring(0, 20)}... | ${expertName} | ${status} | No documents | N/A |`);
        }
      });
      
      Logger.info(`Reviewed ${presentations.length} presentations.`);
      
    } catch (error) {
      Logger.error('Error reviewing presentations:', error);
      process.exit(1);
    }
  });

function getStatusLabel(status: string): string {
  switch (status) {
    case 'complete':
      return chalk.green('Complete');
    case 'incomplete':
      return chalk.yellow('Incomplete');
    case 'missing-transcript':
      return chalk.red('Missing Transcript');
    case 'missing-summary':
      return chalk.yellow('Missing Summary');
    case 'processing':
      return chalk.blue('Processing');
    default:
      return status || 'Unknown';
  }
}