#!/usr/bin/env ts-node
import { Command } from 'commander';
import { FilterService } from '../../../../packages/shared/services/filter-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import chalk from 'chalk';

const command = new Command('health-check');

command
  .description('Check if the filter service and required tables are available')
  .option('--verbose', 'Show detailed diagnostic information')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('Running filter service health check...'));
      
      // Check database connection
      console.log('Checking database connection...');
      const supabase = SupabaseClientService.getInstance().getClient();
      const connectionTest = await supabase.from('document_types').select('id').limit(1);
      
      if (connectionTest.error) {
        console.error(chalk.red('✗ Database connection failed:'), connectionTest.error);
        process.exit(1);
      }
      
      console.log(chalk.green('✓ Database connection OK'));
      
      // Check filter tables exist
      console.log('Checking filter tables...');
      
      const profilesTest = await supabase.from('user_filter_profiles').select('id', { count: 'exact', head: true });
      if (profilesTest.error && profilesTest.error.code === '42P01') {
        console.error(chalk.red('✗ user_filter_profiles table not found. Run apply-migrations command first.'));
        process.exit(1);
      } else if (profilesTest.error) {
        console.error(chalk.red('✗ Error accessing user_filter_profiles table:'), profilesTest.error);
        process.exit(1);
      }
      
      console.log(chalk.green('✓ Filter tables exist'));
      
      // Create filter service instance with Supabase client
      const filterService = new FilterService(supabase);
      
      // Get active profile info
      const activeProfile = await filterService.loadActiveProfile();
      
      if (activeProfile) {
        console.log(chalk.green(`✓ Active filter profile: "${activeProfile.name}" (${activeProfile.id})`));
        
        if (options.verbose) {
          console.log(chalk.cyan('\nActive profile details:'));
          console.log(`Description: ${activeProfile.description || 'N/A'}`);
          console.log(`Created: ${activeProfile.created_at || 'N/A'}`);
          
          // Show excluded drives
          const drives = await filterService.listDrivesForProfile(activeProfile.id);
          console.log(chalk.cyan(`\nExcluded drives: ${drives.length}`));
          if (drives.length > 0 && drives.length < 10) {
            drives.forEach(drive => console.log(`- ${drive}`));
          } else if (drives.length >= 10) {
            console.log(`First 5 drives: ${drives.slice(0, 5).join(', ')}...`);
          }
        }
      } else {
        console.log(chalk.yellow('⚠️ No active filter profile set'));
      }
      
      // Check available profiles
      const profiles = await filterService.listProfiles();
      console.log(chalk.green(`✓ Available filter profiles: ${profiles.length}`));
      
      if (options.verbose && profiles.length > 0) {
        console.log(chalk.cyan('\nAll available profiles:'));
        profiles.forEach(profile => {
          console.log(`- "${profile.name}" (${profile.id})${profile.is_active ? ' [ACTIVE]' : ''}`);
        });
      }
      
      console.log(chalk.green('\n✅ Filter service is healthy and ready to use'));
    } catch (error) {
      console.error(chalk.red('Error running health check:'), error);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;