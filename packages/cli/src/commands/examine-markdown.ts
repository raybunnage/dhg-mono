import { Command } from 'commander';
import path from 'path';
import { Logger, LogLevel } from '../utils/logger';
import { ErrorHandler, AppError } from '../utils/error-handler';
import config from '../utils/config';
import { FileService, SupabaseService } from '../services';

interface ExamineMarkdownOptions {
  verbose: boolean;
}

/**
 * Examine a markdown document and retrieve associated prompt and relationships
 */
export const examineMarkdown = async (filePath: string, options: ExamineMarkdownOptions) => {
  // Configure logger based on options
  Logger.setLevel(options.verbose ? LogLevel.DEBUG : LogLevel.INFO);
  
  try {
    Logger.info(`Starting examination of ${filePath}`);
    
    // 1. Initialize services
    const fileService = new FileService();
    const supabaseService = new SupabaseService(config.supabaseUrl, config.supabaseKey);
    
    // 2. Read target file
    Logger.info('Reading target file');
    const fileResult = fileService.readFile(filePath);
    if (!fileResult.success) {
      throw new AppError(`Failed to read file: ${fileResult.error}`, 'FILE_ERROR');
    }
    
    Logger.info('File read successfully', {
      path: fileResult.path,
      size: fileResult.stats?.size,
      preview: fileResult.content?.substring(0, 200) + '...'
    });
    
    // 3. Get classification prompt
    Logger.info('Retrieving classification prompt');
    const prompt = await supabaseService.getPromptByName('markdown-document-classification-prompt');
    if (!prompt) {
      throw new AppError('Classification prompt not found', 'PROMPT_ERROR');
    }
    
    console.log('\nPrompt Information:');
    console.log('-------------------');
    console.log(`ID: ${prompt.id}`);
    console.log(`Name: ${prompt.name}`);
    console.log(`Content (preview): ${prompt.content.substring(0, 100)}...`);
    
    // 4. Get related assets for this prompt
    Logger.info(`Finding related assets for prompt ID: ${prompt.id}`);
    const relationships = await supabaseService.getRelationshipsByPromptId(prompt.id);
    
    console.log('\nRelated Assets:');
    console.log('--------------');
    console.log(`Found ${relationships.length} related assets`);
    
    // 5. Process and display each related asset
    for (const rel of relationships) {
      console.log(`\nAsset Path: ${rel.asset_path}`);
      console.log(`Relationship Type: ${rel.relationship_type}`);
      console.log(`Context: ${rel.relationship_context || 'N/A'}`);
      
      const assetPath = path.resolve(process.cwd(), rel.asset_path);
      const assetContent = fileService.readFile(assetPath);
      
      if (assetContent.success) {
        console.log(`Content (preview): ${assetContent.content?.substring(0, 100)}...`);
      } else {
        console.log(`Error reading file: ${assetContent.error}`);
      }
    }
    
    Logger.info('Examination complete');
    
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
export const registerExamineMarkdownCommand = (program: Command): void => {
  program
    .command('examine <file-path>')
    .description('Examine a markdown document and retrieve associated prompt and relationships')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(examineMarkdown);
};