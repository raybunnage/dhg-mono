import { Command } from 'commander';
import { filterService } from '../../../../packages/shared/services/filter-service';
import chalk from 'chalk';
import Table from 'cli-table3';

const command = new Command('list-profiles');

command
  .description('List all available filter profiles')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const profiles = await filterService.listProfiles();
      
      if (profiles.length === 0) {
        console.log(chalk.yellow('No filter profiles found'));
        return;
      }
      
      // If JSON output is requested
      if (options.json) {
        console.log(JSON.stringify(profiles, null, 2));
        return;
      }
      
      // Create a formatted table
      const table = new Table({
        head: [
          chalk.cyan('ID'), 
          chalk.cyan('Name'), 
          chalk.cyan('Description'), 
          chalk.cyan('Active'), 
          chalk.cyan('Criteria')
        ],
        colWidths: [36, 20, 30, 10, 40]
      });
      
      // Add rows for each profile
      profiles.forEach(profile => {
        const criteriaCount = profile.filter_criteria 
          ? Object.keys(profile.filter_criteria).length 
          : 0;
        
        const criteriaDescription = criteriaCount > 0 
          ? `${criteriaCount} filter criteria defined` 
          : 'No filters defined';
        
        table.push([
          profile.id,
          profile.name,
          profile.description || '',
          profile.is_active ? chalk.green('✓') : '',
          criteriaDescription
        ]);
      });
      
      console.log(table.toString());
      console.log(`Total profiles: ${profiles.length}`);
      
      // Show the active profile
      const activeProfile = profiles.find(p => p.is_active);
      if (activeProfile) {
        console.log(chalk.blue(`Active profile: ${activeProfile.name} (${activeProfile.id})`));
      } else {
        console.log(chalk.yellow('No active profile set'));
      }
    } catch (error) {
      console.error(chalk.red('Error listing filter profiles:'), error);
      process.exit(1);
    }
  });

export default command;