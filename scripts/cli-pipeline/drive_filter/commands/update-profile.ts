#!/usr/bin/env ts-node
import { Command } from 'commander';
import { FilterService } from '../../../../packages/shared/services/filter-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
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
      // Create filter service instance with Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      const filterService = new FilterService(supabase);
      
      // First load the existing profile
      const existingProfile = await filterService.loadProfile(options.id);
      
      if (!existingProfile) {
        console.error(chalk.red(`❌ Profile with ID ${options.id} not found`));
        process.exit(1);
      }
      
      // Update profile with new values, preserving existing ones if not provided
      const updates: Partial<Omit<typeof existingProfile, 'id' | 'created_at'>> = {};
      
      if (options.name) {
        updates.name = options.name;
      }
      
      if (options.description !== undefined) {
        updates.description = options.description;
      }
      
      const success = await filterService.updateProfile(options.id, updates);
      
      if (success) {
        const profileName = options.name || existingProfile.name;
        console.log(chalk.green(`✅ Filter profile "${profileName}" updated successfully`));
        
        // If we need to set as active and it's not currently active
        if (options.active && !existingProfile.is_active) {
          await filterService.setActiveProfile(options.id);
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

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;