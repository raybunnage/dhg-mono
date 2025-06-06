import { Command } from 'commander';
import path from 'path';
import * as fs from 'fs';
import { Logger, LogLevel } from '../utils/logger';
import { LoggerUtils } from '../utils/logger-utils';
import { ErrorHandler } from '../utils/error-handler';
// Import helpers that provide compatibility with the shared package
import { sendPrompt } from '../services/claude-service-helpers';
import { getPromptByName, upsertScript, addScriptRelationship } from '../services/supabase-service-helpers';
import { ReportService } from '../services/report-service-helpers';
import config from '../utils/config';
import configHelpers from '../utils/config-helpers';
import { readPromptFromFile } from '../models/prompt';
import { RateLimiter } from '../utils/rate-limiter';

interface BatchAnalysisOptions {
  input: string;
  outputDir: string;
  prompt?: string;
  promptName?: string;
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
  .option('-p, --prompt <file>', 'Custom prompt file path')
  .option('-n, --prompt-name <name>', 'Name of the prompt to use from the database', 'script-analysis-prompt')
  .option('-b, --batch-size <number>', 'Number of scripts to analyze in each batch', '10')
  .option('-c, --concurrency <number>', 'Number of concurrent analysis requests', '2')
  .option('-r, --check-references', 'Check for references in package.json files', false)
  .option('-u, --update-database', 'Update the Supabase database with analysis results', false)
  .option('-g, --generate-report', 'Generate a summary report', true)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options: BatchAnalysisOptions) => {
    try {
      if (options.verbose) {
        // Set log level to debug via Logger class
        Logger.setLevel(LogLevel.DEBUG);
      }

      LoggerUtils.info('Starting batch script analysis...');
      LoggerUtils.debug('Options', options);

      // Parse options
      const inputPath = path.resolve(options.input);
      const outputDir = path.resolve(options.outputDir);
      const batchSize = parseInt(options.batchSize.toString(), 10);
      const concurrency = parseInt(options.concurrency.toString(), 10);

      // Validate input
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
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

      LoggerUtils.info(`Found ${scriptFiles.length} script files to analyze`);

      // Get prompt template
      let promptTemplate: string;
      
      if (options.prompt) {
        // Read from file if prompt path is provided
        const promptPath = path.resolve(options.prompt);
        if (!fs.existsSync(promptPath)) {
          throw new Error(`Prompt file not found: ${promptPath}`);
        }
        LoggerUtils.info(`Reading prompt template from file: ${promptPath}`);
        promptTemplate = await readPromptFromFile(promptPath);
      } else {
        // Get from database by name
        LoggerUtils.info(`Fetching prompt template from database: ${options.promptName}`);
        try {
          const prompt = await getPromptByName(options.promptName || 'script-analysis-prompt');
          if (prompt && prompt.content) {
            promptTemplate = prompt.content;
          } else {
            throw new Error('Invalid prompt data');
          }
        } catch (error) {
          // Use default prompt template as fallback
          LoggerUtils.warn(`Could not fetch prompt from database, using default: ${error}`);
          promptTemplate = `Analyze the script file and provide the following information:

1. Script Purpose: Identify the primary purpose and functionality of the script.
2. Dependencies: List external tools, libraries, and commands used.
3. Input/Output: Describe what inputs the script expects and what outputs it produces.
4. Implementation Details: Highlight key implementation aspects and techniques.
5. Potential Issues: Identify any potential bugs, edge cases, or security concerns.
6. Improvement Suggestions: Suggest ways to enhance the script's functionality or readability.

Format your response as JSON with the following structure:
{
  "purpose": "Brief description of what the script does",
  "dependencies": ["list", "of", "dependencies"],
  "input_output": {
    "inputs": ["list", "of", "inputs"],
    "outputs": ["list", "of", "outputs"]
  },
  "implementation_details": "Description of key implementation aspects",
  "potential_issues": ["list", "of", "potential", "issues"],
  "improvement_suggestions": ["list", "of", "suggestions"]
}
`;
        }
      }

      // Initialize results array
      const analysisResults: any[] = [];

      // Initialize rate limiter for Claude API
      const rateLimiter = new RateLimiter({
        maxRequests: concurrency,
        intervalMs: 1000,
      });

      // Process scripts in batches
      const batches = chunk(scriptFiles, batchSize);
      LoggerUtils.info(`Processing ${batches.length} batches with batch size ${batchSize}`);

      let currentBatch = 1;
      let successCount = 0;
      let failureCount = 0;

      for (const batch of batches) {
        LoggerUtils.info(`Processing batch ${currentBatch}/${batches.length}`);
        
        // Process each script in the batch with concurrency limit
        const batchPromises = batch.map((scriptFile: any) => {
          // Handle both string paths and objects with file_path property
          const filePath = typeof scriptFile === 'string' ? scriptFile : scriptFile.file_path;
          LoggerUtils.debug(`Processing script: ${filePath}`);
          return rateLimiter.schedule(() => 
            processScript(
              filePath, 
              promptTemplate, 
              outputDir, 
              options.checkReferences,
              options.updateDatabase
            )
          );
        });

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
            LoggerUtils.error(`Failed to process script: ${result.reason}`);
            failureCount++;
          }
        });

        LoggerUtils.info(`Completed batch ${currentBatch}/${batches.length}`);
        currentBatch++;
      }

      LoggerUtils.info(`Batch processing completed. Success: ${successCount}, Failure: ${failureCount}`);

      // Generate report if requested
      if (options.generateReport) {
        LoggerUtils.info('Generating summary report...');
        const reportPath = path.join(outputDir, 'script-analysis-report.md');
        const jsonReportPath = path.join(outputDir, 'script-analysis-report.json');
        const categorySummaryPath = path.join(outputDir, 'category-summary.md');
        
        // Save JSON report
        fs.writeFileSync(jsonReportPath, JSON.stringify(analysisResults, null, 2));
        
        // Create report sections
        const reportSections = createReportSections(analysisResults);
        
        // Generate and save the main report
        const reportResult = ReportService.generateAndWriteReport(
          reportSections, 
          reportPath, 
          'Script Analysis Report'
        );
        
        if (reportResult.success) {
          LoggerUtils.info(`Report generated at ${reportPath}`);
        } else {
          LoggerUtils.error(`Failed to generate report: ${reportResult.error}`);
        }
        
        // Generate category summary
        const categorySections = createCategorySummarySections(analysisResults);
        
        const categorySummaryResult = ReportService.generateAndWriteReport(
          categorySections,
          categorySummaryPath,
          'Document Type Category Summary'
        );
        
        if (categorySummaryResult.success) {
          LoggerUtils.info(`Category summary generated at ${categorySummaryPath}`);
        } else {
          LoggerUtils.error(`Failed to generate category summary: ${categorySummaryResult.error}`);
        }
      }

    } catch (error) {
      ErrorHandler.handle(error as Error);
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
    LoggerUtils.debug(`Processing script: ${scriptPath}`);
    
    // Check if file exists
    if (!fs.existsSync(scriptPath)) {
      LoggerUtils.error(`Script file not found: ${scriptPath}`);
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
    const analysisResult = await sendPrompt({
      prompt: completePrompt,
      model: configHelpers.defaultModel,
      temperature: 0,
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
      await updateDatabaseWithAnalysis(parsedAnalysis);
    }

    LoggerUtils.debug(`Successfully processed script: ${scriptPath}`);
    return parsedAnalysis;
  } catch (error) {
    LoggerUtils.error(`Error processing script ${scriptPath}:`, error);
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
            LoggerUtils.debug(`Script referenced in ${packageJsonPath}`);
            return true;
          }
        }
      } catch (error) {
        LoggerUtils.debug(`Error reading package.json at ${packageJsonPath}:`, error);
      }
    }
    
    return false;
  } catch (error) {
    LoggerUtils.error('Error checking script references:', error);
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
    LoggerUtils.error('Error parsing analysis result:', error);
    throw new Error(`Failed to parse analysis result: ${(error as Error).message}`);
  }
}

/**
 * Update the database with analysis results
 */
async function updateDatabaseWithAnalysis(analysis: any): Promise<void> {
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
    await upsertScript(scriptData);
    
    // If there are potential duplicates, add relationships
    if (assessment.potential_duplicates && assessment.potential_duplicates.length > 0) {
      for (const duplicatePath of assessment.potential_duplicates) {
        await addScriptRelationship({
          source_path: metadata.file_path,
          target_path: duplicatePath,
          relationship_type: 'duplicate',
          confidence: 7, // Default confidence level
          notes: 'Automatically detected by script analysis',
        });
      }
    }
    
    LoggerUtils.debug(`Database updated for script: ${metadata.file_path}`);
  } catch (error) {
    LoggerUtils.error('Error updating database:', error);
    throw error;
  }
}

/**
 * Create report sections from analysis results for the main report
 */
function createReportSections(results: any[]): Array<{title: string, content: string, level: number}> {
  const sections: Array<{title: string, content: string, level: number}> = [];
  
  // Add basic info section
  sections.push({
    title: 'Overview',
    content: `Total scripts analyzed: ${results.length}`,
    level: 2
  });
  
  // Add status summary section
  const statusCounts: Record<string, number> = {};
  results.forEach(result => {
    const status = result.assessment.status.recommendation;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  let statusContent = '';
  for (const [status, count] of Object.entries(statusCounts)) {
    statusContent += `- ${status}: ${count} scripts (${Math.round(count / results.length * 100)}%)\n`;
  }
  
  sections.push({
    title: 'Status Summary',
    content: statusContent,
    level: 2
  });
  
  // Add document type summary section
  const typeCounts: Record<string, number> = {};
  results.forEach(result => {
    const type = result.metadata.document_type;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  
  let typeContent = '';
  for (const [type, count] of Object.entries(typeCounts)) {
    typeContent += `- ${type}: ${count} scripts (${Math.round(count / results.length * 100)}%)\n`;
  }
  
  sections.push({
    title: 'Document Type Summary',
    content: typeContent,
    level: 2
  });
  
  // Add script details section
  sections.push({
    title: 'Script Details',
    content: '',
    level: 2
  });
  
  // Add each script as a subsection
  results.forEach(result => {
    const { metadata, assessment } = result;
    let scriptContent = '';
    scriptContent += `- **Path**: ${metadata.file_path}\n`;
    scriptContent += `- **Type**: ${metadata.document_type}\n`;
    scriptContent += `- **Language**: ${metadata.language}\n`;
    scriptContent += `- **Status**: ${assessment.status.recommendation} (Confidence: ${assessment.status.confidence}/10)\n`;
    scriptContent += `- **Quality Score**: ${(
      assessment.quality.code_quality + 
      assessment.quality.maintainability + 
      assessment.quality.utility + 
      assessment.quality.documentation
    ) / 4}/10\n`;
    scriptContent += `- **Relevance**: ${assessment.relevance.score}/10\n`;
    scriptContent += `- **Referenced**: ${assessment.referenced ? 'Yes' : 'No'}\n`;
    scriptContent += `- **Tags**: ${assessment.tags.join(', ')}\n\n`;
    scriptContent += `**Summary**: ${assessment.summary}\n\n`;
    scriptContent += `**Status Reasoning**: ${assessment.status.reasoning}\n\n`;
    scriptContent += `---`;
    
    sections.push({
      title: metadata.title,
      content: scriptContent,
      level: 3
    });
  });
  
  return sections;
}

/**
 * Create report sections for the category summary
 */
function createCategorySummarySections(results: any[]): Array<{title: string, content: string, level: number}> {
  const sections: Array<{title: string, content: string, level: number}> = [];
  
  // Group scripts by document type
  const scriptsByType: Record<string, any[]> = {};
  results.forEach(result => {
    const type = result.metadata.document_type;
    if (!scriptsByType[type]) {
      scriptsByType[type] = [];
    }
    scriptsByType[type].push(result);
  });
  
  // Process each category
  for (const [category, scripts] of Object.entries(scriptsByType)) {
    // Add category section
    sections.push({
      title: category,
      content: `Total scripts: ${scripts.length}`,
      level: 2
    });
    
    // Status breakdown
    const statusCounts: Record<string, number> = {};
    scripts.forEach(script => {
      const status = script.assessment.status.recommendation;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    let statusContent = '';
    for (const [status, count] of Object.entries(statusCounts)) {
      statusContent += `- ${status}: ${count} scripts (${Math.round(count / scripts.length * 100)}%)\n`;
    }
    
    sections.push({
      title: 'Status Breakdown',
      content: statusContent,
      level: 3
    });
    
    // List scripts in this category
    let scriptsContent = '';
    scriptsContent += `| Title | Path | Status | Quality |\n`;
    scriptsContent += `| ----- | ---- | ------ | ------- |\n`;
    
    scripts.forEach(script => {
      const { metadata, assessment } = script;
      const qualityScore = (
        assessment.quality.code_quality + 
        assessment.quality.maintainability + 
        assessment.quality.utility + 
        assessment.quality.documentation
      ) / 4;
      scriptsContent += `| ${metadata.title} | ${metadata.file_path} | ${assessment.status.recommendation} | ${qualityScore}/10 |\n`;
    });
    
    sections.push({
      title: 'Scripts',
      content: scriptsContent,
      level: 3
    });
  }
  
  return sections;
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