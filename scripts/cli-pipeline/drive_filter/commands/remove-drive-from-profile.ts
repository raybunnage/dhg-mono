#!/usr/bin/env ts-node
import { Command } from 'commander';
import { FilterService } from '../../../../packages/shared/services/filter-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import chalk from 'chalk';

const command = new Command('remove-drive-from-profile');

command
  .description('Remove a drive from a filter profile exclude list')
  .requiredOption('-i, --id <id>', 'Profile ID')
  .requiredOption('-d, --drive-id <driveId>', 'Drive ID to remove')
  .action(async (options) => {
    try {
      // Create filter service instance with Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      const filterService = new FilterService(supabase);
      
      // First load the profile to confirm it exists
      const profile = await filterService.loadProfile(options.id);
      
      if (!profile) {
        console.error(chalk.red(`❌ Profile with ID ${options.id} not found`));
        process.exit(1);
      }
      
      // Check if the drive is in the profile
      const drives = await filterService.listDrivesForProfile(options.id);
      if (!drives.includes(options.driveId)) {
        console.log(chalk.yellow(`Drive with ID ${options.driveId} is not in this profile's excluded drives`));
        return;
      }
      
      // Remove the drive from the profile
      const success = await filterService.removeDrivesFromProfile(options.id, [options.driveId]);
      
      if (success) {
        console.log(chalk.green(`✅ Drive ID "${options.driveId}" removed from filter profile "${profile.name}"`));
      } else {
        console.error(chalk.red('❌ Failed to remove drive from filter profile'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error removing drive from filter profile:'), error);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;