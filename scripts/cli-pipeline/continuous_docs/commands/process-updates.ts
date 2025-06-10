#!/usr/bin/env ts-node

import { Command } from 'commander';
import chalk from 'chalk';
import { DocumentMonitoringService } from '../services/monitoring-service';

const program = new Command();

program
  .name('process-updates')
  .description('Process and update documentation that needs updating')
  .option('--path <path>', 'Process specific file path')
  .option('--force', 'Force update even if no changes detected')
  .option('--dry-run', 'Show what would be updated without making changes')
  .option('--verbose', 'Show detailed output')
  .action(async (options) => {
    const service = new DocumentMonitoringService();
    
    try {
      console.log(chalk.blue('🔄 Processing documentation updates...\n'));

      // Get documents to process
      const documents = await service.getDocumentsToUpdate();
      
      if (documents.length === 0 && !options.force) {
        console.log(chalk.yellow('No documents need updating at this time.'));
        return;
      }

      console.log(chalk.gray(`Found ${documents.length} documents to process\n`));

      let processed = 0;
      let failed = 0;

      for (const doc of documents) {
        // Apply path filter if provided
        if (options.path && !doc.file_path.includes(options.path)) continue;

        if (options.verbose) {
          console.log(chalk.gray(`Processing: ${doc.file_path}`));
        }

        try {
          if (options.dryRun) {
            console.log(chalk.yellow(`📝 Would update: ${doc.file_path}`));
            console.log(chalk.gray(`   Title: ${doc.title}`));
            console.log(chalk.gray(`   Area: ${doc.area}`));
            console.log(chalk.gray(`   Priority: ${doc.priority}`));
          } else {
            // In a real implementation, this would:
            // 1. Load the document template
            // 2. Gather updated data from various sources
            // 3. Regenerate the document content
            // 4. Save the updated document
            // 5. Update the monitoring record
            
            await service.processDocumentUpdate(doc);
            processed++;
            
            console.log(chalk.green(`✅ Updated: ${doc.file_path}`));
            console.log(chalk.gray(`   Next review: ${new Date(doc.next_review_date).toLocaleDateString()}`));
          }
        } catch (error) {
          failed++;
          console.error(chalk.red(`❌ Failed to update ${doc.file_path}:`), error);
        }
      }

      console.log('\n' + chalk.blue('Summary:'));
      console.log(chalk.gray(`- Documents found: ${documents.length}`));
      
      if (!options.dryRun) {
        console.log(chalk.gray(`- Successfully processed: ${processed}`));
        console.log(chalk.gray(`- Failed: ${failed}`));
      } else {
        console.log(chalk.yellow('\n⚠️  Dry run mode - no documents were updated'));
      }

      process.exit(failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error(chalk.red('Error processing updates:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);