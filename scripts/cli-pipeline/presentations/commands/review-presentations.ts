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
  .option('-l, --limit <number>', 'Limit the number of presentations to review', '10')
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
      console.log(chalk.bold('\nPRESENTATION REVIEW SUMMARY'));
      console.log(chalk.bold('==========================\n'));
      
      presentations.forEach((presentation) => {
        console.log(chalk.bold(`Presentation: ${presentation.title} (ID: ${presentation.id})`));
        console.log(`Expert: ${presentation.expert_name || 'Unknown'}`);
        console.log(`Date: ${presentation.created_at ? new Date(presentation.created_at).toLocaleDateString() : 'Unknown'}`);
        console.log(`Status: ${getStatusLabel(presentation.status)}`);
        
        console.log('\nAssets:');
        if (presentation.assets && presentation.assets.length > 0) {
          presentation.assets.forEach((asset) => {
            console.log(`- ${asset.type}: ${asset.status}`);
          });
        } else {
          console.log('- No assets found');
        }
        
        console.log('\nExpert Documents:');
        if (presentation.expert_documents && presentation.expert_documents.length > 0) {
          presentation.expert_documents.forEach((doc) => {
            console.log(`- ${doc.document_type}: ${doc.has_raw_content ? '✓' : '✗'} Raw | ${doc.has_processed_content ? '✓' : '✗'} Processed`);
          });
        } else {
          console.log('- No expert documents found');
        }
        
        console.log('\nNext Steps:');
        presentation.next_steps.forEach((step) => {
          console.log(`- ${step}`);
        });
        
        console.log(chalk.gray('\n--------------------------------------------------\n'));
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