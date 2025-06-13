/**
 * Script Pipeline Service
 * 
 * Provides a unified service for interacting with script pipeline functionality.
 * This service replaces the previous script-pipeline-main.sh and script-manager.sh scripts.
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { nodeLogger as logger } from '@shared/services/logger/logger-node';
import { DatabaseService } from './database-service';
import { claudeService } from '@shared/services/claude-service';
import { EnvironmentService } from './environment-service';

/**
 * Script Pipeline Service implementation
 */
export class ScriptPipelineService {
  private static instance: ScriptPipelineService;
  private rootDir: string;
  private reportsDir: string;
  private dbService: DatabaseService;
  // Using the shared claude service singleton
  private envService: EnvironmentService;
  
  /**
   * Create a new script pipeline service
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Get the absolute path to the project root - we seem to be going up too many directories
    // Try multiple path calculation methods to find the correct root
    
    const path1 = path.resolve(__dirname, '../../../../../');
    const path2 = path.resolve(__dirname, '../../../../');
    const path3 = path.resolve(__dirname, '../../../');
    
    // Log all possible paths for debugging
    console.log('Possible root paths:');
    console.log(` - Path 1 (5 levels up): ${path1}`);
    console.log(` - Path 2 (4 levels up): ${path2}`);
    console.log(` - Path 3 (3 levels up): ${path3}`);
    
    // Check which path contains the prompts directory
    if (fs.existsSync(path.join(path1, 'prompts'))) {
      this.rootDir = path1;
      console.log(`Using path1 as root: ${this.rootDir}`);
    } else if (fs.existsSync(path.join(path2, 'prompts'))) {
      this.rootDir = path2;
      console.log(`Using path2 as root: ${this.rootDir}`);
    } else if (fs.existsSync(path.join(path3, 'prompts'))) {
      this.rootDir = path3;
      console.log(`Using path3 as root: ${this.rootDir}`);
    } else {
      // Fall back to the original calculation
      this.rootDir = process.env.ROOT_DIR || path.resolve(__dirname, '../../../../../');
      console.log(`Falling back to default path: ${this.rootDir}`);
    }
    
    this.reportsDir = path.join(this.rootDir, 'reports');
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
    
    // Initialize services
    this.dbService = DatabaseService.getInstance();
    this.envService = EnvironmentService.getInstance();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): ScriptPipelineService {
    if (!ScriptPipelineService.instance) {
      ScriptPipelineService.instance = new ScriptPipelineService();
    }
    return ScriptPipelineService.instance;
  }
  
  /**
   * Execute a shell script with the current environment
   */
  private async executeScript(scriptPath: string, args: string[] = []): Promise<number> {
    return new Promise((resolve, reject) => {      
      logger.info(`Executing script: ${scriptPath} with args: ${args.join(' ')}`);
      
      // Prepare environment variables
      const env = {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
        SUPABASE_URL: this.envService.getSupabaseUrl(),
        SUPABASE_SERVICE_ROLE_KEY: this.envService.getSupabaseKey(),
        SUPABASE_KEY: this.envService.getSupabaseKey(),
        CLAUDE_API_KEY: this.envService.getClaudeApiKey(),
        ANTHROPIC_API_KEY: this.envService.getClaudeApiKey(),
      };
      
      // Spawn script process
      const child = spawn('bash', [scriptPath, ...args], {
        env,
        cwd: this.rootDir,
      });
      
      // Capture output for console
      child.stdout.on('data', (data) => {
        process.stdout.write(data);
      });
      
      child.stderr.on('data', (data) => {
        process.stderr.write(data);
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          logger.info(`Script execution completed successfully`);
          resolve(0);
        } else {
          logger.error(`Script execution failed with code ${code}`);
          resolve(code || 1);
        }
      });
      
      child.on('error', (err) => {
        logger.error(`Failed to execute script: ${err.message}`);
        reject(err);
      });
    });
  }
  
  /**
   * Synchronize database with script files on disk
   */
  public async syncScripts(): Promise<number> {
    logger.info('Starting script sync operation');
    
    try {
      // Connect to Supabase if not already connected
      await this.dbService.ensureConnection();
      
      // Find all script files on disk
      logger.info('Finding all script files on disk...');
      const scriptFiles = await this.findScriptFilesOnDisk();
      logger.info(`Found ${scriptFiles.length} script files on disk`);
      
      // Call find_and_sync_scripts function with the list of files
      logger.info('Syncing database with files on disk...');
      
      // Make sure we verify that the database function exists with the correct parameter type
      logger.info('Checking database function...');
      
      try {
        // First try the function call directly with the file array
        const { data, error } = await this.dbService.executeRpc<any>(
          'find_and_sync_scripts', 
          scriptFiles
        );
        
        if (error) {
          // If it fails, try with the named parameter
          logger.warn(`Direct function call failed: ${error.message}. Trying with named parameter.`);
          const { data: namedData, error: namedError } = await this.dbService.executeRpc<any>(
            'find_and_sync_scripts', 
            { existing_files_json: scriptFiles }
          );
          
          if (namedError) {
            logger.error(`Error syncing scripts with named parameter: ${namedError.message}`);
            return 1;
          }
          
          if (namedData) {
            logger.info(`Sync results (named parameter): ${JSON.stringify(namedData)}`);
            if (namedData.new_scripts > 0) {
              logger.info(`Added ${namedData.new_scripts} new script records`);
            }
            if (namedData.deleted_scripts > 0) {
              logger.info(`Removed ${namedData.deleted_scripts} script records for files that no longer exist`);
            }
          }
        } else if (data) {
          logger.info(`Sync results (direct parameter): ${JSON.stringify(data)}`);
          if (data.new_scripts > 0) {
            logger.info(`Added ${data.new_scripts} new script records`);
          }
          if (data.deleted_scripts > 0) {
            logger.info(`Removed ${data.deleted_scripts} script records for files that no longer exist`);
          }
        }
      } catch (funcError: any) {
        logger.error(`Error calling database function: ${funcError.message}`);
        
        // Fallback to direct database operations if the function call fails
        logger.info('Falling back to direct database operations...');
        
        // Delete scripts that no longer exist on disk
        const { data: deleteData, error: deleteError } = await this.dbService.executeQuery<any>(async () => {
          return this.dbService.getClient()
            .from('scripts')
            .delete()
            .not('file_path', 'in', scriptFiles)
            .select();
        });
        
        if (deleteError) {
          logger.error(`Error deleting scripts: ${deleteError.message}`);
        } else if (deleteData) {
          logger.info(`Removed ${deleteData.length} script records for files that no longer exist`);
        }
        
        // Insert new scripts
        let newScriptCount = 0;
        
        // Process in batches of 50 to avoid potential issues with large arrays
        const batchSize = 50;
        for (let i = 0; i < scriptFiles.length; i += batchSize) {
          const batch = scriptFiles.slice(i, i + batchSize);
          
          // For each file, check if it exists in the database
          for (const filePath of batch) {
            const { data: exists } = await this.dbService.executeQuery<any>(async () => {
              return this.dbService.getClient()
                .from('scripts')
                .select('id')
                .eq('file_path', filePath)
                .limit(1);
            });
            
            if (!exists || exists.length === 0) {
              // File doesn't exist in database, insert it
              const fileExt = filePath.split('.').pop()?.toLowerCase() || 'unknown';
              const language = 
                fileExt === 'sh' ? 'bash' :
                fileExt === 'js' ? 'javascript' :
                fileExt === 'ts' ? 'typescript' :
                fileExt === 'py' ? 'python' :
                fileExt === 'rb' ? 'ruby' :
                fileExt === 'sql' ? 'sql' :
                'unknown';
              
              const fileName = filePath.split('/').pop() || filePath;
              const title = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
              
              const { error: insertError } = await this.dbService.executeQuery<any>(async () => {
                return this.dbService.getClient()
                  .from('scripts')
                  .insert({
                    file_path: filePath,
                    title,
                    language,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    last_modified_at: new Date().toISOString(),
                    metadata: { source: 'cli_sync', sync_date: new Date().toISOString() }
                  });
              });
              
              if (insertError) {
                logger.error(`Error inserting script ${filePath}: ${insertError.message}`);
              } else {
                newScriptCount++;
              }
            }
          }
        }
        
        logger.info(`Added ${newScriptCount} new script records`);
      }
      
      logger.info(`Script synchronization completed successfully.`);
      
      // Show the recent scripts to demonstrate that the database connection works
      const { data: recentScripts } = await this.dbService.query(
        'scripts',
        {
          select: 'id, file_path, title',
          order: {
            column: 'updated_at',
            ascending: false
          },
          limit: 5
        }
      );
      
      if (recentScripts && recentScripts.length > 0) {
        logger.info(`Most recent scripts in database:`);
        recentScripts.forEach((script: any, index: number) => {
          logger.info(`${index + 1}. ${script.file_path}`);
        });
      }
      
      // Get the total count of scripts in the database
      const { count: scriptCount } = await this.dbService.countRecords('scripts');
      logger.info(`Total script records in database: ${scriptCount || 'unknown'}`);
      
      return 0;
    } catch (error: any) {
      logger.error('Error during script sync', error);
      return 1;
    }
  }
  
  /**
   * Find all script files on disk
   * This implementation specifically targets only the cli-pipeline directory and 
   * is carefully designed to exclude node_modules and archived scripts
   */
  private async findScriptFilesOnDisk(): Promise<string[]> {
    const scriptFiles: string[] = [];
    
    // Fix the root path - the environment variables are giving us the wrong path
    // Hard-code the correct path
    const rootPath = '/Users/raybunnage/Documents/github/dhg-mono';
    const cliPipelinePath = path.join(rootPath, 'scripts', 'cli-pipeline');
    
    logger.info(`Corrected root path: ${rootPath}`);
    logger.info(`CLI pipeline path: ${cliPipelinePath}`);
    
    // Define script extensions to look for
    const scriptExtensions = ['.sh', '.js', '.ts'];
    
    // Use a direct approach with find command to get the script files
    try {
      // Get the actual script files using bash command to avoid node_modules
      const execSync = require('child_process').execSync;
      const cmd = `find "${cliPipelinePath}" -type f \\( -name "*.sh" -o -name "*.js" -o -name "*.ts" \\) | grep -v "node_modules" | grep -v "\\.archived" | grep -v "\\.backup" | grep -v "\\.test\\." | grep -v "\\.spec\\." | grep -v "\\.min\\."`;
      
      const result = execSync(cmd, { encoding: 'utf8' });
      const filePaths = result.split('\n').filter(Boolean);
      
      // Convert the absolute paths to relative paths from the project root
      for (const filePath of filePaths) {
        // The prefix to remove is the full rootPath
        if (filePath.startsWith(rootPath)) {
          const relativePath = filePath.substring(rootPath.length + 1); // +1 for the slash
          scriptFiles.push(relativePath);
        }
      }
      
      logger.info(`Found ${scriptFiles.length} script files using direct find command`);
      return scriptFiles;
    } catch (error: any) {
      logger.error(`Error using direct find command: ${error.message}`);
      
      // Fallback to the original implementation with more aggressive exclusions
      // Default list of directories to exclude
      const excludeDirs = [
        'node_modules',
        '.git',
        '.archived_scripts',
        '.archive_scripts',
        '.backup_scripts',
        '.vscode',
        'dist',
        'build',
        'temp',
        'tmp'
      ];
      
      // Function to check if a path contains any of the excluded directories
      const containsExcludedDir = (pathToCheck: string): boolean => {
        return excludeDirs.some(dir => pathToCheck.includes(`/${dir}/`));
      };
      
      // Recursive function with stronger exclusion logic
      const traverseDirectory = (dirPath: string, relativePath: string) => {
        // Skip this directory if it's in the excluded list or contains any excluded dir
        const dirName = path.basename(dirPath);
        if (excludeDirs.includes(dirName) || containsExcludedDir(dirPath)) {
          return;
        }
        
        try {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            // Full path to the entry
            const entryPath = path.join(dirPath, entry.name);
            // Relative path from cli-pipeline root
            const entryRelativePath = path.join(relativePath, entry.name);
            
            if (entry.isDirectory()) {
              // Skip node_modules and other excluded directories
              if (excludeDirs.includes(entry.name) || containsExcludedDir(entryPath)) {
                continue;
              }
              
              // Recursively traverse subdirectories
              traverseDirectory(entryPath, entryRelativePath);
            } else if (entry.isFile()) {
              // Check if file has a script extension
              const ext = path.extname(entry.name).toLowerCase();
              if (scriptExtensions.includes(ext)) {
                // Skip test and spec files
                if (entry.name.includes('.test.') || 
                    entry.name.includes('.spec.') || 
                    entry.name.includes('.min.') ||
                    entry.name.includes('.d.ts')) {
                  continue;
                }
                
                // Calculate relative path from the project root
                const fullRelativePath = path.join('scripts/cli-pipeline', relativePath, entry.name);
                scriptFiles.push(fullRelativePath);
              }
            }
          }
        } catch (error: any) {
          logger.warn(`Could not read directory ${dirPath}: ${error.message}`);
        }
      };
      
      // Start traversal only from the cli-pipeline directory
      if (fs.existsSync(cliPipelinePath)) {
        traverseDirectory(cliPipelinePath, '');
      } else {
        logger.warn(`CLI pipeline directory not found at ${cliPipelinePath}`);
      }
      
      logger.info(`Found ${scriptFiles.length} script files using fallback method`);
      return scriptFiles;
    }
  }
  
  /**
   * Find and insert new script files
   */
  public async findNewScripts(): Promise<number> {
    logger.info('Starting discovery of new script files');
    
    try {
      // This functionality is now fully implemented in syncScripts
      // This method exists for backward compatibility
      // Just call syncScripts which already handles finding new scripts
      return await this.syncScripts();
    } catch (error: any) {
      logger.error('Error during script discovery', error);
      return 1;
    }
  }
  
  /**
   * Show untyped script files
   */
  public async showUntypedScripts(): Promise<number> {
    logger.info('Retrieving untyped scripts');
    
    try {
      // Connect to Supabase if not already connected
      await this.dbService.ensureConnection();
      
      const { data, error } = await this.dbService.query(
        'scripts',
        {
          select: 'id, file_path, title, language, created_at, updated_at',
          filter: {
            script_type_id: 'is.null'
          },
          order: {
            column: 'updated_at',
            ascending: false
          },
          limit: 20
        }
      );
      
      if (error) {
        logger.error(`Error retrieving untyped scripts: ${error.message}`);
        return 1;
      }
      
      if (!data || data.length === 0) {
        console.log('No untyped scripts found');
        return 0;
      }
      
      console.log(`Found ${data.length} untyped scripts:`);
      console.log('-----------------------------------');
      
      data.forEach((script: any, index: number) => {
        console.log(`${index + 1}. ${script.file_path}`);
        console.log(`   - ID: ${script.id.substring(0, 8)}...`);
        console.log(`   - Title: ${script.title || 'Untitled'}`);
        console.log(`   - Language: ${script.language || 'Unknown'}`);
        console.log(`   - Updated: ${new Date(script.updated_at).toLocaleString()}`);
        console.log('-----------------------------------');
      });
      
      return 0;
    } catch (error: any) {
      logger.error('Error showing untyped scripts', error);
      return 1;
    }
  }
  
  /**
   * Show recent script files
   */
  public async showRecentScripts(): Promise<number> {
    logger.info('Retrieving recent scripts');
    
    try {
      // Connect to Supabase if not already connected
      await this.dbService.ensureConnection();
      
      const { data, error } = await this.dbService.query(
        'scripts',
        {
          select: 'id, file_path, title, language, script_type_id, created_at, updated_at',
          order: {
            column: 'updated_at',
            ascending: false
          },
          limit: 20
        }
      );
      
      if (error) {
        logger.error(`Error retrieving recent scripts: ${error.message}`);
        return 1;
      }
      
      if (!data || data.length === 0) {
        console.log('No scripts found');
        return 0;
      }
      
      // Get script types for better display
      const { data: scriptTypes } = await this.dbService.query(
        'script_types',
        {
          select: 'id, name'
        }
      );
      
      const scriptTypeMap = new Map();
      if (scriptTypes) {
        scriptTypes.forEach((type: any) => {
          scriptTypeMap.set(type.id, type.name);
        });
      }
      
      console.log(`Found ${data.length} recent scripts:`);
      console.log('-----------------------------------');
      
      data.forEach((script: any, index: number) => {
        const typeName = script.script_type_id 
          ? scriptTypeMap.get(script.script_type_id) || 'Unknown type'
          : 'No type';
          
        console.log(`${index + 1}. ${script.file_path}`);
        console.log(`   - ID: ${script.id.substring(0, 8)}...`);
        console.log(`   - Title: ${script.title || 'Untitled'}`);
        console.log(`   - Type: ${typeName}`);
        console.log(`   - Language: ${script.language || 'Unknown'}`);
        console.log(`   - Updated: ${new Date(script.updated_at).toLocaleString()}`);
        console.log('-----------------------------------');
      });
      
      return 0;
    } catch (error: any) {
      logger.error('Error showing recent scripts', error);
      return 1;
    }
  }
  
  /**
   * Classify recent script files using Claude
   */
  public async classifyRecentScripts(count: number = 20): Promise<number> {
    logger.info(`Starting classification of ${count} recent scripts`);
    
    // Verify Claude API key is available
    if (!this.envService.getClaudeApiKey()) {
      logger.error('No Claude API key found. Classification requires a valid Claude API key.');
      return 1;
    }
    
    try {
      // Connect to Supabase if not already connected
      await this.dbService.ensureConnection();
      
      // Get the script analysis prompt
      const fs = require('fs');
      const path = require('path');
      
      // Try to locate the script analysis prompt by searching in potential locations
      const potentialPromptPaths = [
        path.join(this.rootDir, 'prompts', 'script-analysis-prompt.md'),
        path.join(this.rootDir, 'dhg-mono', 'prompts', 'script-analysis-prompt.md'),
        path.resolve(__dirname, '../../../../..', 'prompts', 'script-analysis-prompt.md'),
        path.resolve(__dirname, '../../../../', 'prompts', 'script-analysis-prompt.md'),
        path.resolve(__dirname, '../../../', 'prompts', 'script-analysis-prompt.md'),
        // Use the environment's root dir if available
        process.env.ROOT_DIR ? path.join(process.env.ROOT_DIR, 'prompts', 'script-analysis-prompt.md') : null
      ].filter(Boolean); // Remove nulls
      
      let promptPath = null;
      
      // Try each potential path
      for (const potentialPath of potentialPromptPaths) {
        logger.info(`Looking for script analysis prompt at: ${potentialPath}`);
        if (fs.existsSync(potentialPath)) {
          logger.info(`Found prompt at: ${potentialPath}`);
          promptPath = potentialPath;
          break;
        }
      }
      
      // Run a direct search command as a last resort
      if (!promptPath) {
        try {
          logger.info('Running direct search for script-analysis-prompt.md');
          const { execSync } = require('child_process');
          const command = 'find "/Users/raybunnage/Documents/github" -type f -name "script-analysis-prompt.md" -not -path "*/node_modules/*" | head -n 1';
          const result = execSync(command, { encoding: 'utf8' }).trim();
          
          if (result) {
            logger.info(`Found prompt using search command: ${result}`);
            promptPath = result;
          }
        } catch (error: any) {
          logger.error(`Error searching for prompt file: ${error.message}`);
        }
      }
      
      if (!promptPath) {
        logger.error('Script analysis prompt not found in any of the tried locations');
        return 1;
      }
      
      const analysisPrompt = fs.readFileSync(promptPath, 'utf8');
      
      // Query for recent scripts
      const { data: recentScripts, error } = await this.dbService.query<{
        id: string;
        file_path: string;
        title: string;
        language: string;
        created_at: string;
        updated_at: string;
        script_type_id: string | null;
      }>(
        'scripts',
        {
          select: 'id, file_path, title, language, created_at, updated_at, script_type_id',
          order: {
            column: 'updated_at',
            ascending: false
          },
          limit: count
        }
      );
      
      if (error) {
        logger.error(`Error retrieving recent scripts: ${error.message}`);
        return 1;
      }
      
      if (!recentScripts || recentScripts.length === 0) {
        logger.info('No recent scripts found');
        return 0;
      }
      
      logger.info(`Found ${recentScripts.length} recent scripts to classify`);
      
      // Get document types from database for classification
      const { data: documentTypes, error: docTypeError } = await this.dbService.query<{
        id: string;
        name: string;
        description: string;
        parent_type_id: string | null;
        integration_status: string;
      }>(
        'document_types',
        {
          select: 'id, name, description, parent_type_id, integration_status'
        }
      );
      
      if (docTypeError) {
        logger.error(`Error retrieving document types: ${docTypeError.message}`);
        return 1;
      }
      
      if (!documentTypes || documentTypes.length === 0) {
        logger.error('No document types found in database for classification');
        return 1;
      }
      
      // Filter to get only script-related document types
      const scriptDocumentTypes = documentTypes.filter((docType) => 
        docType.name.toLowerCase().includes('script') || 
        (docType.description && docType.description.toLowerCase().includes('script'))
      );
      
      if (scriptDocumentTypes.length === 0) {
        logger.warn('No script-related document types found, using all document types');
      }
      
      // Process each script
      let processedCount = 0;
      let successCount = 0;
      
      for (const script of recentScripts) {
        try {
          logger.info(`Processing script: ${script.file_path}`);
          
          // Get the full path to the script file
          const scriptFullPath = path.join(this.rootDir, script.file_path);
          
          // Check if file exists
          if (!fs.existsSync(scriptFullPath)) {
            logger.warn(`Script file not found at: ${scriptFullPath}`);
            continue;
          }
          
          // Get file content
          const scriptContent = fs.readFileSync(scriptFullPath, 'utf8');
          
          // Get file metadata
          const stats = fs.statSync(scriptFullPath);
          const fileSize = stats.size;
          const createdAt = stats.birthtime;
          const modifiedAt = stats.mtime;
          
          // Check for package.json references
          const packageJsonReferences = await this.findPackageJsonReferences(script.file_path);
          
          // Prepare the prompt with context
          const analysisContext = `
# Script Analysis Request

## Script File Path
${script.file_path}

## Script Content
\`\`\`
${scriptContent}
\`\`\`

## File Metadata
- File Size: ${fileSize} bytes
- Created: ${createdAt.toISOString()}
- Last Modified: ${modifiedAt.toISOString()}

## Package.json References
${JSON.stringify(packageJsonReferences, null, 2)}

## Available Document Types for Classification
${JSON.stringify(scriptDocumentTypes.length > 0 ? scriptDocumentTypes : documentTypes, null, 2)}

Please analyze this script and provide a full assessment according to the instructions.
`;

          // Combined prompt
          const fullPrompt = `${analysisPrompt}\n\n${analysisContext}`;
          
          // Call Claude API with optimized settings
          const options = {
            model: 'claude-3-7-sonnet-20250219',
            temperature: 0.2,
            maxTokens: 4000
          };
          
          logger.info(`Submitting script for classification: ${script.file_path}`);
          
          const classificationResult = await this.claudeService.getJsonResponse<{
            script_type_id: string;
            ai_generated_tags: string[];
            title: string;
            summary: any;
            ai_assessment: any;
            assessment_quality_score: number;
            id?: string;
            created_at?: string;
            file_path?: string;
          }>(fullPrompt, options);
          
          if (!classificationResult || !classificationResult.script_type_id) {
            logger.warn(`Invalid classification result for script: ${script.file_path}`);
            continue;
          }
          
          // Remove any fields that shouldn't be updated
          delete classificationResult.id;
          delete classificationResult.created_at;
          delete classificationResult.file_path;
          
          // Update script record in database
          const { error: updateError } = await this.dbService.update(
            'scripts',
            script.id,
            {
              script_type_id: classificationResult.script_type_id,
              ai_generated_tags: classificationResult.ai_generated_tags,
              title: classificationResult.title,
              summary: classificationResult.summary,
              ai_assessment: classificationResult.ai_assessment,
              assessment_quality_score: classificationResult.assessment_quality_score,
              assessment_created_at: new Date().toISOString(),
              assessment_updated_at: new Date().toISOString(),
              assessment_model: "Claude 3.7 Sonnet"
            }
          );
          
          if (updateError) {
            logger.error(`Error updating script record: ${updateError.message}`);
            continue;
          }
          
          logger.info(`Successfully classified script: ${script.file_path} as type: ${classificationResult.script_type_id}`);
          successCount++;
          
        } catch (scriptError: any) {
          logger.error(`Error processing script ${script.file_path}: ${scriptError.message}`);
        }
        
        processedCount++;
      }
      
      logger.info(`Classification complete. Processed ${processedCount} scripts, ${successCount} successfully classified.`);
      
      return processedCount > 0 && successCount > 0 ? 0 : 1;
    } catch (error: any) {
      logger.error('Error during script classification', error);
      return 1;
    }
  }
  
  /**
   * Classify untyped script files using Claude
   */
  public async classifyUntypedScripts(count: number = 10): Promise<number> {
    logger.info(`Starting classification of ${count} untyped scripts`);
    
    // Verify Claude API key is available
    if (!this.envService.getClaudeApiKey()) {
      logger.error('No Claude API key found. Classification requires a valid Claude API key.');
      return 1;
    }
    
    try {
      // Connect to Supabase if not already connected
      await this.dbService.ensureConnection();
      
      // Get the script analysis prompt
      const fs = require('fs');
      const path = require('path');
      
      // Try to locate the script analysis prompt by searching in potential locations
      const potentialPromptPaths = [
        path.join(this.rootDir, 'prompts', 'script-analysis-prompt.md'),
        path.join(this.rootDir, 'dhg-mono', 'prompts', 'script-analysis-prompt.md'),
        path.resolve(__dirname, '../../../../..', 'prompts', 'script-analysis-prompt.md'),
        path.resolve(__dirname, '../../../../', 'prompts', 'script-analysis-prompt.md'),
        path.resolve(__dirname, '../../../', 'prompts', 'script-analysis-prompt.md'),
        // Use the environment's root dir if available
        process.env.ROOT_DIR ? path.join(process.env.ROOT_DIR, 'prompts', 'script-analysis-prompt.md') : null
      ].filter(Boolean); // Remove nulls
      
      let promptPath = null;
      
      // Try each potential path
      for (const potentialPath of potentialPromptPaths) {
        logger.info(`Looking for script analysis prompt at: ${potentialPath}`);
        if (fs.existsSync(potentialPath)) {
          logger.info(`Found prompt at: ${potentialPath}`);
          promptPath = potentialPath;
          break;
        }
      }
      
      // Run a direct search command as a last resort
      if (!promptPath) {
        try {
          logger.info('Running direct search for script-analysis-prompt.md');
          const { execSync } = require('child_process');
          const command = 'find "/Users/raybunnage/Documents/github" -type f -name "script-analysis-prompt.md" -not -path "*/node_modules/*" | head -n 1';
          const result = execSync(command, { encoding: 'utf8' }).trim();
          
          if (result) {
            logger.info(`Found prompt using search command: ${result}`);
            promptPath = result;
          }
        } catch (error: any) {
          logger.error(`Error searching for prompt file: ${error.message}`);
        }
      }
      
      if (!promptPath) {
        logger.error('Script analysis prompt not found in any of the tried locations');
        return 1;
      }
      
      const analysisPrompt = fs.readFileSync(promptPath, 'utf8');
      
      // Query for untyped scripts
      const { data: untypedScripts, error } = await this.dbService.query<{
        id: string;
        file_path: string;
        title: string;
        language: string;
        created_at: string;
        updated_at: string;
      }>(
        'scripts',
        {
          select: 'id, file_path, title, language, created_at, updated_at',
          filter: {
            script_type_id: 'is.null'
          },
          order: {
            column: 'updated_at',
            ascending: false
          },
          limit: count
        }
      );
      
      if (error) {
        logger.error(`Error retrieving untyped scripts: ${error.message}`);
        return 1;
      }
      
      if (!untypedScripts || untypedScripts.length === 0) {
        logger.info('No untyped scripts found');
        return 0;
      }
      
      logger.info(`Found ${untypedScripts.length} untyped scripts to classify`);
      
      // Get document types from database for classification
      const { data: documentTypes, error: docTypeError } = await this.dbService.query<{
        id: string;
        name: string;
        description: string;
        parent_type_id: string | null;
        integration_status: string;
      }>(
        'document_types',
        {
          select: 'id, name, description, parent_type_id, integration_status'
        }
      );
      
      if (docTypeError) {
        logger.error(`Error retrieving document types: ${docTypeError.message}`);
        return 1;
      }
      
      if (!documentTypes || documentTypes.length === 0) {
        logger.error('No document types found in database for classification');
        return 1;
      }
      
      // Filter to get only script-related document types
      const scriptDocumentTypes = documentTypes.filter((docType) => 
        docType.name.toLowerCase().includes('script') || 
        (docType.description && docType.description.toLowerCase().includes('script'))
      );
      
      if (scriptDocumentTypes.length === 0) {
        logger.warn('No script-related document types found, using all document types');
      }
      
      // Process each untyped script
      let processedCount = 0;
      let successCount = 0;
      
      for (const script of untypedScripts) {
        try {
          logger.info(`Processing script: ${script.file_path}`);
          
          // Get the full path to the script file
          const scriptFullPath = path.join(this.rootDir, script.file_path);
          
          // Check if file exists
          if (!fs.existsSync(scriptFullPath)) {
            logger.warn(`Script file not found at: ${scriptFullPath}`);
            continue;
          }
          
          // Get file content
          const scriptContent = fs.readFileSync(scriptFullPath, 'utf8');
          
          // Get file metadata
          const stats = fs.statSync(scriptFullPath);
          const fileSize = stats.size;
          const createdAt = stats.birthtime;
          const modifiedAt = stats.mtime;
          
          // Check for package.json references
          const packageJsonReferences = await this.findPackageJsonReferences(script.file_path);
          
          // Prepare the prompt with context
          const analysisContext = `
# Script Analysis Request

## Script File Path
${script.file_path}

## Script Content
\`\`\`
${scriptContent}
\`\`\`

## File Metadata
- File Size: ${fileSize} bytes
- Created: ${createdAt.toISOString()}
- Last Modified: ${modifiedAt.toISOString()}

## Package.json References
${JSON.stringify(packageJsonReferences, null, 2)}

## Available Document Types for Classification
${JSON.stringify(scriptDocumentTypes.length > 0 ? scriptDocumentTypes : documentTypes, null, 2)}

Please analyze this script and provide a full assessment according to the instructions.
`;

          // Combined prompt
          const fullPrompt = `${analysisPrompt}\n\n${analysisContext}`;
          
          // Call Claude API with optimized settings
          const options = {
            model: 'claude-3-7-sonnet-20250219',
            temperature: 0.2,
            maxTokens: 4000
          };
          
          logger.info(`Submitting script for classification: ${script.file_path}`);
          
          const classificationResult = await this.claudeService.getJsonResponse<{
            script_type_id: string;
            ai_generated_tags: string[];
            title: string;
            summary: any;
            ai_assessment: any;
            assessment_quality_score: number;
            id?: string;
            created_at?: string;
            file_path?: string;
          }>(fullPrompt, options);
          
          if (!classificationResult || !classificationResult.script_type_id) {
            logger.warn(`Invalid classification result for script: ${script.file_path}`);
            continue;
          }
          
          // Remove any fields that shouldn't be updated
          delete classificationResult.id;
          delete classificationResult.created_at;
          delete classificationResult.file_path;
          
          // Update script record in database
          const { error: updateError } = await this.dbService.update(
            'scripts',
            script.id,
            {
              script_type_id: classificationResult.script_type_id,
              ai_generated_tags: classificationResult.ai_generated_tags,
              title: classificationResult.title,
              summary: classificationResult.summary,
              ai_assessment: classificationResult.ai_assessment,
              assessment_quality_score: classificationResult.assessment_quality_score,
              assessment_created_at: new Date().toISOString(),
              assessment_updated_at: new Date().toISOString(),
              assessment_model: "Claude 3.7 Sonnet"
            }
          );
          
          if (updateError) {
            logger.error(`Error updating script record: ${updateError.message}`);
            continue;
          }
          
          logger.info(`Successfully classified script: ${script.file_path} as type: ${classificationResult.script_type_id}`);
          successCount++;
          
        } catch (scriptError: any) {
          logger.error(`Error processing script ${script.file_path}: ${scriptError.message}`);
        }
        
        processedCount++;
      }
      
      logger.info(`Classification complete. Processed ${processedCount} scripts, ${successCount} successfully classified.`);
      
      return processedCount > 0 && successCount > 0 ? 0 : 1;
    } catch (error: any) {
      logger.error('Error during script classification', error);
      return 1;
    }
  }
  
  /**
   * Find package.json references for a script
   */
  private async findPackageJsonReferences(scriptPath: string): Promise<Array<{
    file: string;
    script_key: string;
    command: string;
  }>> {
    try {
      const path = require('path');
      const fs = require('fs');
      const execSync = require('child_process').execSync;
      
      // Extract filename for matching
      const scriptName = path.basename(scriptPath);
      const references: Array<{
        file: string;
        script_key: string;
        command: string;
      }> = [];
      
      // Find all package.json files
      const cmd = `find "${this.rootDir}" -name "package.json" | grep -v "node_modules"`;
      const result = execSync(cmd, { encoding: 'utf8' });
      const packageJsonPaths = result.split('\n').filter(Boolean);
      
      for (const packageJsonPath of packageJsonPaths) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          
          if (packageJson.scripts) {
            for (const [scriptKey, command] of Object.entries(packageJson.scripts)) {
              // Check if command references this script
              const scriptCommand = command as string;
              if (scriptCommand.includes(scriptName)) {
                references.push({
                  file: packageJsonPath.substring(this.rootDir.length + 1),
                  script_key: scriptKey,
                  command: scriptCommand
                });
              }
            }
          }
        } catch (err) {
          // Continue with next package.json
          logger.debug(`Error parsing ${packageJsonPath}: ${err}`);
        }
      }
      
      return references;
    } catch (error) {
      logger.debug('Error finding package.json references', error);
      return [];
    }
  }
  
  /**
   * Generate a summary report of scripts
   * @param count Number of scripts to include in the report
   * @param includeDeleted Whether to include deleted scripts
   * @param writeToFile Whether to write the report to a file or just console output
   */
  public async generateSummary(count: number = 50, includeDeleted: boolean = false, writeToFile: boolean = false): Promise<number> {
    // Note: includeDeleted parameter is kept for backward compatibility but no longer used
    // since we now use hard deletes instead of soft deletes with is_deleted flag
    logger.info(`Generating summary report for ${count} scripts`);
    
    try {
      // Connect to Supabase if not already connected
      await this.dbService.ensureConnection();
      
      // Query scripts from the database
      let query: any = {
        select: `
          id,
          file_path,
          title,
          language,
          summary,
          ai_generated_tags,
          manual_tags,
          script_type_id,
          document_type_id,
          created_at,
          updated_at,
          last_modified_at,
          ai_assessment,
          assessment_quality_score
        `,
        order: {
          column: 'updated_at',
          ascending: false
        }
      };
      
      // Apply limit if not all
      if (count !== -1) {
        query.limit = count;
      }
      
      const { data: scripts, error } = await this.dbService.query('scripts', query);
      
      if (error) {
        logger.error(`Error querying scripts: ${error.message}`);
        return 1;
      }
      
      if (!scripts || scripts.length === 0) {
        logger.info('No scripts found in the database');
        return 0;
      }
      
      // Get script types
      const { data: scriptTypes } = await this.dbService.query(
        'script_types',
        {
          select: 'id, name, description'
        }
      );
      
      const scriptTypeMap = new Map();
      if (scriptTypes) {
        scriptTypes.forEach((type: any) => {
          scriptTypeMap.set(type.id, type);
        });
      }
      
      // Generate the report content
      let report = this.generateReportContent(scripts, scriptTypeMap);
      
      // Either write to file or console based on preference
      if (writeToFile) {
        const reportFile = path.join(this.reportsDir, `script-summary-${new Date().toISOString().split('T')[0]}.md`);
        fs.writeFileSync(reportFile, report);
        logger.info(`Report generated successfully at: ${reportFile}`);
      } else {
        // Output to console
        console.log(report);
        logger.info(`Report generated successfully to console`);
      }
      
      return 0;
    } catch (error: any) {
      logger.error('Error generating script summary', error);
      return 1;
    }
  }
  
  /**
   * Helper to generate report content
   */
  private generateReportContent(scripts: any[], scriptTypeMap: Map<string, any>): string {
    // Categorize scripts
    const categorizedScripts: Record<string, any[]> = {
      'AI': [],
      'Integration': [],
      'Operations': [],
      'Development': []
    };
    
    // Count script types
    const scriptTypeCounts: Record<string, number> = {};
    
    // Process each script
    scripts.forEach(script => {
      // Categorize the script
      const category = this.categorizeScript(script);
      categorizedScripts[category].push(script);
      
      // Count script types
      if (script.script_type_id) {
        scriptTypeCounts[script.script_type_id] = (scriptTypeCounts[script.script_type_id] || 0) + 1;
      }
    });
    
    // Start building the report
    let report = `# Script Analysis Summary Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Scripts: ${scripts.length}\n\n`;
    
    // Summary statistics
    report += `## Summary Statistics\n\n`;
    report += `| Category | Count | Percentage |\n`;
    report += `| --- | --- | --- |\n`;
    
    for (const [category, categoryScripts] of Object.entries(categorizedScripts)) {
      const percentage = ((categoryScripts.length / scripts.length) * 100).toFixed(1);
      report += `| ${category} | ${categoryScripts.length} | ${percentage}% |\n`;
    }
    
    report += `\n`;
    
    // Show script type distribution
    if (Object.keys(scriptTypeCounts).length > 0) {
      report += `### Script Type Distribution\n\n`;
      report += `| Script Type | Count |\n`;
      report += `| --- | --- |\n`;
      
      for (const [typeId, count] of Object.entries(scriptTypeCounts)) {
        const typeName = scriptTypeMap.get(typeId)?.name || 'Unknown';
        report += `| ${typeName} | ${count} |\n`;
      }
      
      report += `\n`;
    }
    
    // Add file path status overview
    report += `## File Path Status Overview\n\n`;
    report += `| ID | File Path | Category | Last Updated |\n`;
    report += `| --- | --- | --- | --- |\n`;
    
    scripts.slice(0, 20).forEach(script => {
      const updatedAt = script.updated_at 
        ? new Date(script.updated_at).toISOString().split('T')[0] 
        : 'N/A';
      const category = this.categorizeScript(script);
      report += `| ${script.id.substring(0, 8)}... | \`${script.file_path}\` | ${category} | ${updatedAt} |\n`;
    });
    
    if (scripts.length > 20) {
      report += `| ... | ... | ... | ... |\n`;
    }
    
    report += `\n\n`;
    
    // Generate detailed sections by category
    for (const [category, categoryScripts] of Object.entries(categorizedScripts)) {
      if (categoryScripts.length === 0) continue;
      
      report += `## ${category} Scripts (${categoryScripts.length})\n\n`;
      
      // Add category description
      switch (category) {
        case 'AI':
          report += `Scripts related to AI/ML models, prompts, and configurations.\n\n`;
          break;
        case 'Integration':
          report += `Scripts for external system integrations.\n\n`;
          break;
        case 'Operations':
          report += `Scripts for operational tasks and infrastructure.\n\n`;
          break;
        case 'Development':
          report += `Scripts for development tools and processes.\n\n`;
          break;
      }
      
      // Sort scripts by updated date
      categoryScripts.sort((a, b) => {
        const dateA = new Date(a.updated_at || 0);
        const dateB = new Date(b.updated_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Add script details
      for (const script of categoryScripts) {
        const typeName = script.script_type_id ? 
          (scriptTypeMap.get(script.script_type_id)?.name || 'Unknown Type') : 
          'No Type';
        
        const quality = this.assessScriptQuality(script);
        
        report += `### ${script.title || path.basename(script.file_path)}\n`;
        report += `- **File Path**: \`${script.file_path}\`\n`;
        report += `- **Type**: ${typeName}\n`;
        report += `- **Language**: ${script.language || 'Unknown'}\n`;
        
        // Tags section
        const allTags = [
          ...(script.ai_generated_tags || []),
          ...(script.manual_tags || [])
        ];
        
        if (allTags.length > 0) {
          report += `- **Tags**: ${allTags.join(', ')}\n`;
        }
        
        // Summary section
        if (script.summary) {
          report += `- **Summary**:\n`;
          
          if (typeof script.summary === 'object') {
            if (script.summary.description) {
              report += `  - Description: ${script.summary.description}\n`;
            }
            if (script.summary.purpose) {
              report += `  - Purpose: ${script.summary.purpose}\n`;
            }
            if (script.summary.key_functions && script.summary.key_functions.length > 0) {
              report += `  - Key Functions: ${script.summary.key_functions.join(', ')}\n`;
            }
          } else if (typeof script.summary === 'string') {
            report += `  ${script.summary}\n`;
          }
        }
        
        // Assessment section
        report += `- **Quality Assessment**:\n`;
        report += `  - Code Quality: ${quality.code_quality}\n`;
        report += `  - Maintainability: ${quality.maintainability}\n`;
        report += `  - Utility: ${quality.utility}\n`;
        report += `  - Documentation: ${quality.documentation}\n`;
        
        // Dates
        report += `- **Created**: ${new Date(script.created_at).toISOString()}\n`;
        report += `- **Updated**: ${new Date(script.updated_at).toISOString()}\n`;
        
        report += `\n`;
      }
    }
    
    return report;
  }
  
  /**
   * Assess script quality
   */
  private assessScriptQuality(script: any): any {
    const hasAssessment = script.ai_assessment && typeof script.ai_assessment === 'object';
    
    // If we have AI assessment, use it
    if (hasAssessment) {
      return {
        code_quality: script.ai_assessment.code_quality || 'Unknown',
        maintainability: script.ai_assessment.maintainability || 'Unknown',
        utility: script.ai_assessment.utility || 'Unknown',
        documentation: script.ai_assessment.documentation || 'Unknown'
      };
    }
    
    // Otherwise use simple heuristics
    return {
      code_quality: 'Not analyzed',
      maintainability: 'Not analyzed',
      utility: 'Not analyzed',
      documentation: 'Not analyzed'
    };
  }
  
  /**
   * Categorize a script
   */
  private categorizeScript(script: any): string {
    // Default to 'Development' if no category is found
    let category = 'Development';
    
    const tags = script.ai_generated_tags || [];
    const summary = script.summary || {};
    const title = script.title || '';
    const filePath = script.file_path || '';
    
    // Check for AI related scripts
    if (
      tags.some((tag: string) => /ai|claude|openai|gpt|llm|ml|model|prompt/i.test(tag)) ||
      filePath.includes('prompts') ||
      (summary && typeof summary === 'object' && summary.description && 
       /ai|claude|openai|gpt|llm|ml|model|prompt/i.test(summary.description))
    ) {
      category = 'AI';
    }
    // Check for Integration related scripts
    else if (
      tags.some((tag: string) => /api|integration|connect|external|supabase|database|google/i.test(tag)) ||
      filePath.includes('integration') ||
      (summary && typeof summary === 'object' && summary.description && 
       /api|integration|connect|external|supabase|database|google/i.test(summary.description))
    ) {
      category = 'Integration';
    }
    // Check for Operations related scripts
    else if (
      tags.some((tag: string) => /deploy|build|ci|cd|pipeline|release|backup|setup|config/i.test(tag)) ||
      filePath.includes('deploy') || filePath.includes('setup') || filePath.includes('config') ||
      (summary && typeof summary === 'object' && summary.description && 
       /deploy|build|ci|cd|pipeline|release|backup|setup|config/i.test(summary.description))
    ) {
      category = 'Operations';
    }
    
    return category;
  }
  
  /**
   * Run the complete pipeline
   */
  public async runCompletePipeline(): Promise<number> {
    logger.info('Running complete script pipeline');
    
    try {
      // Verify required environment variables
      if (!this.envService.getSupabaseUrl() || !this.envService.getSupabaseKey()) {
        logger.error('Missing Supabase credentials. Pipeline requires valid Supabase connection.');
        return 1;
      }
      
      if (!this.envService.getClaudeApiKey()) {
        logger.warn('No Claude API key found. Classification steps may fail.');
      }
      
      // Run pipeline steps
      let success = true;
      
      // Step 1: Sync scripts
      const syncResult = await this.syncScripts();
      if (syncResult !== 0) {
        logger.warn('Script sync step failed');
        success = false;
      }
      
      // Step 2: Find new scripts
      const findResult = await this.findNewScripts();
      if (findResult !== 0) {
        logger.warn('Find new scripts step failed');
        success = false;
      }
      
      // Step 3: Classify recent scripts (max 5 for performance)
      if (this.envService.getClaudeApiKey()) {
        const classifyResult = await this.classifyRecentScripts(5);
        if (classifyResult !== 0) {
          logger.warn('Classification step failed');
          success = false;
        }
      } else {
        logger.warn('Skipping classification due to missing Claude API key');
      }
      
      if (success) {
        logger.info('Complete pipeline executed successfully');
        return 0;
      } else {
        logger.warn('Pipeline completed with some errors');
        return 1;
      }
    } catch (error: any) {
      logger.error('Error running complete pipeline', error);
      return 1;
    }
  }
}

// Export singleton instance
export const scriptPipelineService = ScriptPipelineService.getInstance();