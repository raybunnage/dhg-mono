#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
const chalk = require('chalk');

const command = new Command('list-profiles');

interface FilterProfile {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
}

command
  .description('List all available filter profiles')
  .option('--json', 'Output as JSON')
  .option('--no-format', 'Output without formatting (for piping)')
  .action(async (options: { json?: boolean, format?: boolean }) => {
    try {
      const supabase = SupabaseClientService.getInstance().getClient();
      const { data: profiles, error } = await supabase
        .from('filter_user_profiles')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error listing profiles:', error);
        process.exit(1);
      }
      
      if (!profiles || profiles.length === 0) {
        console.log('No profiles found');
        process.exit(0);
      }

      // If JSON output is requested
      if (options.json) {
        console.log(JSON.stringify(profiles, null, 2));
        process.exit(0);
      }
      
      // Print header
      console.log('Filter Profiles:');
      console.log('===============');
      
      // Print header
      const header = 'ID                                   | Name                 | Description                      | Active';
      console.log(header);
      console.log('------------------------------------ | -------------------- | -------------------------------- | ------');
      
      // Print each profile
      profiles.forEach((profile: FilterProfile) => {
        const id = profile.id.padEnd(36, ' ');
        const name = (profile.name || '').padEnd(20, ' ');
        const description = (profile.description || '').padEnd(32, ' ');
        const active = profile.is_active ? '✓' : '';
        
        console.log(`${id} | ${name} | ${description} | ${active}`);
      });
      
      console.log(`\nTotal profiles: ${profiles.length}`);
      
      // Show active profile
      const activeProfile = profiles.find(p => p.is_active);
      if (activeProfile) {
        console.log(`Active profile: ${activeProfile.name} (${activeProfile.id})`);
      } else {
        console.log('No active profile set');
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;