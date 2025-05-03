#!/usr/bin/env ts-node
import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

const command = new Command('add-drive-to-profile');

interface CommandOptions {
  id: string;
  driveId: string;
  dryRun?: boolean;
}

command
  .description('Add a drive to a filter profile exclude list')
  .option('-i, --id <id>', 'Profile ID')
  .option('-d, --drive-id <driveId>', 'Drive ID to exclude')
  .option('--dry-run', 'Validate the command without making changes')
  .action(async (options: CommandOptions) => {
    try {
      // Validate required parameters
      if (!options.id) {
        console.error('❌ Profile ID is required. Use --id option.');
        process.exit(1);
      }
      
      if (!options.driveId) {
        console.error('❌ Drive ID is required. Use --drive-id option.');
        process.exit(1);
      }
      
      console.log(`Starting to add drive to profile. Options:`, {
        profileId: options.id,
        driveId: options.driveId,
        dryRun: options.dryRun || false
      });
      
      // Get supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Get the profile directly from database
      const { data: profile, error: profileError } = await supabase
        .from('user_filter_profiles')
        .select('*')
        .eq('id', options.id)
        .single();
      
      if (profileError || !profile) {
        console.error(`❌ Profile with ID ${options.id} not found: ${profileError?.message || 'No profile returned'}`);
        process.exit(1);
      }
      
      console.log(`Found profile: "${profile.name}" (${profile.id})`);
      
      // Check if table exists
      try {
        // Simple query to test if the table exists
        const { error: tableTestError } = await supabase
          .from('user_filter_profile_drives')
          .select('id')
          .limit(1);
          
        if (tableTestError && tableTestError.code === '42P01') { // Table doesn't exist
          console.error(`❌ The user_filter_profile_drives table does not exist.`);
          console.error('Please run the apply-migrations command to set up the required tables.');
          process.exit(1);
        }
      } catch (error) {
        console.error(`❌ Error checking table existence: ${error}`);
        console.error('You may need to run `apply-migrations` first to set up the required tables.');
        process.exit(1);
      }
      
      // Now check if drive exists in excluded drives
      try {
        const { data: existingDrives, error: existingDrivesError } = await supabase
          .from('user_filter_profile_drives')
          .select('*')
          .eq('profile_id', options.id)
          .eq('root_drive_id', options.driveId);
        
        if (existingDrivesError) {
          console.error(`❌ Error checking existing drives: ${existingDrivesError.message}`);
          process.exit(1);
        }
        
        if (existingDrives && existingDrives.length > 0) {
          console.log(`Drive with ID ${options.driveId} is already excluded in this profile`);
          return;
        }
      } catch (error) {
        console.error(`❌ Error checking existing drives: ${error}`);
        process.exit(1);
      }
      
      if (options.dryRun) {
        console.log(`✅ DRY RUN: Would add drive ID "${options.driveId}" to filter profile "${profile.name}"`);
        return;
      }
      
      // Add the drive directly to the profile
      try {
        const { data: result, error: insertError } = await supabase
          .from('user_filter_profile_drives')
          .insert({
            id: uuidv4(),
            profile_id: options.id,
            root_drive_id: options.driveId,
            include_children: true
          })
          .select();
        
        if (insertError) {
          console.error(`❌ Failed to add drive to filter profile: ${insertError.message}`);
          process.exit(1);
        }
        
        if (result && result.length > 0) {
          console.log(`✅ Drive ID "${options.driveId}" added to filter profile "${profile.name}"`);
        } else {
          console.error('❌ Failed to add drive to filter profile (no result returned)');
          process.exit(1);
        }
      } catch (error) {
        console.error(`❌ Failed to add drive to filter profile: ${error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error adding drive to filter profile:', error);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;