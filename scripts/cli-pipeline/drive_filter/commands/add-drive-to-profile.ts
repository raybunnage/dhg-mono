import { Command } from 'commander';
import { filterService } from '../../../../packages/shared/services/filter-service';
import chalk from 'chalk';

const command = new Command('add-drive-to-profile');

command
  .description('Add a drive to a filter profile exclude list')
  .requiredOption('-i, --id <id>', 'Profile ID')
  .requiredOption('-d, --drive-id <driveId>', 'Drive ID to exclude')
  .action(async (options) => {
    try {
      // First load the profile to confirm it exists
      const profile = await filterService.loadProfile(options.id);
      
      if (!profile) {
        console.error(chalk.red(`❌ Profile with ID ${options.id} not found`));
        process.exit(1);
      }
      
      // Check if the drive is already excluded
      const drives = await filterService.listDrivesForProfile(options.id);
      if (drives.includes(options.driveId)) {
        console.log(chalk.yellow(`Drive with ID ${options.driveId} is already excluded in this profile`));
        return;
      }
      
      // Add the drive to the profile
      const result = await filterService.addDriveToProfile(options.id, options.driveId);
      
      if (result) {
        console.log(chalk.green(`✅ Drive ID "${options.driveId}" added to filter profile "${profile.name}"`));
      } else {
        console.error(chalk.red('❌ Failed to add drive to filter profile'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error adding drive to filter profile:'), error);
      process.exit(1);
    }
  });

export default command;