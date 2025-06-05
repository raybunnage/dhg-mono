#!/usr/bin/env ts-node
import { Command } from 'commander';
import { FilterService } from '../../../../packages/shared/services/filter-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import chalk from 'chalk';

const command = new Command('delete-profile');

command
  .description('Delete a filter profile')
  .requiredOption('-i, --id <id>', 'Profile ID to delete')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(async (options) => {
    try {
      // Create filter service instance with Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      const filterService = new FilterService(supabase);
      
      // First load the profile to confirm it exists and show details
      const profile = await filterService.loadProfile(options.id);
      
      if (!profile) {
        console.error(chalk.red(`❌ Profile with ID ${options.id} not found`));
        process.exit(1);
      }
      
      // If not using force flag, show warning about active profile
      if (!options.force && profile.is_active) {
        console.log(chalk.yellow('⚠️  WARNING: You are about to delete the active profile.'));
        console.log(chalk.yellow('Use --force to confirm deletion.'));
        process.exit(0);
      }
      
      // Proceed with deletion
      const success = await filterService.deleteProfile(options.id);
      
      if (success) {
        console.log(chalk.green(`✅ Filter profile "${profile.name}" deleted successfully`));
        
        if (profile.is_active) {
          console.log(chalk.blue('Note: This was the active profile, no profile is now active.'));
        }
      } else {
        console.error(chalk.red('❌ Failed to delete filter profile'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error deleting filter profile:'), error);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;