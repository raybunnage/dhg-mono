#!/usr/bin/env node

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import chalk from 'chalk';

// Get Supabase client
const supabase = SupabaseClientService.getInstance().getClient();

// Create the command
const program = new Command();

program
  .name('manage-addresses')
  .description('Manage important email addresses for Gmail sync')
  .version('1.0.0');

// Add subcommand
program
  .command('add <email>')
  .description('Add an important email address')
  .option('-i, --importance <level>', 'Importance level (1-3)', '1')
  .action(async (email: string, options: { importance: string }) => {
    console.log(chalk.blue('Adding email address...'));
    
    try {
      const importanceLevel = parseInt(options.importance);
      
      if (importanceLevel < 1 || importanceLevel > 3) {
        console.error(chalk.red('Importance level must be between 1 and 3'));
        process.exit(1);
      }
      
      // Check if email already exists
      const { data: existing, error: checkError } = await supabase
        .from('email_important_addresses')
        .select('*')
        .eq('email_address', email)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is expected for new emails
        throw checkError;
      }
      
      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('email_important_addresses')
          .update({ 
            importance_level: importanceLevel,
            updated_at: new Date().toISOString()
          })
          .eq('email_address', email);
        
        if (updateError) throw updateError;
        
        console.log(chalk.green(`✓ Updated ${email} with importance level ${importanceLevel}`));
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('email_important_addresses')
          .insert({
            email_address: email,
            importance_level: importanceLevel
          });
        
        if (insertError) throw insertError;
        
        console.log(chalk.green(`✓ Added ${email} with importance level ${importanceLevel}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// List subcommand
program
  .command('list')
  .description('List all important email addresses')
  .option('-i, --importance <level>', 'Filter by importance level')
  .action(async (options: { importance?: string }) => {
    console.log(chalk.blue('Loading email addresses...'));
    
    try {
      let query = supabase
        .from('email_important_addresses')
        .select('*')
        .order('importance_level', { ascending: false })
        .order('email_address');
      
      if (options.importance) {
        query = query.eq('importance_level', parseInt(options.importance));
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.log(chalk.yellow('No important email addresses found.'));
        return;
      }
      
      console.log(chalk.blue('\nImportant Email Addresses:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      data.forEach((addr) => {
        const importance = '⭐'.repeat(addr.importance_level);
        console.log(
          `${chalk.cyan(addr.email_address.padEnd(40))} ${importance} ${chalk.gray(`(Level ${addr.importance_level})`)}`
        );
      });
      
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.gray(`Total: ${data.length} addresses`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Remove subcommand
program
  .command('remove <email>')
  .description('Remove an email address')
  .action(async (email: string) => {
    console.log(chalk.blue('Removing email address...'));
    
    try {
      const { error } = await supabase
        .from('email_important_addresses')
        .delete()
        .eq('email_address', email);
      
      if (error) throw error;
      
      console.log(chalk.green(`✓ Removed ${email}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Update subcommand
program
  .command('update <email>')
  .description('Update importance level for an email address')
  .requiredOption('-i, --importance <level>', 'New importance level (1-3)')
  .action(async (email: string, options: { importance: string }) => {
    console.log(chalk.blue('Updating email address...'));
    
    try {
      const importanceLevel = parseInt(options.importance);
      
      if (importanceLevel < 1 || importanceLevel > 3) {
        console.error(chalk.red('Importance level must be between 1 and 3'));
        process.exit(1);
      }
      
      const { error } = await supabase
        .from('email_important_addresses')
        .update({ 
          importance_level: importanceLevel,
          updated_at: new Date().toISOString()
        })
        .eq('email_address', email);
      
      if (error) throw error;
      
      console.log(chalk.green(`✓ Updated ${email} to importance level ${importanceLevel}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}