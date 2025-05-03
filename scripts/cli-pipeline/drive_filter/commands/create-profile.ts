import { Command } from 'commander';
import { filterService } from '../../../../packages/shared/services/filter-service';
import chalk from 'chalk';

const command = new Command('create-profile');

command
  .description('Create a new filter profile')
  .requiredOption('-n, --name <name>', 'Profile name')
  .option('-d, --description <description>', 'Profile description')
  .option('-a, --active', 'Set this profile as active')
  .option('--mime-types <types...>', 'Mime types to include (comma-separated)')
  .option('--document-types <types...>', 'Document type IDs to include (comma-separated)')
  .option('--experts <experts...>', 'Expert IDs to include (comma-separated)')
  .option('--folders <folders...>', 'Folder IDs to include (comma-separated)')
  .action(async (options) => {
    try {
      // Build filter criteria from options
      const filterCriteria: any = {};
      
      if (options.mimeTypes) {
        filterCriteria.mime_types = options.mimeTypes;
      }
      
      if (options.documentTypes) {
        filterCriteria.document_types = options.documentTypes;
      }
      
      if (options.experts) {
        filterCriteria.experts = options.experts;
      }
      
      if (options.folders) {
        filterCriteria.folders = options.folders;
      }
      
      const profile = await filterService.createProfile({
        name: options.name,
        description: options.description,
        is_active: options.active || false,
        filter_criteria: Object.keys(filterCriteria).length > 0 ? filterCriteria : undefined
      });
      
      if (profile) {
        console.log(chalk.green(`✅ Filter profile "${profile.name}" created successfully with ID: ${profile.id}`));
        
        // If set as active, confirm it
        if (options.active) {
          console.log(chalk.blue('👉 Profile set as active'));
        }
      } else {
        console.error(chalk.red('❌ Failed to create filter profile'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error creating filter profile:'), error);
      process.exit(1);
    }
  });

export default command;