import { Command } from 'commander';
import path from 'path';
import * as fs from 'fs';
import logger from '../utils/logger';
import { errorHandler } from '../utils/error-handler';
import * as claudeService from '../services/claude-service';
import * as supabaseService from '../services/supabase-service';
import config from '../utils/config';
import { readPromptFromFile } from '../models/prompt';

interface ScriptAnalysisOptions {
  file: string;
  output: string;
  prompt?: string;
  promptName?: string;
  checkReferences: boolean;
  findDuplicates: boolean;
  updateDatabase: boolean;
  verbose: boolean;
}

/**
 * Command to analyze a script file
 */
export const analyzeScriptCommand = new Command('analyze-script')
  .description('Analyze a script file to categorize and assess it')
  .requiredOption('-f, --file <file>', 'Script file path to analyze')
  .option('-o, --output <file>', 'Output file path for analysis results', '')
  .option('-p, --prompt <file>', 'Custom prompt file path')
  .option('-n, --prompt-name <name>', 'Name of the prompt to use from the database', 'script-analysis-prompt')
  .option('-r, --check-references', 'Check for references in package.json files', false)
  .option('-d, --find-duplicates', 'Find potential duplicate scripts', false)
  .option('-u, --update-database', 'Update the Supabase database with analysis results', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options: ScriptAnalysisOptions) => {
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      logger.info('Starting script analysis...');
      logger.debug('Options:', options);

      // Resolve file paths
      const filePath = path.resolve(options.file);
      const outputPath = options.output ? path.resolve(options.output) : '';

      // Validate file paths
      if (!fs.existsSync(filePath)) {
        throw new Error(`Script file not found: ${filePath}`);
      }

      logger.info(`Analyzing script file: ${filePath}`);

      // Read script file content
      const scriptContent = fs.readFileSync(filePath, 'utf-8');
      const fileStats = fs.statSync(filePath);
      const language = getLanguageFromExtension(path.extname(filePath));

      // Prepare context for analysis
      const analysisContext: Record<string, any> = {
        file_path: filePath,
        language,
        file_size: fileStats.size,
        last_modified: fileStats.mtime.toISOString(),
      };

      // Check for references if requested
      if (options.checkReferences) {
        logger.info('Checking for package.json references...');
        analysisContext.references = await checkScriptReferences(filePath);
      }

      // Find potential duplicates if requested
      if (options.findDuplicates) {
        logger.info('Searching for potential duplicate scripts...');
        analysisContext.potential_duplicates = await findPotentialDuplicates(filePath);
      }

      // Get prompt template
      let promptTemplate: string;
      
      if (options.prompt) {
        // Read from file if prompt path is provided
        const promptPath = path.resolve(options.prompt);
        if (!fs.existsSync(promptPath)) {
          throw new Error(`Prompt file not found: ${promptPath}`);
        }
        logger.info(`Reading prompt template from file: ${promptPath}`);
        promptTemplate = await readPromptFromFile(promptPath);
      } else {
        // Get from database by name
        logger.info(`Fetching prompt template from database: ${options.promptName}`);
        const prompt = await supabaseService.getPromptByName(options.promptName || 'script-analysis-prompt');
        if (!prompt) {
          throw new Error(`Prompt not found in database: ${options.promptName}`);
        }
        promptTemplate = prompt.content;
      }

      // Generate the complete prompt with script content and context
      const completePrompt = generateAnalysisPrompt(promptTemplate, scriptContent, analysisContext);

      // Send to Claude for analysis
      logger.info('Sending to Claude for analysis...');
      const analysisResult = await claudeService.sendPrompt({
        prompt: completePrompt,
        model: config.defaultModel,
        temperature: 0.2,
        maxTokens: 4000,
      });

      // Parse the analysis result
      const parsedAnalysis = parseAnalysisResult(analysisResult);

      // Generate output file if specified
      if (outputPath) {
        logger.info(`Writing analysis results to: ${outputPath}`);
        fs.writeFileSync(outputPath, JSON.stringify(parsedAnalysis, null, 2));
      }

      // Update database if requested
      if (options.updateDatabase) {
        logger.info('Updating Supabase database with analysis results...');
        await updateDatabase(parsedAnalysis);
      }

      logger.info('Script analysis completed successfully.');
      
      // Display summary of analysis
      displayAnalysisSummary(parsedAnalysis);

    } catch (error) {
      errorHandler(error as Error);
      process.exit(1);
    }
  });

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
 * Find potential duplicate scripts based on content similarity
 */
async function findPotentialDuplicates(scriptPath: string): Promise<string[]> {
  try {
    // This is a placeholder for future implementation
    // In a real implementation, this would compare script content with other scripts
    // using similarity algorithms like cosine similarity or Levenshtein distance
    
    logger.debug('Placeholder for duplicate finding functionality');
    return [];
  } catch (error) {
    logger.error('Error finding potential duplicates:', error);
    return [];
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
${context.potential_duplicates ? `- Potential Duplicates: ${context.potential_duplicates.join(', ')}` : ''}
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
    
    logger.info('Database updated successfully');
  } catch (error) {
    logger.error('Error updating database:', error);
    throw error;
  }
}

/**
 * Display a summary of the analysis
 */
function displayAnalysisSummary(analysis: any): void {
  const { metadata, assessment } = analysis;
  
  console.log('\n==== Script Analysis Summary ====');
  console.log(`File: ${metadata.file_path}`);
  console.log(`Title: ${metadata.title}`);
  console.log(`Type: ${metadata.document_type}`);
  console.log(`Language: ${metadata.language}`);
  console.log('\nAssessment:');
  console.log(`- Summary: ${assessment.summary}`);
  console.log(`- Status: ${assessment.status.recommendation} (Confidence: ${assessment.status.confidence}/10)`);
  console.log(`- Quality: ${(
    assessment.quality.code_quality + 
    assessment.quality.maintainability + 
    assessment.quality.utility + 
    assessment.quality.documentation
  ) / 4}/10`);
  console.log(`- Relevance: ${assessment.relevance.score}/10`);
  console.log(`- Tags: ${assessment.tags.join(', ')}`);
  
  if (assessment.potential_duplicates && assessment.potential_duplicates.length > 0) {
    console.log('\nPotential Duplicates:');
    assessment.potential_duplicates.forEach((dup: string) => console.log(`- ${dup}`));
  }
  
  console.log('================================\n');
}