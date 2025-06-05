#!/usr/bin/env node

import { spawn } from 'child_process';
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('sync-emails')
  .description('Sync emails from Gmail to database')
  .option('-d, --days <number>', 'Number of days to sync', '7')
  .option('-i, --importance <level>', 'Minimum importance level (1-3)')
  .option('-m, --max-results <number>', 'Maximum emails to sync', '500')
  .option('-f, --full-sync', 'Disable incremental sync')
  .option('-c, --credentials <path>', 'Path to Gmail credentials file')
  .action(async (options) => {
    console.log(chalk.blue('🔄 Starting Gmail sync...'));
    
    // Build Python command
    const pythonScript = path.join(
      __dirname,
      '../../../packages/python-gmail-service/src/sync_emails.py'
    );
    
    // Check if Python script exists
    if (!fs.existsSync(pythonScript)) {
      console.error(chalk.red('Error: Python sync script not found!'));
      console.error(chalk.yellow(`Expected at: ${pythonScript}`));
      process.exit(1);
    }
    
    // Build arguments
    const args = ['--days', options.days, '--max-results', options.maxResults];
    
    if (options.importance) {
      args.push('--importance', options.importance);
    }
    
    if (options.fullSync) {
      args.push('--full-sync');
    }
    
    if (options.credentials) {
      args.push('--credentials', options.credentials);
    }
    
    // Check for credentials
    const hasServiceAccount = fs.existsSync('.service-account.json');
    const hasOAuthCreds = fs.existsSync('credentials.json');
    
    if (!hasServiceAccount && !hasOAuthCreds && !options.credentials) {
      console.error(chalk.red('❌ No Gmail credentials found!'));
      console.log(chalk.yellow('\nPlease provide one of the following:'));
      console.log('  1. Service account: .service-account.json');
      console.log('  2. OAuth credentials: credentials.json');
      console.log('  3. Use --credentials flag to specify path');
      process.exit(1);
    }
    
    // Run Python script
    console.log(chalk.gray(`Running: python3 ${path.basename(pythonScript)} ${args.join(' ')}`));
    
    const pythonProcess = spawn('python3', [pythonScript, ...args], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(chalk.red(`Failed to start Python process: ${error.message}`));
      
      if (error.message.includes('ENOENT')) {
        console.log(chalk.yellow('\nMake sure Python 3 is installed:'));
        console.log('  brew install python3  # macOS');
        console.log('  apt install python3   # Ubuntu/Debian');
        
        console.log(chalk.yellow('\nThen install Python dependencies:'));
        console.log('  cd packages/python-gmail-service');
        console.log('  pip3 install -r requirements.txt');
      }
      
      process.exit(1);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(chalk.red(`\n❌ Sync failed with exit code ${code}`));
        process.exit(code);
      } else {
        console.log(chalk.green('\n✅ Email sync completed successfully!'));
      }
    });
  });

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse(process.argv);