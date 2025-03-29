import { Command } from 'commander';
import path from 'path';
import { Logger, LogLevel } from '../utils/logger';
import { LoggerUtils } from '../utils/logger-utils';
import { ErrorHandler, AppError } from '../utils/error-handler';
import config from '../utils/config';
import configHelpers from '../utils/config-helpers';
import { 
  SupabaseService, 
  ClaudeService, 
  ReportService 
} from '../services';
import { fileService } from '../services/file-service-helpers';

interface ClassifyMarkdownOptions {
  output?: string;
  verbose: boolean;
}

/**
 * Prepare context for the AI call
 */
const prepareContext = (documentTypes: any[], relatedAssets: any[]): string => {
  // Convert document types to JSON
  const documentTypesJson = JSON.stringify(documentTypes, null, 2);

  // Prepare related assets context
  let relatedAssetsContext = '';
  for (const asset of relatedAssets) {
    if (asset.success) {
      relatedAssetsContext += `\n--- Related Asset: ${asset.relationship.asset_path} ---\n`;
      if (asset.relationship.relationship_context) {
        relatedAssetsContext += `Context: ${asset.relationship.relationship_context}\n\n`;
      }
      relatedAssetsContext += `${asset.content}\n\n`;
    }
  }

  return `Document Types with category "Documentation" in JSON format:
${documentTypesJson}

Related assets and their context:
${relatedAssetsContext}`;
};

/**
 * Main function to classify markdown
 */
export const classifyMarkdown = async (filePath: string, options: ClassifyMarkdownOptions) => {
  // Configure logger based on options
  if (options.verbose) {
    Logger.setLevel(LogLevel.DEBUG);
  }
  
  try {
    LoggerUtils.info(`Starting classification of ${filePath}`);
    
    // 1. Initialize services
    const supabaseService = new SupabaseService(config.supabaseUrl, config.supabaseKey);
    const claudeService = new ClaudeService(configHelpers.anthropicApiKey);
    const reportService = new ReportService();
    
    // 2. Read target file
    LoggerUtils.info('Reading target file');
    const fileResult = fileService.readFile(filePath);
    if (!fileResult.success) {
      throw new AppError(`Failed to read file: ${fileResult.error}`, 'FILE_ERROR');
    }
    
    LoggerUtils.info('File read successfully', {
      path: fileResult.path,
      size: fileResult.stats?.size
    });
    
    // 3. Get classification prompt
    LoggerUtils.info('Retrieving classification prompt');
    const prompt = await supabaseService.getPromptByName('markdown-document-classification-prompt');
    if (!prompt) {
      throw new AppError('Classification prompt not found', 'PROMPT_ERROR');
    }
    
    LoggerUtils.info('Classification prompt found', {
      id: prompt.id,
      name: prompt.name
    });
    
    // 4. Get related assets
    LoggerUtils.info(`Finding related assets for prompt: ${prompt.id}`);
    const relationships = await supabaseService.getRelationshipsByPromptId(prompt.id);
    
    // 5. Process related assets
    const relatedAssets = await Promise.all(
      relationships.map(async (rel) => {
        const assetPath = path.resolve(process.cwd(), rel.asset_path);
        const assetContent = fileService.readFile(assetPath);
        
        let documentType = null;
        if (rel.document_type_id) {
          documentType = await supabaseService.getDocumentTypeById(rel.document_type_id);
        }
        
        return {
          relationship: rel,
          content: assetContent.success ? assetContent.content : null,
          documentType,
          success: assetContent.success,
          error: assetContent.error
        };
      })
    );
    
    LoggerUtils.info(`Processed ${relatedAssets.length} related assets`);
    
    // 6. Get document types
    LoggerUtils.info('Retrieving document types');
    const documentTypes = await supabaseService.getDocumentTypesByCategory('Documentation');
    
    LoggerUtils.info(`Found ${documentTypes.length} document types`);
    
    // 7. Prepare context for AI
    const context = prepareContext(documentTypes, relatedAssets);
    
    // 8. Call Claude API
    LoggerUtils.info('Calling Claude API for classification');
    const claudeResponse = await claudeService.classifyDocument(
      fileResult.content!,
      prompt.content,
      context
    );
    
    if (!claudeResponse.success) {
      throw new AppError(
        `Claude API call failed: ${claudeResponse.error}`,
        'API_ERROR'
      );
    }
    
    LoggerUtils.info('Claude API call successful');
    
    // 9. Generate report
    LoggerUtils.info('Generating classification report');
    const outputPath = options.output || path.join(configHelpers.defaultOutputDir, 'markdown-classification-report.md');
    
    // 9.1 Add report sections
    reportService.addSection({
      title: 'Markdown Classification Report',
      content: `Generated: ${new Date().toLocaleString()}`,
      level: 1
    });
    
    // 9.2 Add target file section
    reportService.addSection({
      title: 'Target File',
      content: `**Path:** ${fileResult.path}
**Size:** ${fileResult.stats?.size} bytes
**Modified:** ${fileResult.stats?.modified?.toLocaleString()}
**Preview:**
\`\`\`markdown
${fileResult.content?.substring(0, 500)}...
\`\`\``,
      level: 2
    });
    
    // 9.3 Add classification prompt section
    reportService.addSection({
      title: 'Classification Prompt',
      content: `**Name:** ${prompt.name}
**ID:** ${prompt.id}
**Content:**
\`\`\`
${prompt.content}
\`\`\``,
      level: 2
    });
    
    // 9.4 Add related assets section
    reportService.addSection({
      title: 'Related Assets',
      content: `Found ${relatedAssets.length} related assets`,
      level: 2
    });
    
    // 9.5 Add document types section
    reportService.addSection({
      title: 'Document Types',
      content: `Found ${documentTypes.length} document types with category "Documentation"
\`\`\`json
${JSON.stringify(documentTypes, null, 2)}
\`\`\``,
      level: 2
    });
    
    // 9.6 Add classification result section
    const responseText = claudeResponse.result?.content?.[0]?.text || 'No text content in response';
    
    reportService.addSection({
      title: 'Classification Result',
      content: responseText,
      level: 2
    });
    
    // 10. Write report
    const reportResult = reportService.writeReportToFile(outputPath);
    
    if (reportResult.success) {
      LoggerUtils.info(`Classification complete. Report saved to: ${outputPath}`);
    } else {
      LoggerUtils.error(`Failed to write report: ${reportResult.error}`);
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
export const registerClassifyMarkdownCommand = (program: Command): void => {
  program
    .command('classify <file-path>')
    .description('Classify a markdown document using Claude AI')
    .option('-o, --output <path>', 'Output path for the classification report')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(classifyMarkdown);
};