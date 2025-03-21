import { Command } from 'commander';
import { ScriptManagementService } from '../services/script-management-service';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

// Helper function to handle script classification
async function processScriptClassification(
  scriptService: ScriptManagementService, 
  script: any, 
  successCount: { value: number }, 
  failureCount: { value: number }
) {
  try {
    Logger.info(`Processing: ${script.file_path}`);
    
    // The ScriptManagementService now handles path conversions internally
    const result = await scriptService.classifyScript(script.file_path);
    
    if (!result) {
      Logger.warn(`Classification failed for: ${script.file_path}`);
      failureCount.value++;
      return;
    }
    
    const updated = await scriptService.updateScriptWithClassification(script.id, result);
    
    if (updated) {
      successCount.value++;
    } else {
      failureCount.value++;
    }
  } catch (scriptError) {
    Logger.error(`Error processing script ${script.file_path}:`, scriptError);
    failureCount.value++;
  }
}

export function registerScriptCommands(program: Command): void {
  const scriptService = new ScriptManagementService();
  
  // Command to sync scripts
  program
    .command('script-sync')
    .description('Synchronize database with script files on disk')
    .action(async () => {
      try {
        Logger.info("Starting script sync process...");
        const scripts = await scriptService.discoverScripts(process.cwd());
        
        if (scripts.length === 0) {
          Logger.info("No script files found.");
          return;
        }
        
        const result = await scriptService.syncWithDatabase(scripts);
        Logger.info("Script sync completed successfully.");
        Logger.info(`Summary: Added=${result.added}, Updated=${result.updated}, Deleted=${result.deleted}, Errors=${result.errors}`);
      } catch (error) {
        Logger.error("Error during script sync:", error);
        process.exit(1);
      }
    });
  
  // Command to find new scripts
  program
    .command('script-find-new')
    .description('Find and insert new script files')
    .action(async () => {
      try {
        Logger.info("Looking for new script files...");
        const scripts = await scriptService.discoverScripts(process.cwd());
        
        if (scripts.length === 0) {
          Logger.info("No script files found.");
          return;
        }
        
        const result = await scriptService.syncWithDatabase(scripts);
        Logger.info(`New script discovery completed. Added ${result.added} new scripts.`);
      } catch (error) {
        Logger.error("Error finding new scripts:", error);
        process.exit(1);
      }
    });
  
  // Command to show untyped scripts
  program
    .command('script-show-untyped')
    .description('Show scripts without a script type')
    .action(async () => {
      try {
        const scripts = await scriptService.getUntypedScripts(100);
        
        if (scripts.length === 0) {
          Logger.info("No untyped scripts found.");
          return;
        }
        
        Logger.info("Untyped Scripts:");
        scripts.forEach((script, index) => {
          console.log(`${index + 1}. ${script.file_path} (ID: ${script.id})`);
        });
        Logger.info(`Total: ${scripts.length} untyped scripts found.`);
      } catch (error) {
        Logger.error("Error showing untyped scripts:", error);
        process.exit(1);
      }
    });
  
  // Command to show recent scripts
  program
    .command('script-show-recent')
    .description('Show recent scripts')
    .action(async () => {
      try {
        const scripts = await scriptService.getRecentScripts(20);
        
        if (scripts.length === 0) {
          Logger.info("No scripts found.");
          return;
        }
        
        Logger.info("Recent Scripts:");
        scripts.forEach((script, index) => {
          console.log(`${index + 1}. ${script.file_path} (Updated: ${script.updated_at})`);
        });
      } catch (error) {
        Logger.error("Error showing recent scripts:", error);
        process.exit(1);
      }
    });
  
  // Command to classify recent scripts
  program
    .command('script-classify-recent')
    .description('Classify recent scripts')
    .action(async () => {
      try {
        const scripts = await scriptService.getRecentScripts(20);
        
        if (scripts.length === 0) {
          Logger.info("No scripts found for classification.");
          return;
        }
        
        Logger.info(`Processing ${scripts.length} recent scripts for classification...`);
        
        // Use reference objects so we can update them in the helper function
        const success = { value: 0 };
        const failure = { value: 0 };
        
        // Process each script
        for (const script of scripts) {
          await processScriptClassification(scriptService, script, success, failure);
        }
        
        Logger.info(`Classification of recent scripts completed: ${success.value} successful, ${failure.value} failed.`);
      } catch (error) {
        Logger.error("Error classifying recent scripts:", error);
        process.exit(1);
      }
    });
  
  // Command to classify untyped scripts
  program
    .command('script-classify-untyped')
    .description('Classify untyped scripts')
    .option('--count <number>', 'Number of scripts to process', '10')
    .action(async (options) => {
      try {
        const count = parseInt(options.count, 10);
        
        if (isNaN(count) || count <= 0) {
          Logger.error("Invalid count parameter. Please provide a positive integer.");
          process.exit(1);
        }
        
        const scripts = await scriptService.getUntypedScripts(count);
        
        if (scripts.length === 0) {
          Logger.info("No untyped scripts found for classification.");
          return;
        }
        
        Logger.info(`Processing ${scripts.length} untyped scripts for classification...`);
        
        // Use reference objects so we can update them in the helper function
        const success = { value: 0 };
        const failure = { value: 0 };
        
        // Process each script
        for (const script of scripts) {
          await processScriptClassification(scriptService, script, success, failure);
        }
        
        Logger.info(`Classification of untyped scripts completed: ${success.value} successful, ${failure.value} failed.`);
      } catch (error) {
        Logger.error("Error classifying untyped scripts:", error);
        process.exit(1);
      }
    });
  
  // Command to clean script results
  program
    .command('script-clean-results')
    .description('Clean script analysis results')
    .action(async () => {
      try {
        Logger.info("Cleaning script analysis results...");
        const success = await scriptService.cleanScriptResults();
        
        if (success) {
          Logger.info("Script results cleaning completed successfully.");
        } else {
          Logger.error("Script results cleaning failed.");
          process.exit(1);
        }
      } catch (error) {
        Logger.error("Error cleaning script results:", error);
        process.exit(1);
      }
    });
  
  // Command to generate summary
  program
    .command('script-generate-summary')
    .description('Generate a summary report of scripts')
    .option('--count <number>', 'Number of scripts', '50')
    .option('--include-deleted <boolean>', 'Include deleted scripts', 'false')
    .action(async (options) => {
      try {
        let count: number;
        if (options.count === 'all') {
          count = -1;
        } else {
          count = parseInt(options.count, 10);
          if (isNaN(count) || count < 1) {
            Logger.error("Invalid count parameter. Please provide a positive integer or 'all'.");
            process.exit(1);
          }
        }
        
        const includeDeleted = options.includeDeleted === 'true';
        
        const reportPath = await scriptService.generateSummary({
          limit: count,
          includeDeleted
        });
        
        if (reportPath) {
          Logger.info(`Summary report generated successfully: ${reportPath}`);
        } else {
          Logger.error("Failed to generate summary report.");
          process.exit(1);
        }
      } catch (error) {
        Logger.error("Error generating summary:", error);
        process.exit(1);
      }
    });
}