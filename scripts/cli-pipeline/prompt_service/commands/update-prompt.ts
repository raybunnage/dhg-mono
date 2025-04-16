import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../packages/shared/utils';
import { PromptManagementService, DatabasePrompt } from '../../../../packages/shared/services/prompt-service/prompt-management-service';
import { promptCliInterface } from '../../../../packages/shared/services/prompt-service/prompt-cli-interface';
import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';

interface UpdatePromptOptions {
  dryRun?: boolean;
}

/**
 * Update a prompt in the database from a file
 * @param promptName Name of the prompt to update
 * @param filePath Path to the updated prompt file
 * @param options Command options
 */
export async function updatePromptCommand(promptName: string, filePath: string, options: UpdatePromptOptions): Promise<void> {
  await trackCommandExecution('prompt_service', 'update', async () => {
    // Ensure the file exists
    if (!fs.existsSync(filePath)) {
      Logger.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    
    Logger.info(`Updating prompt "${promptName}" from file: ${filePath}`);
    
    // In dry-run mode, just show what would be updated
    if (options.dryRun) {
      Logger.info(`DRY RUN: Would update prompt "${promptName}" with content from file: ${filePath}`);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const promptService = PromptManagementService.getInstance();
      const { metadata, content } = promptService.parseMarkdownFrontmatter(fileContent);
      
      Logger.info('Content preview:');
      const previewLines = content.split('\n').slice(0, 10);
      previewLines.forEach(line => Logger.info(`  ${line}`));
      
      if (Object.keys(metadata).length > 0) {
        Logger.info('Metadata that would be updated:');
        Object.entries(metadata).forEach(([key, value]) => {
          Logger.info(`  ${key}: ${JSON.stringify(value)}`);
        });
      }
      
      return { 
        dryRun: true,
        promptName,
        filePath: path.basename(filePath)
      };
    }
    
    // Use the existing CLI interface to handle the update
    await promptCliInterface.updatePromptFromFile(promptName, filePath);
    
    return {
      promptName,
      filePath: path.basename(filePath)
    };
  }, {
    getResultSummary: (result) => ({
      recordsAffected: 1,
      affectedEntity: 'prompts',
      summary: result.dryRun 
        ? `Dry run for updating prompt "${result.promptName}" from file ${result.filePath}`
        : `Updated prompt "${result.promptName}" from file ${result.filePath}`
    })
  });
}