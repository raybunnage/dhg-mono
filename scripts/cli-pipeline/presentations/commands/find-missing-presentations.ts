#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../../packages/shared/utils/logger';
import { PresentationService } from '../services/presentation-service';

/**
 * Command to find folders with path_depth=0 that have main_video_id but no presentation records,
 * and to identify videos that need text extraction
 */

interface CommandOptions {
  limit?: number;
  verbose?: boolean;
  format?: 'table' | 'json';
  outputFile?: string;
  includeProcessed?: boolean;
  searchName?: string;
  forceUnprocessed?: boolean;
  createMissing?: boolean;
  dryRun?: boolean;
  batchSize?: number;
}

const command = new Command('find-missing-presentations')
  .description('Find top-level folders with videos that need presentations created and identify mp4 files needing processing')
  .option('-l, --limit <number>', 'Limit the number of records to process', parseInt, 25)
  .option('-v, --verbose', 'Show verbose output')
  .option('-f, --format <format>', 'Output format (table or json)', 'table')
  .option('-o, --output-file <path>', 'Save output to a file')
  .option('--include-processed', 'Include already processed videos in the results')
  .option('-s, --search-name <string>', 'Search for folders containing this name')
  .option('--force-unprocessed', 'Force show videos as unprocessed even if they have content')
  .option('--create-missing', 'Create missing presentations for folders that need them')
  .option('--dry-run', 'Show what would be created without making any changes', true)
  .option('-b, --batch-size <number>', 'Maximum number of presentations to create in one batch', parseInt, 10)
  .action(async (options: CommandOptions) => {
    try {
      // Use process.stdout.write directly to ensure output is visible
      process.stdout.write('\n*** Starting to find missing presentations and unprocessed videos... ***\n\n');
      
      if (options.verbose) {
        process.stdout.write(`Options: ${JSON.stringify(options, null, 2)}\n`);
      }
      
      // Initialize PresentationService
      const presentationService = PresentationService.getInstance();
      
      // Step 1: Find folders without presentations
      process.stdout.write('Finding folders without presentations...\n');
      const missingPresentations = await presentationService.findFoldersWithoutPresentations({
        limit: options.limit
      });
      process.stdout.write(`Found ${missingPresentations.length} folders without presentations\n`);
      
      // Immediately list the missing presentations to console
      if (missingPresentations.length > 0) {
        process.stdout.write('\nFOLDERS WITHOUT PRESENTATIONS:\n');
        process.stdout.write('| Folder ID | Folder Name | Drive ID | Main Video ID |\n');
        process.stdout.write('|-----------|------------|----------|---------------|\n');
        
        missingPresentations.forEach(folder => {
          process.stdout.write(`| ${folder.id.substring(0, 8)}... | ${folder.name} | ${folder.drive_id} | ${folder.main_video_id} |\n`);
        });
        process.stdout.write('\n');
        
        // Create missing presentations if requested
        if (options.createMissing) {
          process.stdout.write('\n====== CREATING MISSING PRESENTATIONS ======\n');
          
          const createResult = await presentationService.createMissingPresentations(missingPresentations, {
            dryRun: options.dryRun,
            batchSize: options.batchSize,
            verbose: options.verbose,
            createAssets: true // Always create assets for new presentations
          });
          
          if (createResult.success) {
            process.stdout.write(`\n${createResult.message}\n`);
            
            if (createResult.created.length > 0) {
              process.stdout.write('\nCREATED PRESENTATIONS:\n');
              process.stdout.write('| Presentation ID | Title | Folder Name | Expert |\n');
              process.stdout.write('|-----------------|-------|-------------|--------|\n');
              
              createResult.created.forEach(item => {
                const presentation = item.presentation;
                const expertName = presentation.expert_document_id ? 'Found' : 'Not Found';
                process.stdout.write(`| ${presentation.id.substring(0, 8)}... | ${presentation.title} | ${item.folder.name} | ${expertName} |\n`);
              });
            }
            
            if (createResult.failed.length > 0) {
              process.stdout.write('\nFAILED TO CREATE:\n');
              process.stdout.write('| Folder Name | Reason |\n');
              process.stdout.write('|-------------|--------|\n');
              
              createResult.failed.forEach(item => {
                process.stdout.write(`| ${item.folder.name} | ${item.reason} |\n`);
              });
            }
            
            // Show asset creation results if available
            if (createResult.assets) {
              process.stdout.write('\nASSET CREATION RESULTS:\n');
              
              if (Array.isArray(createResult.assets)) {
                createResult.assets.forEach(assetItem => {
                  process.stdout.write(`Presentation ${assetItem.presentationId.substring(0, 8)}...: ${assetItem.result.message}\n`);
                });
              } else {
                process.stdout.write(`Asset creation failed: ${createResult.assets.error || 'Unknown error'}\n`);
              }
            }
          } else {
            process.stdout.write(`\nError creating presentations: ${createResult.message}\n`);
          }
        }
      }
      
      // Step 2: Find videos needing processing
      process.stdout.write('Finding videos needing processing...\n');
      const videosNeedingProcessing = await presentationService.findVideosNeedingProcessing({
        includeProcessed: options.includeProcessed,
        limit: options.limit,
        searchName: options.searchName,
        forceUnprocessed: options.forceUnprocessed
      });
      process.stdout.write(`Found ${videosNeedingProcessing.length} videos needing processing\n\n`);
      
      // Combine results for output
      const results = {
        missing_presentations: missingPresentations,
        videos_needing_processing: videosNeedingProcessing
      };
      
      // Output results based on format option
      if (options.format === 'json') {
        process.stdout.write(JSON.stringify(results, null, 2) + '\n');
      } else {
        // Table format (default)
        process.stdout.write('\n========== FOLDERS MISSING PRESENTATIONS ==========\n');
        process.stdout.write(`Total: ${missingPresentations.length}\n`);
        
        if (missingPresentations.length > 0) {
          process.stdout.write('\n| Folder ID | Folder Name | Drive ID | Main Video ID |\n');
          process.stdout.write('|-----------|------------|----------|---------------|\n');
          
          missingPresentations.forEach(folder => {
            process.stdout.write(`| ${folder.id.substring(0, 8)}... | ${folder.name} | ${folder.drive_id} | ${folder.main_video_id} |\n`);
          });
        }
        
        process.stdout.write('\n========== VIDEOS NEEDING PROCESSING ==========\n');
        process.stdout.write(`Total: ${videosNeedingProcessing.length}\n`);
        
        if (videosNeedingProcessing.length > 0) {
          process.stdout.write('\n| Video ID | Video Name | Folder Name | Needs Processing | Mime Type |\n');
          process.stdout.write('|----------|------------|-------------|------------------|------------|\n');
          
          videosNeedingProcessing.forEach(video => {
            process.stdout.write(`| ${video.id.substring(0, 8)}... | ${video.name} | ${video.folder_name} | ${video.needs_processing ? 'Yes' : 'No'} | ${video.mime_type || 'Unknown'} |\n`);
          });
        }
      }
      
      // Save to file if requested
      if (options.outputFile) {
        const fs = require('fs');
        fs.writeFileSync(options.outputFile, JSON.stringify(results, null, 2));
        process.stdout.write(`Results saved to ${options.outputFile}\n`);
      }
      
      process.stdout.write('Command completed successfully.\n');
    } catch (error) {
      Logger.error('Error executing find-missing-presentations command:', error);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;