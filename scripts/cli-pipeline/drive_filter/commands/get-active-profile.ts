import { Command } from 'commander';
import { filterService } from '../../../../packages/shared/services/filter-service';
import chalk from 'chalk';

const command = new Command('get-active-profile');

command
  .description('Get the currently active filter profile')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const profile = await filterService.loadActiveProfile();
      
      if (!profile) {
        console.log(chalk.yellow('⚠️ No active filter profile set'));
        return;
      }
      
      // If JSON output is requested
      if (options.json) {
        console.log(JSON.stringify(profile, null, 2));
        return;
      }
      
      // Print profile details in a nice format
      console.log(chalk.green('Active Filter Profile:'));
      console.log(chalk.cyan('ID:          ') + profile.id);
      console.log(chalk.cyan('Name:        ') + profile.name);
      
      if (profile.description) {
        console.log(chalk.cyan('Description: ') + profile.description);
      }
      
      console.log(chalk.cyan('Created At:  ') + profile.created_at);
      console.log(chalk.cyan('Updated At:  ') + profile.updated_at);
      
      // Show filter criteria if defined
      if (profile.filter_criteria && Object.keys(profile.filter_criteria).length > 0) {
        console.log(chalk.cyan('\nFilter Criteria:'));
        
        for (const [key, value] of Object.entries(profile.filter_criteria)) {
          if (Array.isArray(value) && value.length > 0) {
            console.log(chalk.cyan(`  ${key}: `) + value.join(', '));
          } else if (typeof value === 'object' && value !== null) {
            console.log(chalk.cyan(`  ${key}: `) + JSON.stringify(value, null, 2));
          }
        }
      } else {
        console.log(chalk.yellow('\nNo filter criteria defined'));
      }
    } catch (error) {
      console.error(chalk.red('Error getting active profile:'), error);
      process.exit(1);
    }
  });

export default command;