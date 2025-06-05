#!/usr/bin/env ts-node
/**
 * Unified Classification Command
 * 
 * A single command that handles classification for all file types
 * through an intelligent, extensible interface.
 */

import { Command } from 'commander';
import { unifiedClassificationService } from '../../../packages/shared/services/unified-classification-service';
import { Logger } from '../../../packages/shared/utils/logger';
import chalk from 'chalk';
import { SupportedFileType } from '../../../packages/shared/services/unified-classification-service/types';

const program = new Command();

// Parse file types from comma-separated string
function parseFileTypes(value: string): SupportedFileType[] {
  const types = value.split(',').map(t => t.trim().toLowerCase());
  const validTypes: SupportedFileType[] = [
    'pdf', 'docx', 'doc', 'txt', 'md', 'pptx', 'ppt', 
    'xlsx', 'xls', 'audio', 'video', 'image', 
    'google-doc', 'google-slides', 'google-sheets'
  ];
  
  const result: SupportedFileType[] = [];
  for (const type of types) {
    if (validTypes.includes(type as SupportedFileType)) {
      result.push(type as SupportedFileType);
    } else {
      console.warn(chalk.yellow(`Warning: Unknown file type '${type}' will be ignored`));
    }
  }
  
  return result;
}

program
  .name('classify')
  .description('Universal document classification command - handles all file types')
  .option('--types <types>', 'Comma-separated list of file types to process (e.g., pdf,docx,pptx)', parseFileTypes)
  .option('--limit <number>', 'Maximum number of files to process', parseInt, 10)
  .option('--concurrency <number>', 'Number of files to process in parallel', parseInt, 3)
  .option('--force', 'Force reclassification of already classified files', false)
  .option('--dry-run', 'Preview what would be classified without making changes', false)
  .option('--verbose', 'Show detailed processing information', false)
  .option('--filter-profile <name>', 'Use a specific filter profile')
  .option('--status <status>', 'Process only files with specific pipeline status')
  .option('--expert <name>', 'Process only files associated with a specific expert')
  .option('--skip-classified', 'Skip files that already have a document type', false)
  .option('--custom-prompt <name>', 'Override default prompt selection with a specific prompt')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('\n🤖 Unified Document Classification'));
      console.log(chalk.cyan('================================\n'));

      // Display options
      if (options.verbose) {
        console.log(chalk.gray('Options:'));
        console.log(chalk.gray(`  File types: ${options.types ? options.types.join(', ') : 'all'}`));
        console.log(chalk.gray(`  Limit: ${options.limit || 'none'}`));
        console.log(chalk.gray(`  Concurrency: ${options.concurrency || 3}`));
        console.log(chalk.gray(`  Force: ${options.force ? 'yes' : 'no'}`));
        console.log(chalk.gray(`  Dry run: ${options.dryRun ? 'yes' : 'no'}`));
        console.log(chalk.gray(`  Skip classified: ${options.skipClassified ? 'yes' : 'no'}`));
        if (options.filterProfile) {
          console.log(chalk.gray(`  Filter profile: ${options.filterProfile}`));
        }
        if (options.status) {
          console.log(chalk.gray(`  Pipeline status: ${options.status}`));
        }
        if (options.expert) {
          console.log(chalk.gray(`  Expert: ${options.expert}`));
        }
        if (options.customPrompt) {
          console.log(chalk.gray(`  Custom prompt: ${options.customPrompt}`));
        }
        console.log();
      }

      // Run classification
      const result = await unifiedClassificationService.classifyDocuments({
        types: options.types,
        limit: options.limit,
        concurrency: options.concurrency,
        force: options.force,
        dryRun: options.dryRun,
        verbose: options.verbose,
        filterProfile: options.filterProfile,
        status: options.status,
        expertName: options.expert,
        skipClassified: options.skipClassified,
        customPrompt: options.customPrompt
      });

      // Display results
      console.log(chalk.cyan('\n📊 Classification Results'));
      console.log(chalk.cyan('========================\n'));

      console.log(`Total files found: ${chalk.bold(result.totalFiles)}`);
      console.log(`Files processed: ${chalk.bold(result.processedFiles)}`);
      console.log(`Successful: ${chalk.green(result.successfulFiles)}`);
      console.log(`Failed: ${chalk.red(result.failedFiles)}`);
      console.log(`Skipped: ${chalk.yellow(result.skippedFiles)}`);
      console.log(`Processing time: ${chalk.gray((result.processingTime / 1000).toFixed(2) + 's')}\n`);

      // Show details for failed files
      if (result.failedFiles > 0 && options.verbose) {
        console.log(chalk.red('\n❌ Failed Files:'));
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error.fileName}: ${error.error}`));
        }
      }

      // Show sample of successful classifications
      if (result.successfulFiles > 0 && options.verbose) {
        console.log(chalk.green('\n✅ Sample Classifications (first 5):'));
        const successfulResults = result.results.filter(r => r.success).slice(0, 5);
        
        for (const res of successfulResults) {
          console.log(chalk.green(`\n  📄 ${res.fileName}`));
          console.log(chalk.gray(`     Type: ${res.documentTypeName}`));
          console.log(chalk.gray(`     Confidence: ${(res.confidence * 100).toFixed(1)}%`));
          if (res.summary) {
            console.log(chalk.gray(`     Summary: ${res.summary.substring(0, 100)}...`));
          }
          if (res.concepts && res.concepts.length > 0) {
            console.log(chalk.gray(`     Concepts: ${res.concepts.slice(0, 3).map(c => c.name).join(', ')}`));
          }
        }
      }

      // Show dry run notice
      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  DRY RUN MODE - No changes were made to the database'));
      }

      // Exit code based on failures
      if (result.failedFiles > 0 && !options.dryRun) {
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

// Show help with examples
program.on('--help', () => {
  console.log('\nExamples:');
  console.log('  # Classify all PDF files');
  console.log('  $ ./google-sync-cli.sh classify --types pdf');
  console.log('');
  console.log('  # Classify multiple file types with limit');
  console.log('  $ ./google-sync-cli.sh classify --types pdf,docx,pptx --limit 20');
  console.log('');
  console.log('  # Dry run with verbose output');
  console.log('  $ ./google-sync-cli.sh classify --types txt,md --dry-run --verbose');
  console.log('');
  console.log('  # Force reclassification with custom concurrency');
  console.log('  $ ./google-sync-cli.sh classify --force --concurrency 5');
  console.log('');
  console.log('  # Classify files for a specific expert');
  console.log('  $ ./google-sync-cli.sh classify --expert "John Doe" --types pdf');
  console.log('');
  console.log('  # Use a custom prompt for classification');
  console.log('  $ ./google-sync-cli.sh classify --custom-prompt scientific-document-analysis-prompt');
  console.log('');
  console.log('Supported file types:');
  console.log('  Documents: pdf, docx, doc, txt, md');
  console.log('  Presentations: pptx, ppt, google-slides');
  console.log('  Spreadsheets: xlsx, xls, google-sheets');
  console.log('  Media: audio, video');
  console.log('  Images: image (includes jpg, png, gif)');
  console.log('  Google Docs: google-doc');
});

// Parse command line arguments
program.parse(process.argv);