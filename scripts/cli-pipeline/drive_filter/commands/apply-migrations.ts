import { Command } from 'commander';
import { FilterService } from '../../../../packages/shared/services/filter-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import chalk from 'chalk';

const command = new Command('apply-migrations');

command
  .description('Apply the database migrations for filter tables')
  .option('--dry-run', 'Show the SQL statements without executing them')
  .action(async (options) => {
    try {
      const migrationSQL = FilterService.generateMigrationSQL();
      
      // If this is a dry run, just show the SQL
      if (options.dryRun) {
        console.log(chalk.blue('Migration SQL (dry run):'));
        console.log(chalk.gray(migrationSQL));
        return;
      }
      
      console.log(chalk.cyan('Applying filter service migrations...'));
      
      // Execute the SQL
      const supabase = SupabaseClientService.getInstance().getClient();
      const { error } = await supabase.rpc('execute_sql', { sql: migrationSQL });
      
      if (error) {
        console.error(chalk.red('Error applying migrations:'), error);
        process.exit(1);
      }
      
      console.log(chalk.green('✅ Filter service migrations applied successfully'));
      
      // Verify tables exist by counting rows
      const { data: profileCount, error: countError } = await supabase
        .from('user_filter_profiles')
        .select('id', { count: 'exact', head: true });
      
      if (countError) {
        console.error(chalk.yellow('⚠️ Migrations appeared to apply, but verification failed:'), countError);
        process.exit(1);
      }
      
      console.log(chalk.green('✓ Tables verified: user_filter_profiles exists'));
      console.log(chalk.green('✓ Ready to use filter service'));
    } catch (error) {
      console.error(chalk.red('Error applying migrations:'), error);
      process.exit(1);
    }
  });

export default command;