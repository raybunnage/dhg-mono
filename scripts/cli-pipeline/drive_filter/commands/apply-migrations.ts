#!/usr/bin/env ts-node
import { Command } from 'commander';
import { FilterService } from '../../../../packages/shared/services/filter-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
// Fix module compatibility per CLAUDE.md
const chalk = require('chalk');

interface CommandOptions {
  dryRun?: boolean;
}

const command = new Command('apply-migrations');

command
  .description('Apply the database migrations for filter tables')
  .option('--dry-run', 'Show the SQL statements without executing them')
  .action(async (options: CommandOptions) => {
    try {
      const migrationSQL = FilterService.generateMigrationSQL();
      
      // If this is a dry run, just show the SQL
      if (options.dryRun) {
        console.log('Migration SQL (dry run):');
        console.log(migrationSQL);
        return;
      }
      
      console.log('Applying filter service migrations...');
      
      // Execute the SQL
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Try to apply the migration directly
      try {
        const { error } = await supabase.rpc('execute_sql', { sql: migrationSQL });
        
        if (error) {
          if (error.message && error.message.includes('does not exist')) {
            console.error('The execute_sql function does not exist.');
            console.error('Please run these SQL statements directly in your database:');
            console.log(migrationSQL);
            process.exit(1);
          }
          
          console.error('Error applying migrations:', error.message);
          console.error('Please run these SQL statements directly in your database:');
          console.log(migrationSQL);
          process.exit(1);
        }
      } catch (err: any) {
        console.error('Error applying migrations:', err.message);
        console.error('Please run these SQL statements directly in your database:');
        console.log(migrationSQL);
        process.exit(1);
      }
      
      console.log('✅ Filter service migrations applied successfully');
      
      // Verify tables exist
      try {
        // Verify filter_user_profiles table
        const { error: profileError } = await supabase
          .from('filter_user_profiles')
          .select('id')
          .limit(1);
        
        if (profileError) {
          console.error('⚠️ Migrations appeared to apply, but filter_user_profiles table verification failed:', profileError.message);
          process.exit(1);
        }
        
        console.log('✓ Tables verified: filter_user_profiles exists');
        
        // Verify filter_user_profile_drives table
        const { error: drivesError } = await supabase
          .from('filter_user_profile_drives')
          .select('id')
          .limit(1);
          
        if (drivesError) {
          console.error('⚠️ Migrations appeared to apply, but filter_user_profile_drives table verification failed:', drivesError.message);
          process.exit(1);
        }
        
        console.log('✓ Tables verified: filter_user_profile_drives exists');
        
        // Verify drive_id column in filter_user_profile_drives
        try {
          const { error: driveIdError } = await supabase
            .from('filter_user_profile_drives')
            .select('drive_id')
            .limit(1);
            
          if (driveIdError && driveIdError.message.includes('does not exist')) {
            console.error('⚠️ The drive_id column is missing in filter_user_profile_drives table');
            process.exit(1);
          }
          
          console.log('✓ Column verified: drive_id exists in filter_user_profile_drives');
        } catch (err: any) {
          console.error('⚠️ Error verifying drive_id column:', err.message);
          process.exit(1);
        }
        
        console.log('✓ Ready to use filter service');
      } catch (err: any) {
        console.error('Error verifying tables:', err.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error applying migrations:', error);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;