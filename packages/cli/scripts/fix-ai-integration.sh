#!/bin/bash

# This script adds AI integration to the batch-analyze-scripts command

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIST_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/dist"

# Check if CLI dist directory exists
if [ ! -d "$CLI_DIST_DIR" ]; then
  echo "Error: CLI dist directory doesn't exist."
  echo "Please build the CLI package first with npm run build"
  exit 1
fi

# Create temp JavaScript implementation of claude-service.js
CLAUDE_SERVICE_FILE="$(mktemp)"

cat > "$CLAUDE_SERVICE_FILE" << 'EOL'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeService = void 0;
const axios = require('axios');
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../utils/error-handler");
const fs = require('fs');
const path = require('path');

class ClaudeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-5-sonnet-20240620';
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  /**
   * Send a prompt to Claude API
   */
  async sendPrompt(promptContent, systemPrompt = '', options = {}) {
    const model = options.model || this.model;
    const maxTokens = options.maxTokens || 4096;
    
    logger_1.Logger.debug(`Sending prompt to Claude API (model: ${model})`);
    logger_1.Logger.debug(`System prompt length: ${systemPrompt.length} chars`);
    logger_1.Logger.debug(`User prompt length: ${promptContent.length} chars`);
    
    return await this.callWithRetry(async () => {
      try {
        const response = await axios({
          method: 'post',
          url: this.baseURL,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          data: {
            model: model,
            max_tokens: maxTokens,
            messages: [
              {
                role: 'user',
                content: promptContent
              }
            ],
            system: systemPrompt || undefined
          }
        });
        
        logger_1.Logger.debug('Claude API response received');
        logger_1.Logger.debug(`Response content length: ${response.data.content?.length || 0}`);
        
        // Extract the response text from the first content block
        let responseText = '';
        if (response.data && response.data.content && Array.isArray(response.data.content)) {
          // Find the first text content
          const textContent = response.data.content.find(item => item.type === 'text');
          if (textContent) {
            responseText = textContent.text;
          }
        }
        
        return {
          success: true,
          content: responseText,
          raw: response.data,
          usage: {
            input_tokens: response.data.usage?.input_tokens || 0,
            output_tokens: response.data.usage?.output_tokens || 0
          }
        };
      } catch (error) {
        // Handle API error
        logger_1.Logger.error('Claude API error:', error);
        
        // Format error details for better debugging
        const errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        };
        
        throw new error_handler_1.AppError(
          `Claude API request failed: ${error.message}`,
          'CLAUDE_API_ERROR',
          errorDetails
        );
      }
    });
  }
  
  /**
   * Call a function with retry logic
   */
  async callWithRetry(fn, retryCount = 0) {
    try {
      return await fn();
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        logger_1.Logger.warn(`Retry ${retryCount + 1}/${this.maxRetries} after ${delay}ms delay...`);
        
        return new Promise(resolve => {
          setTimeout(async () => {
            resolve(await this.callWithRetry(fn, retryCount + 1));
          }, delay);
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Analyze a script file using Claude AI
   */
  async analyzeScript(scriptFilePath, promptContent, systemPrompt = '', options = {}) {
    try {
      if (!fs.existsSync(scriptFilePath)) {
        throw new error_handler_1.AppError(`Script file not found: ${scriptFilePath}`, 'FILE_NOT_FOUND');
      }
      
      // Read the script content
      const scriptContent = fs.readFileSync(scriptFilePath, 'utf-8');
      const fileName = path.basename(scriptFilePath);
      const fileExt = path.extname(scriptFilePath).toLowerCase();
      
      // Determine the language based on extension
      let language = 'unknown';
      if (fileExt === '.js') language = 'javascript';
      else if (fileExt === '.ts' || fileExt === '.tsx') language = 'typescript';
      else if (fileExt === '.py') language = 'python';
      else if (fileExt === '.sh' || fileExt === '.bash') language = 'shell';
      else if (fileExt === '.sql') language = 'sql';
      
      // Replace placeholders in the prompt
      const fullPrompt = promptContent
        .replace('{{FILE_PATH}}', scriptFilePath)
        .replace('{{FILE_NAME}}', fileName)
        .replace('{{LANGUAGE}}', language)
        .replace('{{SCRIPT_CONTENT}}', scriptContent);
      
      // Send the prompt to Claude
      logger_1.Logger.info(`Analyzing script: ${scriptFilePath}`);
      const response = await this.sendPrompt(fullPrompt, systemPrompt, options);
      
      // Extract and parse the JSON response
      let analysisResult = {};
      try {
        // Try to find JSON content between triple backticks
        const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          analysisResult = JSON.parse(jsonMatch[1]);
        } else {
          // If no json markers, try to parse the entire response
          analysisResult = JSON.parse(response.content);
        }
      } catch (parseError) {
        logger_1.Logger.error(`Failed to parse JSON response: ${parseError.message}`);
        logger_1.Logger.debug('Raw response:', response.content);
        
        // Create a minimal result with the raw content
        analysisResult = {
          file_path: scriptFilePath,
          title: `Analysis of ${fileName}`,
          summary: "Could not parse AI response into structured format.",
          document_type: "unknown",
          script_type: "unknown",
          raw_response: response.content,
          error: parseError.message,
          analysis_status: "parsing_failed"
        };
      }
      
      // Ensure the analysis result has the file path
      if (!analysisResult.file_path) {
        analysisResult.file_path = scriptFilePath;
      }
      
      return {
        success: true,
        result: analysisResult,
        usage: response.usage
      };
    } catch (error) {
      logger_1.Logger.error(`Script analysis failed for ${scriptFilePath}:`, error);
      
      return {
        success: false,
        error: error.message,
        result: {
          file_path: scriptFilePath,
          title: `Failed analysis of ${path.basename(scriptFilePath)}`,
          summary: `Analysis failed: ${error.message}`,
          document_type: "unknown",
          script_type: "unknown",
          analysis_status: "failed"
        }
      };
    }
  }
}

exports.ClaudeService = ClaudeService;
EOL

# Create temp JavaScript implementation of supabase-service additions
SUPABASE_SERVICE_FILE="$(mktemp)"

cat > "$SUPABASE_SERVICE_FILE" << 'EOL'
/**
 * Get prompt by name with relationships and document types
 */
async getPromptWithRelationships(promptName) {
  return await ErrorHandler.wrap(async () => {
    Logger.debug(`Getting prompt by name with relationships: ${promptName}`);
    
    // Get the prompt
    const prompt = await this.getPromptByName(promptName);
    
    if (!prompt) {
      Logger.warn(`No prompt found with name: ${promptName}`);
      return null;
    }
    
    // Get relationships for the prompt
    const relationships = await this.getRelationshipsByPromptId(prompt.id);
    
    // Get document types for categories
    const documentTypes = await this.getDocumentTypesByCategories(['AI', 'Development', 'Integrations', 'Operations']);
    
    // Get the script report metadata
    const scriptReportMetadata = await this.getScriptReportMetadata(promptName);
    
    return {
      prompt,
      relationships,
      documentTypes,
      scriptReportMetadata
    };
  }, `Failed to get prompt with relationships: ${promptName}`);
}

/**
 * Get document types by categories
 */
async getDocumentTypesByCategories(categories) {
  return await ErrorHandler.wrap(async () => {
    Logger.debug(`Getting document types for categories: ${categories.join(', ')}`);
    
    const { data, error } = await this.client
      .from('document_types')
      .select('*')
      .in('category', categories);
    
    if (error) {
      throw new AppError(
        `Failed to get document types by categories: ${error.message}`,
        'SUPABASE_ERROR',
        error
      );
    }
    
    Logger.debug(`Found ${data?.length || 0} document types for categories: ${categories.join(', ')}`);
    return data || [];
  }, `Failed to get document types for categories: ${categories.join(', ')}`);
}

/**
 * Get script report metadata
 */
async getScriptReportMetadata(promptName) {
  return await ErrorHandler.wrap(async () => {
    Logger.debug(`Getting script report metadata for prompt: ${promptName}`);
    
    // Find the script report markdown file
    const { data, error } = await this.client
      .from('documentation_files')
      .select('*')
      .ilike('file_path', '%script%report.md%')
      .eq('is_deleted', false)
      .limit(1);
    
    if (error) {
      throw new AppError(
        `Failed to get script report metadata: ${error.message}`,
        'SUPABASE_ERROR',
        error
      );
    }
    
    if (!data || data.length === 0) {
      Logger.warn('No script report metadata file found');
      return null;
    }
    
    Logger.debug(`Found script report metadata file: ${data[0].file_path}`);
    return data[0];
  }, 'Failed to get script report metadata');
}
EOL

# Create an updated batch-analyze-scripts with AI integration
BATCH_ANALYZE_AI_FILE="$(mktemp)"

cat > "$BATCH_ANALYZE_AI_FILE" << 'EOL'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAnalyzeScriptsCommand = void 0;
const commander_1 = require("commander");
const path = require("path");
const fs = require("fs");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../utils/error-handler");
const config_1 = require("../utils/config");
const ClaudeService_1 = require("../services/claude-service");
const SupabaseService_1 = require("../services/supabase-service");

/**
 * Command to batch analyze script files
 */
exports.batchAnalyzeScriptsCommand = new commander_1.Command('batch-analyze-scripts')
    .description('Analyze multiple script files and update database')
    .option('-i, --input <file>', 'Input JSON file with script info', 'script-scan-results.json')
    .option('-o, --output-dir <directory>', 'Output directory for analysis results', 'script-analysis-results')
    .option('-p, --prompt-name <name>', 'Name of the prompt to use for analysis', 'script-analysis-prompt')
    .option('-c, --concurrency <number>', 'Number of concurrent analyses to run', '2')
    .option('-b, --batch-size <number>', 'Number of scripts to analyze in a batch', '10')
    .option('-r, --check-references', 'Check for script references', false)
    .option('-d, --update-database', 'Update database with analysis results', false)
    .option('-m, --max-scripts <number>', 'Maximum number of scripts to analyze', '0')
    .option('-e, --extensions <extensions>', 'Filter by extensions (comma separated)', 'sh')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .option('-a, --use-ai', 'Use AI for analysis', false)
    .action(async (options) => {
        try {
            if (options.verbose) {
                logger_1.Logger.setLevel(logger_1.LogLevel.DEBUG);
            }
            
            logger_1.Logger.info('Starting batch script analysis...');
            logger_1.Logger.debug('Options:', options);
            
            // Parse options
            const inputPath = path.resolve(options.input);
            const outputDir = path.resolve(options.outputDir);
            const promptName = options.promptName;
            const concurrency = parseInt(options.concurrency, 10);
            const batchSize = parseInt(options.batchSize, 10);
            const checkReferences = options.checkReferences;
            const updateDatabase = options.updateDatabase;
            const maxScripts = parseInt(options.maxScripts, 10);
            const useAI = options.useAI;
            const extensions = options.extensions.split(',').map(ext => ext.trim());
            
            // Validate input file
            if (!fs.existsSync(inputPath)) {
                throw new Error(`Input file not found: ${inputPath}`);
            }
            
            // Create output directory if it doesn't exist
            if (!fs.existsSync(outputDir)) {
                logger_1.Logger.info(`Creating output directory: ${outputDir}`);
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            // Read input file
            logger_1.Logger.info(`Reading input file: ${inputPath}`);
            const scriptsData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
            
            if (!Array.isArray(scriptsData)) {
                throw new Error('Input file does not contain an array of scripts');
            }
            
            // Filter scripts by extension if specified
            let filteredScripts = scriptsData;
            if (extensions.length > 0) {
                filteredScripts = scriptsData.filter(script => {
                    const ext = path.extname(script.file_path).replace('.', '');
                    return extensions.includes(ext);
                });
                logger_1.Logger.info(`Filtered to ${filteredScripts.length} scripts with extensions: ${extensions.join(', ')}`);
            }
            
            // Limit the number of scripts to analyze if maxScripts is provided
            const scriptsToAnalyze = maxScripts > 0 ? filteredScripts.slice(0, maxScripts) : filteredScripts;
            
            logger_1.Logger.info(`Found ${scriptsToAnalyze.length} scripts to analyze`);
            
            // Initialize services for AI analysis and database updates if needed
            let claudeService = null;
            let supabaseService = null;
            let prompt = null;
            let systemPrompt = '';
            let documentTypes = [];
            
            if (useAI) {
                logger_1.Logger.info('Initializing AI services for analysis');
                
                // Initialize services
                claudeService = new ClaudeService_1.ClaudeService(config_1.default.anthropicApiKey);
                supabaseService = new SupabaseService_1.SupabaseService(config_1.default.supabaseUrl, config_1.default.supabaseKey);
                
                // Fetch prompt and related data
                logger_1.Logger.info(`Fetching prompt: ${promptName}`);
                const promptData = await supabaseService.getPromptWithRelationships(promptName);
                
                if (!promptData || !promptData.prompt) {
                    throw new Error(`Prompt not found: ${promptName}`);
                }
                
                prompt = promptData.prompt.content;
                systemPrompt = promptData.prompt.system_prompt || '';
                documentTypes = promptData.documentTypes || [];
                
                logger_1.Logger.info(`Fetched prompt (${prompt.length} chars) and ${documentTypes.length} document types`);
                logger_1.Logger.debug('Available document types:', documentTypes.map(dt => dt.name).join(', '));
            }
            
            // Analyze scripts
            logger_1.Logger.info('Starting script analysis...');
            
            // Process scripts with concurrency limit
            const results = [];
            
            // Analyze in batches
            for (let i = 0; i < scriptsToAnalyze.length; i += batchSize) {
                const batch = scriptsToAnalyze.slice(i, i + batchSize);
                logger_1.Logger.info(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(scriptsToAnalyze.length / batchSize)} (${batch.length} scripts)`);
                
                // Process batch with concurrency
                const batchPromises = [];
                
                for (const script of batch) {
                    if (useAI && claudeService && prompt) {
                        // Use AI for analysis
                        batchPromises.push(analyzeScriptWithAI(script, claudeService, prompt, systemPrompt));
                    } else {
                        // Use rule-based analysis
                        batchPromises.push(analyzeScriptWithRules(script));
                    }
                }
                
                // Wait for all promises in the batch to resolve
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                
                // Update database if requested
                if (updateDatabase && supabaseService) {
                    logger_1.Logger.info('Updating database with analysis results');
                    for (const result of batchResults) {
                        try {
                            await updateScriptInDatabase(result, supabaseService);
                        } catch (error) {
                            logger_1.Logger.error(`Failed to update database for ${result.file_path}:`, error);
                        }
                    }
                }
                
                logger_1.Logger.info(`Completed batch ${Math.floor(i / batchSize) + 1}`);
            }
            
            // Write analysis results to individual files
            logger_1.Logger.info(`Writing analysis results to ${outputDir}`);
            
            for (const result of results) {
                const fileName = path.basename(result.file_path).replace(/\.[^/.]+$/, '.json');
                const outputPath = path.join(outputDir, fileName);
                
                fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
                logger_1.Logger.debug(`Wrote analysis for ${result.file_path} to ${outputPath}`);
            }
            
            // Write a summary report
            const summaryReport = {
                analyzed_at: new Date().toISOString(),
                total_scripts: results.length,
                languages: countLanguages(results),
                document_types: countDocumentTypes(results),
                script_types: countScriptTypes(results),
                ai_used: useAI
            };
            
            fs.writeFileSync(path.join(outputDir, 'analysis-summary.json'), JSON.stringify(summaryReport, null, 2));
            
            // Generate a markdown report
            generateMarkdownReport(results, outputDir, useAI);
            
            logger_1.Logger.info('Batch script analysis completed successfully!');
            logger_1.Logger.info(`Analysis results written to: ${outputDir}`);
            logger_1.Logger.info(`Summary report available at: ${path.join(outputDir, 'analysis-summary.json')}`);
            logger_1.Logger.info(`Markdown report available at: ${path.join(outputDir, 'script-analysis-report.md')}`);
            
        } catch (error) {
            error_handler_1.ErrorHandler.handle(error, true);
        }
    });

/**
 * Analyze a script using Claude AI
 */
async function analyzeScriptWithAI(script, claudeService, promptContent, systemPrompt) {
    try {
        logger_1.Logger.info(`AI analyzing: ${script.file_path}`);
        
        const result = await claudeService.analyzeScript(
            script.file_path,
            promptContent,
            systemPrompt,
            { maxTokens: 4096 }
        );
        
        if (!result.success) {
            logger_1.Logger.error(`AI analysis failed for ${script.file_path}: ${result.error}`);
            return analyzeScriptWithRules(script); // Fallback to rule-based analysis
        }
        
        const analysis = result.result;
        
        // Add metadata
        analysis.file_path = script.file_path;
        analysis.language = script.language || getLanguageFromExtension(path.extname(script.file_path));
        analysis.analyzed_at = new Date().toISOString();
        analysis.analysis_method = 'ai';
        analysis.token_usage = result.usage;
        
        return analysis;
    } catch (error) {
        logger_1.Logger.error(`Error analyzing ${script.file_path} with AI:`, error);
        return analyzeScriptWithRules(script); // Fallback to rule-based analysis
    }
}

/**
 * Analyze a script using rule-based approach
 */
function analyzeScriptWithRules(script) {
    logger_1.Logger.debug(`Rule-based analyzing: ${script.file_path}`);
    
    return {
        file_path: script.file_path,
        language: script.language || 'unknown',
        title: `Analysis of ${path.basename(script.file_path)}`,
        summary: 'This is a placeholder summary generated by the rule-based analysis.',
        document_type: getDocumentTypeForFile(script.file_path),
        tags: ['placeholder', 'rule-based', script.language || 'unknown'],
        script_type: getScriptTypeForFile(script.file_path),
        usage_status: 'active',
        relevance_score: 80,
        relevance_reasoning: 'This is a placeholder relevance reasoning.',
        code_quality: 70,
        maintainability: 70,
        utility: 70,
        documentation: 60,
        status: 'analyzed',
        status_confidence: 90,
        status_reasoning: 'This is a rule-based analysis.',
        referenced: false,
        references: [],
        analyzed_at: new Date().toISOString(),
        analysis_method: 'rule-based'
    };
}

/**
 * Update a script in the database
 */
async function updateScriptInDatabase(scriptAnalysis, supabaseService) {
    try {
        logger_1.Logger.debug(`Updating database for: ${scriptAnalysis.file_path}`);
        
        // Create database record structure
        const scriptData = {
            file_path: scriptAnalysis.file_path,
            title: scriptAnalysis.title || `Analysis of ${path.basename(scriptAnalysis.file_path)}`,
            language: scriptAnalysis.language || 'unknown',
            document_type: scriptAnalysis.document_type || 'unknown',
            summary: scriptAnalysis.summary || 'No summary available',
            tags: scriptAnalysis.tags || [],
            code_quality: scriptAnalysis.code_quality || 70,
            maintainability: scriptAnalysis.maintainability || 70,
            utility: scriptAnalysis.utility || 70,
            documentation: scriptAnalysis.documentation || 60,
            relevance_score: scriptAnalysis.relevance_score || 80,
            relevance_reasoning: scriptAnalysis.relevance_reasoning || 'No reasoning available',
            referenced: scriptAnalysis.referenced || false,
            status: scriptAnalysis.status || 'analyzed',
            status_confidence: scriptAnalysis.status_confidence || 90,
            status_reasoning: scriptAnalysis.status_reasoning || 'No reasoning available',
            script_type: scriptAnalysis.script_type || 'unknown',
            usage_status: scriptAnalysis.usage_status || 'active',
            last_analyzed: new Date().toISOString(),
            analysis_data: scriptAnalysis
        };
        
        // Upsert the script record
        const result = await supabaseService.upsertScript(scriptData);
        logger_1.Logger.debug(`Database updated for ${scriptAnalysis.file_path}, ID: ${result.id}`);
        
        // Process references if available
        if (scriptAnalysis.references && Array.isArray(scriptAnalysis.references) && scriptAnalysis.references.length > 0) {
            logger_1.Logger.debug(`Processing ${scriptAnalysis.references.length} references for ${scriptAnalysis.file_path}`);
            
            for (const reference of scriptAnalysis.references) {
                if (typeof reference === 'string' && reference.trim()) {
                    try {
                        await supabaseService.addScriptRelationship({
                            source_path: scriptAnalysis.file_path,
                            target_path: reference,
                            relationship_type: 'references',
                            confidence: 80,
                            notes: 'Automatically detected reference'
                        });
                    } catch (error) {
                        logger_1.Logger.warn(`Failed to add reference from ${scriptAnalysis.file_path} to ${reference}:`, error);
                    }
                }
            }
        }
        
        return result;
    } catch (error) {
        logger_1.Logger.error(`Failed to update database for ${scriptAnalysis.file_path}:`, error);
        throw error;
    }
}

/**
 * Determine the document type based on file path and language
 */
function getDocumentTypeForFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath).toLowerCase();
    
    // SQL files
    if (ext === '.sql') {
        if (baseName.includes('migration')) return 'database_migration';
        if (baseName.includes('query')) return 'database_query';
        if (baseName.includes('function')) return 'database_function';
        if (baseName.includes('trigger')) return 'database_trigger';
        if (baseName.includes('view')) return 'database_view';
        return 'sql_script';
    }
    
    // Shell scripts
    if (ext === '.sh' || ext === '.bash') {
        if (baseName.includes('build')) return 'build_script';
        if (baseName.includes('test')) return 'test_script';
        if (baseName.includes('deploy')) return 'deployment_script';
        if (baseName.includes('setup')) return 'setup_script';
        if (baseName.includes('install')) return 'installation_script';
        return 'shell_script';
    }
    
    // JavaScript/TypeScript files
    if (ext === '.js' || ext === '.ts' || ext === '.tsx' || ext === '.jsx') {
        if (filePath.includes('components')) return 'ui_component';
        if (filePath.includes('utils') || filePath.includes('helpers')) return 'utility';
        if (filePath.includes('services')) return 'service';
        if (filePath.includes('api')) return 'api_endpoint';
        if (filePath.includes('hooks')) return 'react_hook';
        if (filePath.includes('context')) return 'context_provider';
        if (filePath.includes('store') || filePath.includes('reducers')) return 'state_management';
        if (filePath.includes('pages')) return 'page_component';
        if (filePath.includes('test') || filePath.includes('spec')) return 'test_script';
        if (filePath.includes('config')) return 'configuration';
        if (baseName.includes('index')) return 'module_index';
        return ext === '.ts' || ext === '.tsx' ? 'typescript_script' : 'javascript_script';
    }
    
    // Python files
    if (ext === '.py') {
        if (filePath.includes('test')) return 'test_script';
        if (baseName.includes('setup')) return 'setup_script';
        return 'python_script';
    }
    
    // Default case
    return 'other';
}

/**
 * Determine the script type based on file path and content
 */
function getScriptTypeForFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath).toLowerCase();
    const dirName = path.dirname(filePath).toLowerCase();
    
    // Utility scripts
    if (dirName.includes('utils') || dirName.includes('helpers') || dirName.includes('lib')) {
        return 'utility';
    }
    
    // CI/CD scripts
    if (dirName.includes('ci') || dirName.includes('cd') || dirName.includes('github/workflows')) {
        return 'ci_cd';
    }
    
    // Build scripts
    if (baseName.includes('build') || baseName.includes('webpack') || baseName.includes('vite')) {
        return 'build';
    }
    
    // Deployment scripts
    if (baseName.includes('deploy') || baseName.includes('publish')) {
        return 'deployment';
    }
    
    // Setup scripts
    if (baseName.includes('setup') || baseName.includes('install') || baseName.includes('init')) {
        return 'setup';
    }
    
    // Database scripts
    if (ext === '.sql' || dirName.includes('database') || dirName.includes('db') || dirName.includes('migrations')) {
        return 'database';
    }
    
    // Test scripts
    if (dirName.includes('test') || dirName.includes('spec') || baseName.includes('test') || baseName.includes('spec')) {
        return 'test';
    }
    
    // Data processing scripts
    if (dirName.includes('data') || baseName.includes('process') || baseName.includes('transform')) {
        return 'data_processing';
    }
    
    // Configuration scripts
    if (dirName.includes('config') || baseName.includes('config') || baseName.includes('settings')) {
        return 'configuration';
    }
    
    // Default based on language
    if (ext === '.sh' || ext === '.bash') return 'shell';
    if (ext === '.py') return 'python';
    if (ext === '.js') return 'javascript';
    if (ext === '.ts') return 'typescript';
    if (ext === '.sql') return 'sql';
    
    return 'other';
}

/**
 * Get the language name based on file extension
 */
function getLanguageFromExtension(extension) {
    const extensionMap = {
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
 * Count the number of scripts for each language
 */
function countLanguages(results) {
    const languages = {};
    
    for (const result of results) {
        const language = result.language || 'unknown';
        languages[language] = (languages[language] || 0) + 1;
    }
    
    return languages;
}

/**
 * Count the number of scripts for each document type
 */
function countDocumentTypes(results) {
    const documentTypes = {};
    
    for (const result of results) {
        const documentType = result.document_type || 'unknown';
        documentTypes[documentType] = (documentTypes[documentType] || 0) + 1;
    }
    
    return documentTypes;
}

/**
 * Count the number of scripts for each script type
 */
function countScriptTypes(results) {
    const scriptTypes = {};
    
    for (const result of results) {
        const scriptType = result.script_type || 'unknown';
        scriptTypes[scriptType] = (scriptTypes[scriptType] || 0) + 1;
    }
    
    return scriptTypes;
}

/**
 * Generate a markdown report from the analysis results
 */
function generateMarkdownReport(results, outputDir, aiUsed = false) {
    const reportPath = path.join(outputDir, 'script-analysis-report.md');
    const categoryReport = path.join(outputDir, 'category-summary.md');
    
    // Sort results by document type and script type
    results.sort((a, b) => {
        if (a.document_type !== b.document_type) {
            return a.document_type.localeCompare(b.document_type);
        }
        return a.script_type.localeCompare(b.script_type);
    });
    
    // Generate the main report
    let reportContent = `# Script Analysis Report\n\n`;
    reportContent += `Generated on: ${new Date().toISOString()}\n\n`;
    reportContent += `Total scripts analyzed: ${results.length}\n`;
    reportContent += `Analysis method: ${aiUsed ? 'AI-assisted' : 'Rule-based'}\n\n`;
    
    reportContent += `## Summary by Language\n\n`;
    const languages = countLanguages(results);
    for (const language in languages) {
        reportContent += `- **${language}**: ${languages[language]} scripts\n`;
    }
    
    reportContent += `\n## Summary by Document Type\n\n`;
    const documentTypes = countDocumentTypes(results);
    for (const documentType in documentTypes) {
        reportContent += `- **${documentType}**: ${documentTypes[documentType]} scripts\n`;
    }
    
    reportContent += `\n## Summary by Script Type\n\n`;
    const scriptTypes = countScriptTypes(results);
    for (const scriptType in scriptTypes) {
        reportContent += `- **${scriptType}**: ${scriptTypes[scriptType]} scripts\n`;
    }
    
    reportContent += `\n## Scripts Analysis\n\n`;
    
    // Group results by document type
    const resultsByDocType = {};
    
    for (const result of results) {
        if (!resultsByDocType[result.document_type]) {
            resultsByDocType[result.document_type] = [];
        }
        resultsByDocType[result.document_type].push(result);
    }
    
    // Add each document type section
    for (const docType in resultsByDocType) {
        reportContent += `### ${docType}\n\n`;
        
        for (const result of resultsByDocType[docType]) {
            reportContent += `#### ${result.title || path.basename(result.file_path)}\n\n`;
            reportContent += `- **Path**: \`${result.file_path}\`\n`;
            reportContent += `- **Language**: ${result.language}\n`;
            reportContent += `- **Script Type**: ${result.script_type}\n`;
            reportContent += `- **Status**: ${result.status} (Confidence: ${result.status_confidence}%)\n`;
            reportContent += `- **Relevance Score**: ${result.relevance_score}/100\n`;
            reportContent += `- **Analysis Method**: ${result.analysis_method || 'unknown'}\n`;
            reportContent += `- **Tags**: ${result.tags ? result.tags.join(', ') : 'none'}\n\n`;
            reportContent += `${result.summary}\n\n`;
            
            if (result.references && result.references.length > 0) {
                reportContent += `**References**:\n`;
                for (const ref of result.references) {
                    reportContent += `- ${ref}\n`;
                }
                reportContent += `\n`;
            }
            
            reportContent += `---\n\n`;
        }
    }
    
    // Write the main report
    fs.writeFileSync(reportPath, reportContent);
    
    // Generate the category summary report
    let categoryContent = `# Script Categories Summary\n\n`;
    categoryContent += `Generated on: ${new Date().toISOString()}\n\n`;
    categoryContent += `Analysis method: ${aiUsed ? 'AI-assisted' : 'Rule-based'}\n\n`;
    
    // Document types summary
    categoryContent += `## Document Types\n\n`;
    categoryContent += `| Document Type | Count | Description |\n`;
    categoryContent += `|--------------|-------|-------------|\n`;
    
    for (const docType in documentTypes) {
        const description = getDocumentTypeDescription(docType);
        categoryContent += `| ${docType} | ${documentTypes[docType]} | ${description} |\n`;
    }
    
    // Script types summary
    categoryContent += `\n## Script Types\n\n`;
    categoryContent += `| Script Type | Count | Description |\n`;
    categoryContent += `|------------|-------|-------------|\n`;
    
    for (const scriptType in scriptTypes) {
        const description = getScriptTypeDescription(scriptType);
        categoryContent += `| ${scriptType} | ${scriptTypes[scriptType]} | ${description} |\n`;
    }
    
    // Write the category summary
    fs.writeFileSync(categoryReport, categoryContent);
}

/**
 * Get a description for a document type
 */
function getDocumentTypeDescription(docType) {
    const descriptions = {
        'database_migration': 'SQL files that define database schema changes',
        'database_query': 'SQL files containing queries for retrieving data',
        'database_function': 'SQL files defining database functions or procedures',
        'database_trigger': 'SQL files defining database triggers',
        'database_view': 'SQL files defining database views',
        'sql_script': 'General SQL scripts',
        'build_script': 'Scripts used in the build process',
        'test_script': 'Scripts used for testing',
        'deployment_script': 'Scripts used for deployment',
        'setup_script': 'Scripts used for setup and initialization',
        'installation_script': 'Scripts used for installation',
        'shell_script': 'General shell scripts',
        'ui_component': 'User interface components',
        'utility': 'Utility functions and helpers',
        'service': 'Service modules',
        'api_endpoint': 'API endpoint handlers',
        'react_hook': 'React hooks',
        'context_provider': 'React context providers',
        'state_management': 'State management code',
        'page_component': 'Page components',
        'configuration': 'Configuration files',
        'module_index': 'Index files for modules',
        'typescript_script': 'General TypeScript scripts',
        'javascript_script': 'General JavaScript scripts',
        'python_script': 'General Python scripts',
        'other': 'Other script types not categorized elsewhere'
    };
    
    return descriptions[docType] || 'No description available';
}

/**
 * Get a description for a script type
 */
function getScriptTypeDescription(scriptType) {
    const descriptions = {
        'utility': 'Utility or helper scripts',
        'ci_cd': 'Continuous integration or deployment scripts',
        'build': 'Build system scripts',
        'deployment': 'Scripts used to deploy applications',
        'setup': 'Setup and initialization scripts',
        'database': 'Database-related scripts',
        'test': 'Testing scripts',
        'data_processing': 'Data processing and transformation scripts',
        'configuration': 'Configuration scripts',
        'shell': 'General shell scripts',
        'python': 'General Python scripts',
        'javascript': 'General JavaScript scripts',
        'typescript': 'General TypeScript scripts',
        'sql': 'General SQL scripts',
        'other': 'Other script types not categorized elsewhere'
    };
    
    return descriptions[scriptType] || 'No description available';
}
EOL

# Main script to add the AI integration components
echo "Ensuring CLI dist directory structure exists..."
mkdir -p "$CLI_DIST_DIR/services"
mkdir -p "$CLI_DIST_DIR/commands"

echo "Copying the Claude service implementation..."
cp "$CLAUDE_SERVICE_FILE" "$CLI_DIST_DIR/services/claude-service.js"

echo "Adding Supabase service extensions..."
if [ -f "$CLI_DIST_DIR/services/supabase-service.js" ]; then
    # Append the new methods to the existing file
    TEMP_FILE="$(mktemp)"
    cat "$CLI_DIST_DIR/services/supabase-service.js" | grep -v '}$' > "$TEMP_FILE"
    cat "$SUPABASE_SERVICE_FILE" >> "$TEMP_FILE"
    echo "}" >> "$TEMP_FILE"
    cp "$TEMP_FILE" "$CLI_DIST_DIR/services/supabase-service.js"
    rm "$TEMP_FILE"
else
    echo "Error: Supabase service file not found. Please run fix-permissions.sh first."
    exit 1
fi

echo "Copying the AI-enabled batch-analyze-scripts implementation..."
cp "$BATCH_ANALYZE_AI_FILE" "$CLI_DIST_DIR/commands/batch-analyze-scripts.js"

# Create a config.js file if it doesn't exist
if [ ! -f "$CLI_DIST_DIR/utils/config.js" ]; then
    echo "Creating minimal config.js..."
    mkdir -p "$CLI_DIST_DIR/utils"
    
    cat > "$CLI_DIST_DIR/utils/config.js" << 'EOL'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// Ensure environment variables are set
if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Using SUPABASE_SERVICE_ROLE_KEY as VITE_SUPABASE_SERVICE_ROLE_KEY');
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// Singleton config class
const config = {
    supabaseUrl: process.env.VITE_SUPABASE_URL || '',
    supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    anthropicApiKey: process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    logLevel: 'info',
    defaultOutputDir: 'docs',
    defaultModel: 'claude-3-5-sonnet-20240620'
};

exports.default = config;
EOL
fi

# Clean up
rm "$CLAUDE_SERVICE_FILE"
rm "$SUPABASE_SERVICE_FILE"
rm "$BATCH_ANALYZE_AI_FILE"

# Update CLI index.js to include the dependencies
echo "Updating CLI index.js with config paths..."
TEMP_INDEX_FILE="$(mktemp)"

cat > "$TEMP_INDEX_FILE" << 'EOL'
#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const scan_scripts_1 = require("./commands/scan-scripts");
const batch_analyze_scripts_1 = require("./commands/batch-analyze-scripts");

// Ensure environment variables are set
if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Using SUPABASE_SERVICE_ROLE_KEY as VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// Try to load environment from .env file
try {
  const fs = require('fs');
  const path = require('path');
  const dotenv = require('dotenv');
  
  // Check for .env.development in current directory
  const envPath = path.resolve(process.cwd(), '.env.development');
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from: ${envPath}`);
    dotenv.config({ path: envPath });
  }
} catch (err) {
  console.warn('Could not load .env file:', err.message);
}

const program = new commander_1.Command()
    .name('ai-workflow')
    .description('CLI for AI workflows')
    .version('1.0.0');

// Register commands
program.addCommand(scan_scripts_1.scanScriptsCommand);
program.addCommand(batch_analyze_scripts_1.batchAnalyzeScriptsCommand);

// Parse command-line arguments
program.parse();
EOL

cp "$TEMP_INDEX_FILE" "$CLI_DIST_DIR/index.js"
chmod +x "$CLI_DIST_DIR/index.js"

# Clean up
rm "$TEMP_INDEX_FILE"

echo "Creating helper script to run AI analysis..."
cat > "$SCRIPT_DIR/run-ai-analyze.sh" << 'EOL'
#!/bin/bash

# This script runs the AI-enabled script analysis pipeline

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLI_DIST="$MONO_ROOT/packages/cli/dist"
SCAN_OUTPUT="$MONO_ROOT/script-scan-results.json"
ANALYSIS_DIR="$MONO_ROOT/ai-script-analysis-results"

# Create the analysis directory if it doesn't exist
mkdir -p "$ANALYSIS_DIR"

# Load environment variables from .env.development if available
ENV_FILE="$SCRIPT_DIR/.env.development"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE"
  export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY "$ENV_FILE" | cut -d '=' -f2-)
  export ANTHROPIC_API_KEY=$(grep VITE_ANTHROPIC_API_KEY "$ENV_FILE" | cut -d '=' -f2-)
  echo "SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY loaded from .env.development"
fi

# Make sure Claude API key is set
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$VITE_ANTHROPIC_API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY not set. Please set it in .env.development"
  exit 1
fi

# Check if CLI dist exists
if [ ! -d "$CLI_DIST" ]; then
  echo "Error: CLI dist directory doesn't exist."
  echo "Please run the fix-permissions.sh, fix-batch-analyze.sh, and fix-ai-integration.sh scripts first."
  exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting AI Script Analysis Pipeline${NC}"
echo "-----------------------------------"

# Step 1: Scan for script files
echo -e "${YELLOW}Step 1: Scanning for script files...${NC}"
cd "$MONO_ROOT" && \
node "$CLI_DIST/index.js" scan-scripts \
  --dir "$MONO_ROOT" \
  --extensions "sh" \
  --exclude "node_modules,dist,build,.git,coverage" \
  --output "$SCAN_OUTPUT" \
  --verbose

if [ $? -ne 0 ]; then
  echo -e "${RED}Error scanning script files${NC}"
  exit 1
fi

echo -e "${GREEN}Successfully scanned script files. Results saved to:${NC} $SCAN_OUTPUT"
echo "-----------------------------------"

# Step 2: Analyze script files with AI
echo -e "${YELLOW}Step 2: Analyzing script files with Claude AI...${NC}"
cd "$MONO_ROOT" && \
node "$CLI_DIST/index.js" batch-analyze-scripts \
  --input "$SCAN_OUTPUT" \
  --output-dir "$ANALYSIS_DIR" \
  --extensions "sh" \
  --max-scripts 5 \
  --use-ai \
  --verbose

if [ $? -ne 0 ]; then
  echo -e "${RED}Error analyzing script files${NC}"
  exit 1
fi

echo -e "${GREEN}Successfully analyzed script files with AI. Results saved to:${NC} $ANALYSIS_DIR"
echo "-----------------------------------"

# Step 3: Summary
echo -e "${YELLOW}AI Script Analysis Pipeline completed successfully${NC}"
echo "Summary report available at: $ANALYSIS_DIR/script-analysis-report.md"
echo "Category summary available at: $ANALYSIS_DIR/category-summary.md"

# Display a preview of the category summary if available
if [ -f "$ANALYSIS_DIR/category-summary.md" ]; then
  echo -e "${GREEN}Category Summary Preview:${NC}"
  echo "-----------------------------------"
  head -n 20 "$ANALYSIS_DIR/category-summary.md"
  echo "..."
fi

echo -e "${GREEN}Done!${NC}"
exit 0
EOL

chmod +x "$SCRIPT_DIR/run-ai-analyze.sh"

echo "AI integration completed. You can now run the AI-enabled script analysis with:"
echo "./run-ai-analyze.sh"