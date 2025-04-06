/**
 * Process Summary command for the Media Processing CLI Pipeline
 * Processes a summary file and stores the AI-generated summary in expert_documents
 */

import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../../../packages/shared/utils';
import { ClaudeService } from '../../../../packages/shared/services/claude-service';
import { fileService } from '../../../../packages/shared/services/file-service/file-service';
import { SupabaseService } from '../../../../packages/shared/services/supabase-service/supabase-service';

// Define interfaces
interface ProcessSummaryOptions {
  file: string;
  writeToDb?: boolean;
  outputFile?: string;
  summaryType?: 'short' | 'medium' | 'detailed';
  dryRun?: boolean;
}

interface SummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
  metadata: {
    originalFile: string;
    summaryType: string;
    wordCount?: number;
    processingTime?: number;
  };
}

/**
 * Process a summary file
 */
async function processSummary(options: ProcessSummaryOptions): Promise<SummaryResult> {
  const startTime = Date.now();
  const { file, summaryType = 'medium', dryRun = false } = options;

  Logger.info(`🔍 Processing summary file: ${file} (${summaryType})`);

  // Verify file exists
  if (!fs.existsSync(file)) {
    return {
      success: false,
      error: `File not found: ${file}`,
      metadata: {
        originalFile: file,
        summaryType,
      },
    };
  }

  // Skip actual processing in dry run mode
  if (dryRun) {
    Logger.info(`🔄 [DRY RUN] Would process ${file} using ${summaryType} summary type`);
    return {
      success: true,
      summary: `[DRY RUN] This is a placeholder for the ${summaryType} summary that would be generated.`,
      metadata: {
        originalFile: file,
        summaryType,
      },
    };
  }

  try {
    // Read the file
    const fileResult = fileService.readFile(file);
    if (!fileResult.success) {
      throw new Error(`Error reading file: ${fileResult.error}`);
    }

    const originalContent = fileResult.content!;
    const wordCount = originalContent.split(/\s+/).length;

    Logger.info(`📄 Original content has ${wordCount} words`);

    // Generate summary using Claude
    const claudeService = new ClaudeService();
    const prompt = generateSummaryPrompt(originalContent, summaryType);
    const summary = await claudeService.sendPrompt(prompt);

    const elapsedTime = (Date.now() - startTime) / 1000;
    Logger.info(`✅ Summary generated in ${elapsedTime.toFixed(2)}s`);

    return {
      success: true,
      summary,
      metadata: {
        originalFile: file,
        summaryType,
        wordCount,
        processingTime: elapsedTime,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error processing summary: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
      metadata: {
        originalFile: file,
        summaryType,
      },
    };
  }
}

/**
 * Generate a prompt for Claude to summarize content
 */
function generateSummaryPrompt(content: string, summaryType: string): string {
  let instructions = '';
  
  switch (summaryType) {
    case 'short':
      instructions = 'Create a concise 1-paragraph summary (max 3-5 sentences) of the main points from this content.';
      break;
    case 'medium':
      instructions = 'Create a comprehensive summary (3-5 paragraphs) of the key points, arguments, and insights from this content. Maintain the most important details while condensing the overall material by about 80%.';
      break;
    case 'detailed':
      instructions = 'Create a detailed summary that preserves the main points, arguments, examples, and insights from this content. Include section headings where appropriate. Condense the material by about 50-60% while keeping all essential information.';
      break;
    default:
      instructions = 'Create a comprehensive summary of the key points from this content.';
  }

  return `
${instructions}

When creating this summary:
- Focus on the most important and insightful information
- Use clear, straightforward language
- Maintain a professional tone
- Preserve any key terminology from the source content
- Do not include your own opinions or analysis
- Do not include phrases like "In this transcript" or "The speaker discusses" - just present the information directly

Here is the content to summarize:

${content}
`;
}

/**
 * Save the summary to the database
 */
async function saveSummaryToDatabase(
  originalFile: string, 
  summary: string, 
  metadata: Record<string, any>
): Promise<boolean> {
  try {
    Logger.info('💾 Saving summary to database...');
    
    const supabaseService = new SupabaseService();
    const fileName = path.basename(originalFile);
    
    // Insert into expert_documents table
    const result = await supabaseService.insertDocument({
      name: `Summary: ${fileName}`,
      content: summary,
      document_type: 'expert_summary',
      tags: ['auto-generated', `summary-type-${metadata.summaryType}`],
      metadata: {
        originalFile,
        wordCount: metadata.wordCount,
        processingTime: metadata.processingTime,
        summaryType: metadata.summaryType,
        generatedAt: new Date().toISOString(),
      }
    });
    
    if (result.success) {
      Logger.info(`✅ Summary saved to database with ID: ${result.id}`);
      return true;
    } else {
      Logger.error(`❌ Error saving to database: ${result.error}`);
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error saving to database: ${errorMessage}`);
    return false;
  }
}

/**
 * Save the summary to a file
 */
function saveSummaryToFile(
  summary: string, 
  outputFile: string
): boolean {
  try {
    Logger.info(`💾 Saving summary to file: ${outputFile}`);
    
    const result = fileService.writeFile(outputFile, summary);
    
    if (result.success) {
      Logger.info(`✅ Summary saved to file with ${result.stats?.size} bytes`);
      return true;
    } else {
      Logger.error(`❌ Error saving to file: ${result.error}`);
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error saving to file: ${errorMessage}`);
    return false;
  }
}

/**
 * Main command implementation
 */
export default async function command(options: ProcessSummaryOptions): Promise<void> {
  Logger.info('🚀 Starting process-summary command');
  Logger.debug('Options:', options);
  
  try {
    const processingResult = await processSummary(options);
    
    if (!processingResult.success) {
      Logger.error(`❌ Processing failed: ${processingResult.error}`);
      return;
    }
    
    const summary = processingResult.summary!;
    
    // Save to database if requested
    if (options.writeToDb && !options.dryRun) {
      await saveSummaryToDatabase(options.file, summary, processingResult.metadata);
    }
    
    // Save to file if output file is specified
    if (options.outputFile && !options.dryRun) {
      saveSummaryToFile(summary, options.outputFile);
    }
    
    // If neither database nor file output is specified, print to console
    if (!options.writeToDb && !options.outputFile) {
      Logger.info('📄 Generated Summary:');
      console.log('\n' + summary + '\n');
    }
    
    Logger.info('✅ Summary processing completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Command execution failed: ${errorMessage}`);
  }
}