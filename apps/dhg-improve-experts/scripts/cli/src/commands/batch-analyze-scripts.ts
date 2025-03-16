import { Command } from 'commander';
import path from 'path';
import * as fs from 'fs';
import logger from '../utils/logger';
import { errorHandler } from '../utils/error-handler';
import * as claudeService from '../services/claude-service';
import * as supabaseService from '../services/supabase-service';
import * as reportService from '../services/report-service';
import config from '../utils/config';
import { readPromptFromFile } from '../models/prompt';
import { RateLimiter } from '../utils/rate-limiter';

interface BatchAnalysisOptions {
  input: string;
  outputDir: string;
  prompt: string;
  batchSize: number;
  concurrency: number;
  checkReferences: boolean;
  updateDatabase: boolean;
  generateReport: boolean;
  verbose: boolean;
}

/**
 * Command to batch analyze script files
 */
export const batchAnalyzeScriptsCommand = new Command('batch-analyze-scripts')
  .description('Analyze multiple script files in batch')
  .requiredOption('-i, --input <file>', 'Input JSON file with script files to analyze (from scan-scripts)')
  .option('-o, --output-dir <directory>', 'Output directory for analysis results', './script-analysis-results')
  .option('-p, --prompt <file>', 'Custom prompt file path', path.join(process.cwd(), 'public', 'prompts', 'script-analysis-prompt.md'))
  .option('-b, --batch-size <number>', 'Number of scripts to analyze in each batch', '10')
  .option('-c, --concurrency <number>', 'Number of concurrent analysis requests', '2')
  .option('-r, --check-references', 'Check for references in package.json files', false)
  .option('-u, --update-database', 'Update the Supabase database with analysis results', false)
  .option('-g, --generate-report', 'Generate a summary report', true)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options: BatchAnalysisOptions) => {
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      logger.info('Starting batch script analysis...');
      logger.debug('Options:', options);

      // Parse options
      const inputPath = path.resolve(options.input);
      const outputDir = path.resolve(options.outputDir);
      const promptPath = path.resolve(options.prompt);
      const batchSize = parseInt(options.batchSize.toString(), 10);
      const concurrency = parseInt(options.concurrency.toString(), 10);

      // Validate input
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      if (!fs.existsSync(promptPath)) {
        throw new Error(`Prompt file not found: ${promptPath}`);
      }

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Read input file
      const scriptFiles = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
      
      if (!Array.isArray(scriptFiles)) {
        throw new Error('Input file must contain an array of script files');
      }

      logger.info(`Found ${scriptFiles.length} script files to analyze`);

      // Read prompt template
      logger.info(`Reading prompt template from: ${promptPath}`);
      const promptTemplate = await readPromptFromFile(promptPath);

      // Initialize results array
      const analysisResults: any[] = [];

      // Initialize rate limiter for Claude API
      const rateLimiter = new RateLimiter({
        maxRequests: concurrency,
        intervalMs: 1000,
      });

      // Process scripts in batches
      const batches = chunk(scriptFiles, batchSize);
      logger.info(`Processing ${batches.length} batches with batch size ${batchSize}`);

      let currentBatch = 1;
      let successCount = 0;
      let failureCount = 0;

      for (const batch of batches) {
        logger.info(`Processing batch ${currentBatch}/${batches.length}`);
        
        // Process each script in the batch with concurrency limit
        const batchPromises = batch.map((scriptFile: any) => 
          rateLimiter.schedule(() => 
            processScript(
              scriptFile.file_path, 
              promptTemplate, 
              outputDir, 
              options.checkReferences,
              options.updateDatabase
            )
          )
        );

        // Wait for all scripts in the batch to finish processing
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Count successes and failures
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            if (result.value) {
              analysisResults.push(result.value);
              successCount++;
            }
          } else {
            logger.error(`Failed to process script: ${result.reason}`);
            failureCount++;
          }
        });

        logger.info(`Completed batch ${currentBatch}/${batches.length}`);
        currentBatch++;
      }

      logger.info(`Batch processing completed. Success: ${successCount}, Failure: ${failureCount}`);

      // Generate report if requested
      if (options.generateReport) {
        logger.info('Generating summary report...');
        const reportPath = path.join(outputDir, 'script-analysis-report.md');
        const jsonReportPath = path.join(outputDir, 'script-analysis-report.json');
        
        // Save JSON report
        fs.writeFileSync(jsonReportPath, JSON.stringify(analysisResults, null, 2));
        
        // Generate and save markdown report
        const report = generateReport(analysisResults);
        fs.writeFileSync(reportPath, report);
        
        logger.info(`Report generated at ${reportPath}`);
        
        // Generate category summary
        const categorySummary = generateCategorySummary(analysisResults);
        const categorySummaryPath = path.join(outputDir, 'category-summary.md');
        fs.writeFileSync(categorySummaryPath, categorySummary);
        
        logger.info(`Category summary generated at ${categorySummaryPath}`);
      }

    } catch (error) {
      errorHandler(error as Error);
      process.exit(1);
    }
  });

/**
 * Process a single script file
 */
async function processScript(
  scriptPath: string, 
  promptTemplate: string, 
  outputDir: string,
  checkReferences: boolean,
  updateDatabase: boolean
): Promise<any> {
  try {
    logger.debug(`Processing script: ${scriptPath}`);
    
    // Check if file exists
    if (!fs.existsSync(scriptPath)) {
      logger.error(`Script file not found: ${scriptPath}`);
      return null;
    }

    // Read script file content
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    const fileStats = fs.statSync(scriptPath);
    const language = getLanguageFromExtension(path.extname(scriptPath));

    // Prepare context for analysis
    const analysisContext: Record<string, any> = {
      file_path: scriptPath,
      language,
      file_size: fileStats.size,
      last_modified: fileStats.mtime.toISOString(),
    };

    // Check for references if requested
    if (checkReferences) {
      analysisContext.references = await checkScriptReferences(scriptPath);
    }

    // Generate the complete prompt with script content and context
    const completePrompt = generateAnalysisPrompt(promptTemplate, scriptContent, analysisContext);

    // Send to Claude for analysis
    const analysisResult = await claudeService.sendPrompt({
      prompt: completePrompt,
      model: config.defaultModel,
      temperature: 0.2,
      maxTokens: 4000,
    });

    // Parse the analysis result
    const parsedAnalysis = parseAnalysisResult(analysisResult);

    // Save analysis to output file
    const outputFileName = path.basename(scriptPath) + '.analysis.json';
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, JSON.stringify(parsedAnalysis, null, 2));

    // Update database if requested
    if (updateDatabase) {
      await updateDatabase(parsedAnalysis);
    }

    logger.debug(`Successfully processed script: ${scriptPath}`);
    return parsedAnalysis;
  } catch (error) {
    logger.error(`Error processing script ${scriptPath}:`, error);
    return null;
  }
}

/**
 * Get language from file extension
 */
function getLanguageFromExtension(extension: string): string {
  const extensionMap: Record<string, string> = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.sh': 'shell',
    '.bash': 'shell',
    '.php': 'php',
    '.rb': 'ruby',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.sql': 'sql',
  };

  return extensionMap[extension.toLowerCase()] || 'unknown';
}

/**
 * Check for references to the script in package.json files
 */
async function checkScriptReferences(scriptPath: string): Promise<boolean> {
  try {
    // Get the relative path of the script from the project root
    const relativeScriptPath = path.relative(process.cwd(), scriptPath);
    
    // Find all package.json files in the project
    const packageJsonFiles = await fs.promises.readdir(process.cwd(), { recursive: true })
      .then(files => files.filter(file => file.endsWith('package.json')));

    // Check if the script is referenced in any package.json
    for (const packageJsonPath of packageJsonFiles) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        // Check in scripts section
        const scripts = packageJson.scripts || {};
        for (const scriptValue of Object.values(scripts) as string[]) {
          if (scriptValue.includes(relativeScriptPath)) {
            logger.debug(`Script referenced in ${packageJsonPath}`);
            return true;
          }
        }
      } catch (error) {
        logger.debug(`Error reading package.json at ${packageJsonPath}:`, error);
      }
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking script references:', error);
    return false;
  }
}

/**
 * Generate the complete analysis prompt
 */
function generateAnalysisPrompt(
  promptTemplate: string, 
  scriptContent: string, 
  context: Record<string, any>
): string {
  // Create a prompt with the template, script content, and context
  return `${promptTemplate}

## Script Content
\`\`\`
${scriptContent}
\`\`\`

## Script Context
- File Path: ${context.file_path}
- Language: ${context.language}
- File Size: ${context.file_size} bytes
- Last Modified: ${context.last_modified}
${context.references !== undefined ? `- Referenced in package.json: ${context.references}` : ''}
`;
}

/**
 * Parse the analysis result from Claude
 */
function parseAnalysisResult(analysisResult: string): any {
  try {
    // Extract JSON from the response
    const jsonMatch = analysisResult.match(/```json\n([\s\S]*?)\n```/) || 
                      analysisResult.match(/{[\s\S]*}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON found in the analysis result');
    }

    const jsonString = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(jsonString);
  } catch (error) {
    logger.error('Error parsing analysis result:', error);
    throw new Error(`Failed to parse analysis result: ${(error as Error).message}`);
  }
}

/**
 * Update the database with analysis results
 */
async function updateDatabase(analysis: any): Promise<void> {
  try {
    // Get metadata from analysis
    const { metadata, assessment } = analysis;
    
    // Prepare data for database
    const scriptData = {
      file_path: metadata.file_path,
      title: metadata.title,
      language: metadata.language,
      document_type: metadata.document_type,
      summary: assessment.summary,
      tags: assessment.tags,
      code_quality: assessment.quality.code_quality,
      maintainability: assessment.quality.maintainability,
      utility: assessment.quality.utility,
      documentation: assessment.quality.documentation,
      relevance_score: assessment.relevance.score,
      relevance_reasoning: assessment.relevance.reasoning,
      referenced: assessment.referenced,
      status: assessment.status.recommendation,
      status_confidence: assessment.status.confidence,
      status_reasoning: assessment.status.reasoning,
      last_analyzed: new Date().toISOString(),
    };

    // Update database through supabase service
    await supabaseService.upsertScript(scriptData);
    
    // If there are potential duplicates, add relationships
    if (assessment.potential_duplicates && assessment.potential_duplicates.length > 0) {
      for (const duplicatePath of assessment.potential_duplicates) {
        await supabaseService.addScriptRelationship({
          source_path: metadata.file_path,
          target_path: duplicatePath,
          relationship_type: 'duplicate',
          confidence: 7, // Default confidence level
          notes: 'Automatically detected by script analysis',
        });
      }
    }
    
    logger.debug(`Database updated for script: ${metadata.file_path}`);
  } catch (error) {
    logger.error('Error updating database:', error);
    throw error;
  }
}

/**
 * Generate a report from analysis results
 */
function generateReport(results: any[]): string {
  // Generate timestamp
  const timestamp = new Date().toISOString();
  
  // Start with report header
  let report = `# Script Analysis Report\n\n`;
  report += `Generated: ${timestamp}\n\n`;
  report += `Total scripts analyzed: ${results.length}\n\n`;

  // Add status summary
  const statusCounts: Record<string, number> = {};
  results.forEach(result => {
    const status = result.assessment.status.recommendation;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  report += `## Status Summary\n\n`;
  for (const [status, count] of Object.entries(statusCounts)) {
    report += `- ${status}: ${count} scripts (${Math.round(count / results.length * 100)}%)\n`;
  }
  report += `\n`;

  // Add document type summary
  const typeCounts: Record<string, number> = {};
  results.forEach(result => {
    const type = result.metadata.document_type;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  report += `## Document Type Summary\n\n`;
  for (const [type, count] of Object.entries(typeCounts)) {
    report += `- ${type}: ${count} scripts (${Math.round(count / results.length * 100)}%)\n`;
  }
  report += `\n`;

  // Add script details
  report += `## Script Details\n\n`;
  results.forEach(result => {
    const { metadata, assessment } = result;
    report += `### ${metadata.title}\n\n`;
    report += `- **Path**: ${metadata.file_path}\n`;
    report += `- **Type**: ${metadata.document_type}\n`;
    report += `- **Language**: ${metadata.language}\n`;
    report += `- **Status**: ${assessment.status.recommendation} (Confidence: ${assessment.status.confidence}/10)\n`;
    report += `- **Quality Score**: ${(
      assessment.quality.code_quality + 
      assessment.quality.maintainability + 
      assessment.quality.utility + 
      assessment.quality.documentation
    ) / 4}/10\n`;
    report += `- **Relevance**: ${assessment.relevance.score}/10\n`;
    report += `- **Referenced**: ${assessment.referenced ? 'Yes' : 'No'}\n`;
    report += `- **Tags**: ${assessment.tags.join(', ')}\n\n`;
    report += `**Summary**: ${assessment.summary}\n\n`;
    report += `**Status Reasoning**: ${assessment.status.reasoning}\n\n`;
    report += `---\n\n`;
  });

  return report;
}

/**
 * Generate a category summary from analysis results
 */
function generateCategorySummary(results: any[]): string {
  // Group scripts by document type
  const scriptsByType: Record<string, any[]> = {};
  results.forEach(result => {
    const type = result.metadata.document_type;
    if (!scriptsByType[type]) {
      scriptsByType[type] = [];
    }
    scriptsByType[type].push(result);
  });
  
  // Generate summary
  let summary = `# Document Type Category Summary\n\n`;
  summary += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Process each category
  for (const [category, scripts] of Object.entries(scriptsByType)) {
    summary += `## ${category}\n\n`;
    summary += `Total scripts: ${scripts.length}\n\n`;
    
    // Status breakdown
    const statusCounts: Record<string, number> = {};
    scripts.forEach(script => {
      const status = script.assessment.status.recommendation;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    summary += `### Status Breakdown\n\n`;
    for (const [status, count] of Object.entries(statusCounts)) {
      summary += `- ${status}: ${count} scripts (${Math.round(count / scripts.length * 100)}%)\n`;
    }
    summary += `\n`;
    
    // List scripts in this category
    summary += `### Scripts\n\n`;
    summary += `| Title | Path | Status | Quality |\n`;
    summary += `| ----- | ---- | ------ | ------- |\n`;
    scripts.forEach(script => {
      const { metadata, assessment } = script;
      const qualityScore = (
        assessment.quality.code_quality + 
        assessment.quality.maintainability + 
        assessment.quality.utility + 
        assessment.quality.documentation
      ) / 4;
      summary += `| ${metadata.title} | ${metadata.file_path} | ${assessment.status.recommendation} | ${qualityScore}/10 |\n`;
    });
    summary += `\n`;
  }
  
  return summary;
}

/**
 * Split array into chunks of the specified size
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}