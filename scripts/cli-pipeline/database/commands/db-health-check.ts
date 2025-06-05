import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import chalk from 'chalk';

const program = new Command();

program
  .name('db-health-check')
  .description('Simple database health check')
  .option('--debug', 'Show debug information')
  .action(async (options) => {
    try {
      // Always show debug info for now to troubleshoot issues
      const showDebug = true;
      
      // Explicitly flush console output
      process.stdout.write(chalk.blue('Running simple database health check...\n'));
      process.stdout.write(chalk.yellow('DEBUG: Starting health check\n'));
      
      if (showDebug) {
        // Show environment variables for debugging
        process.stdout.write(`DEBUG: Current working directory: ${process.cwd()}\n`);
        process.stdout.write(`DEBUG: SUPABASE_URL: ${process.env.SUPABASE_URL ? 'defined' : 'undefined'}\n`);
        process.stdout.write(`DEBUG: SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'defined' : 'undefined'}\n`);
      }
      
      // Get the Supabase client
      process.stdout.write(chalk.yellow('DEBUG: Getting Supabase client\n'));
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Try a simple query to test connection
      process.stdout.write(chalk.cyan('Testing connection to document_types table...\n'));
      
      process.stdout.write(chalk.yellow('DEBUG: Executing query\n'));
      const { data, error } = await supabase
        .from('document_types')
        .select('id, name')
        .limit(3);
      
      process.stdout.write(chalk.yellow(`DEBUG: Query complete, error=${!!error}, data=${!!data}\n`));
      
      if (error) {
        process.stdout.write(chalk.red(`✗ Database connection failed: ${error.message}\n`));
        if (showDebug) {
          process.stdout.write(chalk.yellow(`DEBUG: Error details: ${JSON.stringify(error)}\n`));
        }
        process.exit(1);
      } else {
        process.stdout.write(chalk.green(`✓ Database connection successful!\n`));
        process.stdout.write(chalk.green(`✓ Retrieved ${data.length} document types\n`));
        
        // Show the document types
        if (data && data.length > 0) {
          process.stdout.write(chalk.cyan('\nSample document types:\n'));
          data.forEach((item, index) => {
            process.stdout.write(`  ${index + 1}. ${item.name} (ID: ${item.id})\n`);
          });
        }
      }
    } catch (error) {
      process.stdout.write(chalk.red(`Error running health check: ${error instanceof Error ? error.message : String(error)}\n`));
      process.exit(1);
    }
  });

export default program;