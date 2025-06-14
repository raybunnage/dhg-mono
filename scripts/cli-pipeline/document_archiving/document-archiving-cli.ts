#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { documentArchivingService } from '../../../packages/shared/services/document-archiving-service';
import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();

program
  .name('document-archiving-cli')
  .description('Document archiving management CLI')
  .version('1.0.0');

// Archive a single document
program
  .command('archive')
  .description('Archive a single document')
  .option('-p, --path <path>', 'Path to the document')
  .option('-t, --type <type>', 'Document type (living_doc, technical_spec, guide, report, solution, feature_doc, other)')
  .option('-r, --reason <reason>', 'Reason for archiving')
  .option('-s, --superseded-by <path>', 'Path to the replacement document')
  .option('--no-move', 'Do not move the physical file')
  .action(async (options) => {
    try {
      // Interactive prompts if options not provided
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Document path:',
          when: !options.path,
          validate: (input: string) => input.trim() !== '' || 'Path is required'
        },
        {
          type: 'list',
          name: 'type',
          message: 'Document type:',
          choices: ['living_doc', 'technical_spec', 'guide', 'report', 'solution', 'feature_doc', 'other'],
          when: !options.type,
          default: 'living_doc'
        },
        {
          type: 'input',
          name: 'reason',
          message: 'Reason for archiving:',
          when: !options.reason,
          validate: (input: string) => input.trim() !== '' || 'Reason is required'
        },
        {
          type: 'input',
          name: 'supersededBy',
          message: 'Superseded by (optional):',
          when: !options.supersededBy
        }
      ]);

      const finalOptions = { ...options, ...answers };

      console.log(chalk.blue('\n📦 Archiving document...'));
      
      const result = await documentArchivingService.archiveDocument({
        originalPath: finalOptions.path,
        documentType: finalOptions.type,
        archiveReason: finalOptions.reason,
        supersededBy: finalOptions.supersededBy || undefined,
        archivedBy: 'cli-user'
      });

      if (options.move !== false) {
        try {
          const archivedPath = await documentArchivingService.moveToArchiveDirectory(finalOptions.path);
          console.log(chalk.green(`✅ File moved to: ${archivedPath}`));
        } catch (error) {
          console.log(chalk.yellow('⚠️  Could not move file (may already be archived)'));
        }
      }

      console.log(chalk.green('\n✅ Document archived successfully!'));
      console.log(chalk.gray(`Archive ID: ${result.id}`));
      console.log(chalk.gray(`Archive date: ${result.archive_date}`));
      
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Archive multiple living docs
program
  .command('archive-living-docs')
  .description('Archive multiple living documents')
  .option('-f, --file <file>', 'File containing list of documents to archive (one per line)')
  .option('-r, --reason <reason>', 'Common reason for archiving')
  .option('-s, --superseded-by <path>', 'Document that supersedes all of these')
  .action(async (options) => {
    try {
      let documents: string[] = [];
      
      if (options.file) {
        const content = await fs.readFile(options.file, 'utf-8');
        documents = content.split('\n').filter(line => line.trim());
      } else {
        // Interactive mode
        const { docs } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'docs',
            message: 'Enter document paths (one per line):'
          }
        ]);
        documents = docs.split('\n').filter((line: string) => line.trim());
      }

      if (documents.length === 0) {
        console.log(chalk.yellow('No documents to archive'));
        return;
      }

      const { reason, supersededBy } = await inquirer.prompt([
        {
          type: 'input',
          name: 'reason',
          message: 'Common reason for archiving:',
          when: !options.reason,
          validate: (input: string) => input.trim() !== '' || 'Reason is required'
        },
        {
          type: 'input',
          name: 'supersededBy',
          message: 'Superseded by (optional):',
          when: !options.supersededBy
        }
      ]);

      const finalReason = options.reason || reason;
      const finalSupersededBy = options.supersededBy || supersededBy;

      console.log(chalk.blue(`\n📦 Archiving ${documents.length} documents...`));

      for (const doc of documents) {
        try {
          console.log(chalk.gray(`\nArchiving: ${doc}`));
          const result = await documentArchivingService.archiveLivingDocument(
            doc,
            finalReason,
            finalSupersededBy,
            true // move file
          );
          console.log(chalk.green(`✅ Archived: ${doc}`));
        } catch (error: any) {
          console.error(chalk.red(`❌ Failed to archive ${doc}: ${error.message}`));
        }
      }

      console.log(chalk.green('\n✅ Archiving complete!'));
      
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// List archived documents
program
  .command('list')
  .description('List archived documents')
  .option('-t, --type <type>', 'Filter by document type')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .action(async (options) => {
    try {
      const documents = await documentArchivingService.getArchivedDocuments(
        options.type,
        parseInt(options.limit)
      );

      if (documents.length === 0) {
        console.log(chalk.yellow('No archived documents found'));
        return;
      }

      console.log(chalk.bold(`\n📚 Archived Documents (${documents.length}):\n`));
      
      documents.forEach((doc) => {
        console.log(chalk.cyan(`📄 ${doc.file_name}`));
        console.log(chalk.gray(`   Path: ${doc.original_path}`));
        console.log(chalk.gray(`   Type: ${doc.document_type}`));
        console.log(chalk.gray(`   Reason: ${doc.archive_reason}`));
        if (doc.superseded_by) {
          console.log(chalk.yellow(`   Superseded by: ${doc.superseded_by}`));
        }
        console.log(chalk.gray(`   Archived: ${new Date(doc.archive_date).toLocaleString()}`));
        console.log();
      });
      
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Search archived documents
program
  .command('search')
  .description('Search archived documents')
  .argument('<term>', 'Search term')
  .action(async (searchTerm) => {
    try {
      const documents = await documentArchivingService.searchArchivedDocuments(searchTerm);

      if (documents.length === 0) {
        console.log(chalk.yellow(`No archived documents found matching "${searchTerm}"`));
        return;
      }

      console.log(chalk.bold(`\n🔍 Search Results (${documents.length}):\n`));
      
      documents.forEach((doc) => {
        console.log(chalk.cyan(`📄 ${doc.file_name}`));
        console.log(chalk.gray(`   Path: ${doc.original_path}`));
        console.log(chalk.gray(`   Reason: ${doc.archive_reason}`));
        console.log(chalk.gray(`   Archived: ${new Date(doc.archive_date).toLocaleString()}`));
        console.log();
      });
      
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Show documents superseded by a specific document
program
  .command('superseded-by')
  .description('Show documents superseded by a specific document')
  .argument('<path>', 'Path of the superseding document')
  .action(async (supersedingPath) => {
    try {
      const documents = await documentArchivingService.getSupersededDocuments(supersedingPath);

      if (documents.length === 0) {
        console.log(chalk.yellow(`No documents found superseded by "${supersedingPath}"`));
        return;
      }

      console.log(chalk.bold(`\n📚 Documents superseded by ${supersedingPath} (${documents.length}):\n`));
      
      documents.forEach((doc) => {
        console.log(chalk.cyan(`📄 ${doc.file_name}`));
        console.log(chalk.gray(`   Original path: ${doc.original_path}`));
        console.log(chalk.gray(`   Archive reason: ${doc.archive_reason}`));
        console.log(chalk.gray(`   Archived: ${new Date(doc.archive_date).toLocaleString()}`));
        console.log();
      });
      
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);