#!/usr/bin/env ts-node

import { Command } from 'commander';
import chalk from 'chalk';
import { DocumentMonitoringService } from '../services/monitoring-service';

const program = new Command();

program
  .name('check-updates')
  .description('Check for documentation that needs updating')
  .option('--type <type>', 'Filter by document type')
  .option('--path <path>', 'Check specific file path')
  .option('--dry-run', 'Show what would be checked without updating records')
  .option('--verbose', 'Show detailed output')
  .action(async (options) => {
    const service = new DocumentMonitoringService();
    
    try {
      console.log(chalk.blue('🔍 Checking for documentation updates...\n'));

      // Get documents to check
      const documents = await service.getDocumentsToCheck();
      
      if (documents.length === 0) {
        console.log(chalk.yellow('No documents need checking at this time.'));
        return;
      }

      console.log(chalk.gray(`Found ${documents.length} documents to check\n`));

      let updatesFound = 0;
      const results = [];

      for (const doc of documents) {
        // Apply filters if provided
        if (options.type && doc.doc_type !== options.type) continue;
        if (options.path && !doc.file_path.includes(options.path)) continue;

        if (options.verbose) {
          console.log(chalk.gray(`Checking: ${doc.file_path}`));
        }

        const check = await service.checkForUpdates(doc);
        
        if (check.hasChanges) {
          updatesFound++;
          results.push(check);
          
          console.log(chalk.yellow(`📝 Update detected: ${doc.file_path}`));
          console.log(chalk.gray(`   Type: ${check.changeType}`));
          console.log(chalk.gray(`   Current hash: ${check.currentHash.substring(0, 8)}...`));
          console.log(chalk.gray(`   Stored hash: ${check.storedHash.substring(0, 8)}...`));
          
          if (check.changeType === 'dependencies') {
            console.log(chalk.gray(`   Dependencies: ${check.dependencies.join(', ')}`));
          }
        }

        // Update the last_checked timestamp unless dry run
        if (!options.dryRun) {
          await service.updateMonitoringRecord(doc.id, {
            last_checked: new Date().toISOString(),
            content_hash: check.currentHash,
            dependencies: check.dependencies
          });
        }
      }

      console.log('\n' + chalk.blue('Summary:'));
      console.log(chalk.gray(`- Documents checked: ${documents.length}`));
      console.log(chalk.gray(`- Updates found: ${updatesFound}`));
      
      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  Dry run mode - no records were updated'));
      }

      // Return results for potential further processing
      process.exit(updatesFound > 0 ? 0 : 0);
      
    } catch (error) {
      console.error(chalk.red('Error checking for updates:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);