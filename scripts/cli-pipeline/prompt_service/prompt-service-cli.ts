#!/usr/bin/env node

// Use the commander package we just installed locally
import { Command } from 'commander';
import { loadPromptCommand } from './commands/load-prompt';
import { listPromptsCommand } from './commands/list-prompts';
import { viewPromptCommand } from './commands/view-prompt';
import { viewPromptMetadataCommand } from './commands/view-prompt-metadata';
import { addQueryCommand } from './commands/add-query';
import { updatePromptCommand } from './commands/update-prompt';
import { cleanPromptMetadataCommand } from './commands/clean-prompt-metadata';

const program = new Command();

program
  .name('prompt-service-cli')
  .description('CLI to manage prompts across the application')
  .version('1.0.0');

// Load prompt command
program.command('load')
  .description('Load a prompt file into the database')
  .argument('<file-path>', 'Path to the prompt file')
  .option('-r, --replace', 'Replace existing prompt with the same name', false)
  .option('-n, --name <n>', 'Override the name of the prompt (defaults to filename)')
  .option('-c, --category <category>', 'Category for the prompt')
  .action(loadPromptCommand);

// List prompts command
program.command('list')
  .description('List all prompts in the database')
  .option('-c, --category <category>', 'Filter by category')
  .option('-s, --status <status>', 'Filter by status (active, draft, deprecated, archived)')
  .action(listPromptsCommand);

// View prompt command
program.command('view')
  .description('View the content of a prompt')
  .argument('<n>', 'Name of the prompt to view')
  .option('-f, --format <format>', 'Output format (json, text, markdown)', 'text')
  .action(viewPromptCommand);

// View prompt metadata command
program.command('view-metadata')
  .description('View only the metadata of a prompt')
  .argument('<n>', 'Name of the prompt to view')
  .action(viewPromptMetadataCommand);

// Add database query command
program.command('add-query')
  .description('Add or update a database query for a prompt')
  .argument('<prompt-name>', 'Name of the prompt to update')
  .argument('<database-query>', 'SQL query to add to the prompt metadata')
  .option('--query2', 'Use databaseQuery2 field instead of databaseQuery', false)
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .action(addQueryCommand);

// Update prompt command
program.command('update')
  .description('Update a prompt in the database from a file')
  .argument('<prompt-name>', 'Name of the prompt to update')
  .argument('<file-path>', 'Path to the updated prompt file')
  .option('--dry-run', 'Show what would be updated without making changes', false)
  .action(updatePromptCommand);

// Clean prompt metadata command
program.command('clean-metadata')
  .description('Clean prompt metadata by removing the "content" field')
  .action(cleanPromptMetadataCommand);

// Parse the arguments
program.parse(process.argv);