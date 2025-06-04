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
import { verifyClaudeTemperatureCommand } from './commands/verify-claude-temperature';
import { summarizeMetadataFieldsCommand } from './commands/summarize-metadata-fields';
import { healthCheckCommand } from './commands/health-check';
import { createTemplateCommand } from './commands/create-template';
import { listTemplatesCommand } from './commands/list-templates';
import { associateTemplateCommand } from './commands/associate-template';
import { listTemplateAssociationsCommand } from './commands/list-template-associations';

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
  .description('Clean metadata by removing specified fields from prompt records')
  .option('-f, --fields <fields...>', 'Fields to remove (default: content,temperature)')
  .action(cleanPromptMetadataCommand);

// Verify Claude temperature command
program.command('verify-claude-temperature')
  .description('Verify that Claude service is using temperature=0')
  .action(verifyClaudeTemperatureCommand);

// Summarize metadata fields command
program.command('summarize-metadata')
  .description('Summarize metadata fields across all prompt records')
  .action(summarizeMetadataFieldsCommand);

// Health check command
program.command('health-check')
  .description('Check the health of the prompt service infrastructure')
  .option('--skip-database', 'Skip database connection check')
  .option('--skip-prompts', 'Skip prompt service check')
  .option('--skip-claude', 'Skip Claude service check')
  .option('-v, --verbose', 'Show verbose output')
  .action(healthCheckCommand);

// Template commands
program.command('create-template')
  .description('Create a new prompt output template')
  .argument('<name>', 'Name of the template')
  .argument('<template-path>', 'Path to the JSON template file')
  .option('-d, --description <description>', 'Description of the template')
  .option('--dry-run', 'Show what would be created without making changes', false)
  .action(createTemplateCommand);

program.command('list-templates')
  .description('List all prompt output templates')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(listTemplatesCommand);

program.command('associate-template')
  .description('Associate a template with a prompt')
  .argument('<prompt-name>', 'Name of the prompt')
  .argument('<template-name>', 'Name of the template')
  .option('-p, --priority <priority>', 'Priority of the association (default: 0)', '0')
  .option('--dry-run', 'Show what would be associated without making changes', false)
  .action((promptName, templateName, options) => {
    // Convert priority to number
    options.priority = parseInt(options.priority, 10);
    return associateTemplateCommand(promptName, templateName, options);
  });

program.command('list-template-associations')
  .description('List all templates associated with a prompt')
  .argument('<prompt-name>', 'Name of the prompt')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(listTemplateAssociationsCommand);

// Parse the arguments
program.parse(process.argv);