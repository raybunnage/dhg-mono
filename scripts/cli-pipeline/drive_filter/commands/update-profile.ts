import { Command } from 'commander';
import { filterService } from '../../../../packages/shared/services/filter-service';
import chalk from 'chalk';

const command = new Command('update-profile');

command
  .description('Update an existing filter profile')
  .requiredOption('-i, --id <id>', 'Profile ID')
  .option('-n, --name <name>', 'Profile name')
  .option('-d, --description <description>', 'Profile description')
  .option('-a, --active', 'Set this profile as active')
  .option('--mime-types <types...>', 'Mime types to include (comma-separated)')
  .option('--document-types <types...>', 'Document type IDs to include (comma-separated)')
  .option('--experts <experts...>', 'Expert IDs to include (comma-separated)')
  .option('--folders <folders...>', 'Folder IDs to include (comma-separated)')
  .action(async (options) => {
    try {
      // First load the existing profile
      const existingProfile = await filterService.loadProfile(options.id);
      
      if (!existingProfile) {
        console.error(chalk.red(`❌ Profile with ID ${options.id} not found`));
        process.exit(1);
      }
      
      // Build updated filter criteria, preserving existing values if not provided
      const filterCriteria = existingProfile.filter_criteria || {};
      
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
      
      // Update profile with new values, preserving existing ones if not provided
      const updatedProfile = await filterService.updateProfile({
        ...existingProfile,
        name: options.name || existingProfile.name,
        description: options.description !== undefined ? options.description : existingProfile.description,
        filter_criteria: filterCriteria
      });
      
      if (updatedProfile) {
        console.log(chalk.green(`✅ Filter profile "${updatedProfile.name}" updated successfully`));
        
        // If we need to set as active and it's not currently active
        if (options.active && !existingProfile.is_active) {
          await filterService.setActiveProfile(updatedProfile.id);
          console.log(chalk.blue('👉 Profile set as active'));
        }
      } else {
        console.error(chalk.red('❌ Failed to update filter profile'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error updating filter profile:'), error);
      process.exit(1);
    }
  });

export default command;