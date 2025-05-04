import { Command } from 'commander';
import { filterService } from '../../../../packages/shared/services/filter-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
const chalk = require('chalk');

const command = new Command('set-active-profile');

interface CommandOptions {
  id?: string;
  profile?: string;
}

command
  .description('Set a filter profile as active')
  .option('-i, --id <id>', 'Profile ID to set as active')
  .option('-p, --profile <name>', 'Profile name to set as active')
  .action(async (options: CommandOptions) => {
    try {
      if (!options.id && !options.profile) {
        console.error(chalk.red('❌ Either --id or --profile must be specified'));
        process.exit(1);
      }
      
      // Get profile by ID or name
      let profileId = options.id;
      
      // If name is specified, look up the ID
      if (options.profile) {
        const supabase = SupabaseClientService.getInstance().getClient();
        const { data, error } = await supabase
          .from('user_filter_profiles')
          .select('id')
          .eq('name', options.profile)
          .single();
          
        if (error || !data) {
          console.error(chalk.red(`❌ Profile with name "${options.profile}" not found`));
          process.exit(1);
        }
        
        profileId = data.id;
      }
      
      // Set up previous active profile
      const { error: deactivateError } = await SupabaseClientService.getInstance().getClient()
        .from('user_filter_profiles')
        .update({ is_active: false })
        .not('id', 'eq', profileId);
        
      if (deactivateError) {
        console.error(chalk.red(`❌ Failed to deactivate other profiles: ${deactivateError.message}`));
        process.exit(1);
      }
      
      // Activate the selected profile  
      const { data, error: activateError } = await SupabaseClientService.getInstance().getClient()
        .from('user_filter_profiles')
        .update({ is_active: true })
        .eq('id', profileId)
        .select()
        .single();
        
      if (activateError) {
        console.error(chalk.red(`❌ Failed to activate profile: ${activateError.message}`));
        process.exit(1);
      }
      
      if (data) {
        console.log(chalk.green(`✅ Filter profile "${data.name}" set as active`));
      } else {
        console.error(chalk.red('❌ Failed to set profile as active (no data returned)'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error setting active profile:'), error);
      process.exit(1);
    }
  });

export default command;