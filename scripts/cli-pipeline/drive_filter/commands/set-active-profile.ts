import { Command } from 'commander';
import { filterService } from '../../../../packages/shared/services/filter-service';
import chalk from 'chalk';

const command = new Command('set-active-profile');

command
  .description('Set a filter profile as active')
  .requiredOption('-i, --id <id>', 'Profile ID to set as active')
  .action(async (options) => {
    try {
      // First load the profile to confirm it exists
      const profile = await filterService.loadProfile(options.id);
      
      if (!profile) {
        console.error(chalk.red(`❌ Profile with ID ${options.id} not found`));
        process.exit(1);
      }
      
      // Already active?
      if (profile.is_active) {
        console.log(chalk.yellow(`Profile "${profile.name}" is already active`));
        return;
      }
      
      // Set as active
      const success = await filterService.setActiveProfile(options.id);
      
      if (success) {
        console.log(chalk.green(`✅ Filter profile "${profile.name}" set as active`));
      } else {
        console.error(chalk.red('❌ Failed to set profile as active'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error setting active profile:'), error);
      process.exit(1);
    }
  });

export default command;