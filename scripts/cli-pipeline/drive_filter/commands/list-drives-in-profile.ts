import { Command } from 'commander';
import { FilterService } from '../../../../packages/shared/services/filter-service';
import chalk from 'chalk';
import Table from 'cli-table3';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

const command = new Command('list-drives-in-profile');

command
  .description('List all drives included in a filter profile')
  .option('-i, --id <id>', 'Profile ID (defaults to active profile if not specified)')
  .option('--json', 'Output as JSON')
  .option('--verbose', 'Show drive details (name, path, etc.)')
  .action(async (options) => {
    try {
      // Create filter service instance with Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      const filterService = new FilterService(supabase);
      
      let profileId = options.id;
      
      // If no profile ID specified, use the active profile
      if (!profileId) {
        const activeProfile = await filterService.loadActiveProfile();
        if (!activeProfile) {
          console.error(chalk.red('❌ No active profile found. Please specify a profile ID with --id or set an active profile.'));
          process.exit(1);
        }
        profileId = activeProfile.id;
        console.log(chalk.cyan(`Using active profile: ${activeProfile.name}`));
      }
      
      // First load the profile to confirm it exists
      const profile = await filterService.loadProfile(profileId);
      
      if (!profile) {
        console.error(chalk.red(`❌ Profile with ID ${profileId} not found`));
        process.exit(1);
      }
      
      console.log(chalk.green(`✓ Found profile: ${profile.name}`));
      
      // Get the list of drive IDs
      const driveIds = await filterService.listDrivesForProfile(profileId);
      
      if (driveIds.length === 0) {
        console.log(chalk.yellow(`No drives included in profile "${profile.name}"`));
        return;
      }
      
      // If JSON output is requested
      if (options.json) {
        console.log(JSON.stringify(driveIds, null, 2));
        return;
      }
      
      // Simple output if not verbose
      if (!options.verbose) {
        console.log(chalk.cyan(`Drives included in profile "${profile.name}":`));
        driveIds.forEach((driveId: string) => {
          console.log(driveId);
        });
        console.log(`\nTotal included drives: ${driveIds.length}`);
        return;
      }
      
      // Verbose output with drive details
      console.log(chalk.cyan(`Fetching details for ${driveIds.length} drives included in profile "${profile.name}"...`));
      
      // Get drive details from sources_google table (reuse the supabase client)
      const { data: drives, error } = await supabase
        .from('google_sources')
        .select('id, drive_id, name, path, mime_type')
        .in('drive_id', driveIds);
      
      if (error) {
        console.error(chalk.red('Error fetching drive details:'), error);
        // Fall back to simple listing
        driveIds.forEach((driveId: string) => {
          console.log(driveId);
        });
        return;
      }
      
      // Create a formatted table
      const table = new Table({
        head: [
          chalk.cyan('Drive ID'), 
          chalk.cyan('Name'), 
          chalk.cyan('Path'),
          chalk.cyan('Mime Type')
        ],
        colWidths: [36, 30, 40, 20]
      });
      
      // Add rows for each drive
      drives.forEach(drive => {
        table.push([
          drive.drive_id,
          drive.name || '',
          drive.path || '',
          drive.mime_type || ''
        ]);
      });
      
      console.log(table.toString());
      console.log(`\nTotal included drives: ${driveIds.length}`);
      
      // Check if any drive IDs are not found in the database
      const foundDriveIds = drives.map(d => d.drive_id);
      const missingDriveIds = driveIds.filter((id: string) => !foundDriveIds.includes(id));
      
      if (missingDriveIds.length > 0) {
        console.log(chalk.yellow(`\nWARNING: ${missingDriveIds.length} drive IDs not found in database:`));
        missingDriveIds.forEach((id: string) => {
          console.log(id);
        });
      }
    } catch (error) {
      console.error(chalk.red('Error listing drives in filter profile:'), error);
      process.exit(1);
    }
  });

// Parse command line arguments if running directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;