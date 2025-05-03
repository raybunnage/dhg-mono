#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

const command = new Command('get-active-profile');

interface FilterProfile {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
}

command
  .description('Get the currently active filter profile')
  .option('--json', 'Output as JSON')
  .option('--id-only', 'Output only the profile ID')
  .option('--name-only', 'Output only the profile name')
  .action(async (options: { json?: boolean, idOnly?: boolean, nameOnly?: boolean }) => {
    try {
      const supabase = SupabaseClientService.getInstance().getClient();
      const { data, error } = await supabase
        .from('user_filter_profiles')
        .select('*')
        .eq('is_active', true)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No active profile found (not a real error)
          console.log('No active profile set');
          process.exit(0);
        } else {
          console.error('Error getting active profile:', error);
          process.exit(1);
        }
      }
      
      const profile = data as FilterProfile;
      
      if (!profile) {
        console.log('No active profile set');
        process.exit(0);
      }

      // Different output formats
      if (options.json) {
        console.log(JSON.stringify(profile, null, 2));
      } else if (options.idOnly) {
        console.log(profile.id);
      } else if (options.nameOnly) {
        console.log(profile.name);
      } else {
        console.log('Active Filter Profile:');
        console.log('ID:          ' + profile.id);
        console.log('Name:        ' + profile.name);
        
        if (profile.description) {
          console.log('Description: ' + profile.description);
        }
        
        console.log('Created At:  ' + new Date(profile.created_at || '').toLocaleString());
      }
    } catch (error) {
      console.error('Error getting active profile:', error);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;