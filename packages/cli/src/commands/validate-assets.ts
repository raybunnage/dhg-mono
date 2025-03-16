import { Command } from 'commander';
import path from 'path';
import { Logger, LogLevel } from '../utils/logger';
import { ErrorHandler, AppError } from '../utils/error-handler';
import config from '../utils/config';
import { FileService, SupabaseService } from '../services';

interface ValidateAssetsOptions {
  prompt?: string;
  verbose: boolean;
}

/**
 * Validate that all assets referenced in prompt relationships exist
 */
export const validateAssets = async (options: ValidateAssetsOptions) => {
  // Configure logger based on options
  Logger.setLevel(options.verbose ? LogLevel.DEBUG : LogLevel.INFO);
  
  try {
    Logger.info('Starting asset validation');
    
    // Initialize services
    const fileService = new FileService();
    const supabaseService = new SupabaseService(config.supabaseUrl, config.supabaseKey);
    
    // Get prompt if specified
    let promptId: string | undefined;
    
    if (options.prompt) {
      Logger.info(`Getting prompt: ${options.prompt}`);
      const prompt = await supabaseService.getPromptByName(options.prompt);
      
      if (!prompt) {
        throw new AppError(`Prompt not found: ${options.prompt}`, 'PROMPT_ERROR');
      }
      
      promptId = prompt.id;
      Logger.info(`Using prompt: ${prompt.name} (ID: ${prompt.id})`);
    }
    
    // Get relationships
    let relationships;
    if (promptId) {
      Logger.info(`Getting relationships for prompt: ${promptId}`);
      relationships = await supabaseService.getRelationshipsByPromptId(promptId);
    } else {
      // If no prompt is specified, we could get all relationships
      // This would require implementing a new method in SupabaseService
      throw new AppError('Validation without a prompt is not supported yet', 'VALIDATION_ERROR');
    }
    
    Logger.info(`Found ${relationships.length} relationships to validate`);
    
    // Validate that assets exist
    let valid = 0;
    let invalid = 0;
    const invalidAssets = [];
    
    for (const relationship of relationships) {
      const assetPath = path.resolve(process.cwd(), relationship.asset_path);
      const assetExists = fileService.readFile(assetPath).success;
      
      if (assetExists) {
        valid++;
        Logger.debug(`✓ Asset exists: ${relationship.asset_path}`);
      } else {
        invalid++;
        Logger.warn(`✗ Asset missing: ${relationship.asset_path}`);
        invalidAssets.push(relationship.asset_path);
      }
    }
    
    // Report results
    Logger.info('Validation complete', {
      total: relationships.length,
      valid,
      invalid
    });
    
    if (invalid > 0) {
      Logger.warn(`${invalid} assets are missing:`, invalidAssets);
    } else {
      Logger.info('All assets are valid');
    }
    
  } catch (error) {
    if (error instanceof AppError) {
      ErrorHandler.handle(error, true);
    } else if (error instanceof Error) {
      ErrorHandler.handle(new AppError(
        error.message,
        'UNKNOWN_ERROR'
      ), true);
    } else {
      ErrorHandler.handle(new AppError(
        'An unknown error occurred',
        'UNKNOWN_ERROR'
      ), true);
    }
  }
};

/**
 * Register the command with Commander
 */
export const registerValidateAssetsCommand = (program: Command): void => {
  program
    .command('validate')
    .description('Validate that all assets referenced in prompt relationships exist')
    .option('-p, --prompt <name>', 'Name of the prompt to validate assets for')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(validateAssets);
};