import { FileService } from './file-service';
import { SupabaseClientService, getSupabaseClient, SupabaseClient } from './supabase-client';
import { PromptQueryService } from './prompt-query-service';
import { ClaudeService } from './claude-service';
import { createHash } from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { Logger } from '../utils/logger';
import config from '../utils/config';
import {
  Script, 
  ScriptFile, 
  ClassificationResult,
  SummaryOptions
} from '../types/script-types';

export class ScriptManagementService {
  private fileService: FileService;
  private promptQueryService: PromptQueryService;
  private claudeService: ClaudeService;
  private supabase: SupabaseClient;
  private readonly scriptExtensions = ['.sh', '.js'];
  private readonly excludeDirs = [
    'node_modules', 
    '.git', 
    'dist', 
    'build', 
    '_archive', 
    'script-analysis-results', 
    'file_types',
    'backup',
    '.backups',
    'registry_archives'
  ];
  private rootDir: string;
  
  constructor() {
    this.fileService = new FileService();
    
    // Get Supabase client using singleton service
    const supabaseService = SupabaseClientService.getInstance();
    if (!supabaseService.isInitialized()) {
      // Initialize with values from config
      Logger.info('Initializing Supabase client from config...');
      this.supabase = supabaseService.initialize(config.supabaseUrl, config.supabaseKey);
    } else {
      Logger.info('Using existing Supabase client instance');
      this.supabase = supabaseService.getClient(false);
    }
    
    // Initialize prompt service with Supabase URL and key from config
    this.promptQueryService = new PromptQueryService({
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey
    });
    
    // Initialize Claude service with API key from config
    this.claudeService = new ClaudeService(config.anthropicApiKey);
    
    // Store root directory for path conversions
    this.rootDir = process.cwd();
    Logger.debug(`Root directory: ${this.rootDir}`);
  }
  
  /**
   * Converts a relative path to absolute path
   * @param filePath - Path to convert
   * @returns Absolute path
   */
  private toAbsolutePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.join(this.rootDir, filePath);
  }
  
  /**
   * Converts an absolute path to a project-relative path
   * @param absolutePath - Absolute path to convert
   * @returns Project-relative path
   */
  private toRelativePath(absolutePath: string): string {
    return path.isAbsolute(absolutePath) ? path.relative(this.rootDir, absolutePath) : absolutePath;
  }
  
  /**
   * Discovers script files in the given directory
   * @param rootDir - Root directory to scan
   * @returns Array of discovered script files
   */
  async discoverScripts(scanDir: string): Promise<ScriptFile[]> {
    const absoluteScanDir = this.toAbsolutePath(scanDir);
    Logger.info(`Discovering scripts in ${absoluteScanDir}...`);
    
    try {
      const scripts: ScriptFile[] = [];
      
      // Use file service to scan directories
      const scriptPaths = await this.fileService.findFiles({
        directory: absoluteScanDir,
        includePatterns: this.scriptExtensions.map(ext => `**/*${ext}`),
        excludePatterns: this.excludeDirs.map(dir => `**/${dir}/**`),
        recursive: true
      });
      
      // Process each discovered script file
      for (const scriptPath of scriptPaths) {
        try {
          const stats = await fs.stat(scriptPath);
          const fileContent = await this.fileService.readFile(scriptPath);
          
          if (!fileContent.success) {
            Logger.warn(`Failed to read script file: ${scriptPath}`);
            continue;
          }
          
          const hash = this.generateHash(fileContent.content || '');
          
          // Always store project-relative paths in the database
          const relativePath = this.toRelativePath(scriptPath);
          
          scripts.push({
            file_path: relativePath,
            title: path.basename(scriptPath),
            language: path.extname(scriptPath) === '.sh' ? 'bash' : 'javascript',
            last_modified_at: stats.mtime.toISOString(),
            file_hash: hash
          });
        } catch (fileError) {
          Logger.error(`Error processing file ${scriptPath}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
        }
      }
      
      Logger.info(`Discovered ${scripts.length} script files`);
      return scripts;
    } catch (error) {
      Logger.error(`Error discovering scripts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to discover scripts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Generates a hash for file content
   * @param content - File content
   * @returns MD5 hash of the content
   */
  private generateHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }
  
  /**
   * Synchronizes database with discovered script files
   * @param scripts - Discovered script files
   * @returns Result of the synchronization
   */
  async syncWithDatabase(scripts: ScriptFile[]): Promise<{
    added: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    Logger.info("Synchronizing scripts with database...");
    
    const result = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    };
    
    try {
      // Log the discovered scripts
      Logger.info(`Processing ${scripts.length} scripts found on disk:`);
      scripts.forEach((script, index) => {
        if (index < 5) { // Only log first 5 to avoid excessive logging
          Logger.debug(`  ${index + 1}. ${script.file_path}`);
        }
      });
      
      // Get existing scripts from database using class instance
      const { data: dbScripts, error } = await this.supabase
        .from('scripts')
        .select('id, file_path, file_hash');
      
      if (error) {
        Logger.error("Error fetching scripts from database:", error);
        throw new Error(`Failed to fetch scripts from database: ${error.message}`);
      }
      
      if (!dbScripts) {
        Logger.error("No scripts data returned from database");
        throw new Error("No scripts data returned from database");
      }
      
      Logger.info(`Found ${dbScripts.length} scripts in database`);
      
      // Normalize all paths to ensure consistent comparison
      // This ensures scripts will be found even if database has absolute paths
      const normalizedDbScripts = dbScripts.map(script => ({
        ...script,
        normalizedPath: this.normalizePath(script.file_path)
      }));
      
      const normalizedDiskScripts = scripts.map(script => ({
        ...script,
        normalizedPath: this.normalizePath(script.file_path)
      }));
      
      // Create maps and sets for efficient lookups
      const dbScriptMap = new Map(normalizedDbScripts.map(script => [script.normalizedPath, script]));
      const diskScriptPathSet = new Set(normalizedDiskScripts.map(script => script.normalizedPath));
      
      // Log some of the normalized paths for debugging
      Logger.debug("Normalized disk paths sample:");
      Array.from(diskScriptPathSet).slice(0, 3).forEach(path => {
        Logger.debug(`  - ${path}`);
      });
      
      // Delete scripts that no longer exist on disk
      const toDelete = normalizedDbScripts.filter(dbScript => 
        !diskScriptPathSet.has(dbScript.normalizedPath)
      );
      
      if (toDelete.length > 0) {
        Logger.info(`Deleting ${toDelete.length} scripts that no longer exist on disk...`);
        const { error: deleteError } = await this.supabase
          .from('scripts')
          .delete()
          .in('id', toDelete.map(script => script.id));
        
        if (deleteError) {
          Logger.error("Error deleting scripts:", deleteError);
          result.errors += toDelete.length;
        } else {
          result.deleted = toDelete.length;
        }
      }
      
      // Update existing scripts or add new ones
      for (const script of normalizedDiskScripts) {
        const dbScript = dbScriptMap.get(script.normalizedPath);
        
        if (dbScript) {
          // Update existing script if hash changed
          if (dbScript.file_hash !== script.file_hash) {
            Logger.info(`Updating script: ${script.file_path} (normalized: ${script.normalizedPath})`);
            const { error: updateError } = await this.supabase
              .from('scripts')
              .update({
                file_path: script.file_path, // Update with the correct relative path
                last_modified_at: script.last_modified_at,
                file_hash: script.file_hash,
                updated_at: new Date().toISOString()
              })
              .eq('id', dbScript.id);
            
            if (updateError) {
              Logger.error(`Error updating script ${script.file_path}:`, updateError);
              result.errors++;
            } else {
              result.updated++;
            }
          }
        } else {
          // Insert new script
          Logger.info(`Inserting new script: ${script.file_path}`);
          const { error: insertError } = await this.supabase
            .from('scripts')
            .insert({
              ...script,
              metadata: {},
              last_indexed_at: new Date().toISOString()
            });
          
          if (insertError) {
            Logger.error(`Error inserting script ${script.file_path}:`, insertError);
            result.errors++;
          } else {
            result.added++;
          }
        }
      }
      
      Logger.info("Script synchronization complete.");
      Logger.info(`Summary: Added=${result.added}, Updated=${result.updated}, Deleted=${result.deleted}, Errors=${result.errors}`);
      return result;
    } catch (error) {
      Logger.error("Error during script synchronization:", error);
      throw new Error(`Failed to synchronize scripts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Normalizes a file path for consistent comparison
   * Handles both absolute and relative paths
   */
  private normalizePath(filePath: string): string {
    if (!filePath) return '';
    
    // Remove any leading /Users, /home, etc. paths and normalize to project-relative paths
    const normalizedPath = filePath
      .replace(/^\/Users\/[^\/]+\/Documents\/github\/dhg-mono\//, '')
      .replace(/^\/Users\/[^\/]+\/[^\/]+\/dhg-mono\//, '')
      .replace(/^\/home\/[^\/]+\/[^\/]+\/dhg-mono\//, '')
      .replace(/^.*?dhg-mono\//, '')
      .replace(/^\/?/, ''); // Remove leading slash
      
    return normalizedPath;
  }
  
  /**
   * Classifies a script using the AI service
   * @param filePath - Path to the script file
   * @returns Classification result
   */
  async classifyScript(filePath: string): Promise<ClassificationResult | null> {
    // Ensure we use the correct path format
    const absolutePath = this.toAbsolutePath(filePath);
    const relativePath = this.toRelativePath(absolutePath);
    
    Logger.info(`Classifying script: ${relativePath}`);
    
    try {
      // Read file content
      const fileResult = await this.fileService.readFile(absolutePath);
      if (!fileResult.success) {
        throw new Error(`Failed to read script file: ${relativePath}`);
      }
      
      // Get script analysis prompt
      const prompt = await this.promptQueryService.getPromptByName('script-analysis-prompt');
      if (!prompt) {
        throw new Error("Script analysis prompt not found in database");
      }
      
      // Prepare prompt with script content
      const scriptContent = fileResult.content || '';
      
      const fullPrompt = prompt.content
        .replace('{{SCRIPT_CONTENT}}', scriptContent)
        .replace('{{FILE_PATH}}', relativePath);
      
      // Call Claude API
      Logger.info(`Calling Claude API for script analysis...`);
      
      // First prepare the Claude request structure
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: fullPrompt
            }
          ]
        }
      ];
      
      const response = await this.claudeService.callClaudeApi({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        temperature: 0,
        messages
      });
      
      if (!response.success || !response.result) {
        throw new Error(`Claude API call failed: ${response.error || 'Unknown error'}`);
      }
      
      // Extract the response text from the Claude API response
      const assistantMessage = response.result.content;
      if (!assistantMessage || !assistantMessage[0] || !assistantMessage[0].text) {
        throw new Error("Empty response from Claude API");
      }
      
      const responseText = assistantMessage[0].text;
      
      // Parse the AI response
      Logger.info(`Parsing AI response...`);
      const result = this.parseAIResponse(responseText);
      
      Logger.info(`Classification complete for ${filePath}`);
      return result;
    } catch (error) {
      Logger.error(`Error classifying script ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  /**
   * Parses AI response into structured data
   * @param aiResponse - AI response text
   * @returns Structured classification result
   */
  private parseAIResponse(aiResponse: string): ClassificationResult {
    try {
      // Look for JSON response in the AI output
      const jsonMatch = aiResponse.match(/```json([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        const jsonStr = jsonMatch[1].trim();
        const parsedResult = JSON.parse(jsonStr);
        
        return {
          scriptTypeId: parsedResult.script_type_id || null,
          summary: parsedResult.summary || null,
          aiGeneratedTags: parsedResult.tags || [],
          aiAssessment: parsedResult.assessment || null
        };
      }
      
      // Fallback parsing if JSON not found
      Logger.warn("JSON not found in AI response, using fallback parsing");
      
      // Extract tags (look for lines with "Tags:" or similar)
      const tagMatch = aiResponse.match(/Tags:(.+)$/m);
      const tags = tagMatch ? 
        tagMatch[1].split(',').map(tag => tag.trim()).filter(Boolean) : 
        [];
      
      // Extract summary (first paragraph)
      const summaryMatch = aiResponse.match(/^(.+?)(?:\n\n|\n$)/);
      const summary = summaryMatch ? 
        { description: summaryMatch[1].trim(), purpose: '' } : 
        null;
      
      return {
        scriptTypeId: null,
        summary,
        aiGeneratedTags: tags,
        aiAssessment: null
      };
    } catch (error) {
      Logger.error("Error parsing AI response:", error);
      return {
        scriptTypeId: null,
        summary: null,
        aiGeneratedTags: [],
        aiAssessment: null
      };
    }
  }
  
  /**
   * Updates a script in the database with classification results
   * @param scriptId - Script ID
   * @param result - Classification result
   * @returns Success status
   */
  async updateScriptWithClassification(scriptId: string, result: ClassificationResult): Promise<boolean> {
    Logger.info(`Updating script ${scriptId} with classification results`);
    
    try {
      const now = new Date().toISOString();
      
      const { error } = await this.supabase
        .from('scripts')
        .update({
          script_type_id: result.scriptTypeId,
          summary: result.summary,
          ai_generated_tags: result.aiGeneratedTags,
          ai_assessment: result.aiAssessment,
          assessment_created_at: now,
          assessment_updated_at: now,
          assessment_model: 'claude-3-7-sonnet-20250219',
          assessment_version: 1,
          assessment_date: now.split('T')[0],
          updated_at: now
        })
        .eq('id', scriptId);
      
      if (error) {
        Logger.error(`Error updating script ${scriptId} with classification:`, error);
        return false;
      }
      
      Logger.info(`Successfully updated script ${scriptId} with classification results`);
      return true;
    } catch (error) {
      Logger.error(`Error updating script with classification:`, error);
      return false;
    }
  }
  
  /**
   * Gets untyped scripts from the database
   * @param limit - Maximum number of scripts to retrieve
   * @returns Array of untyped scripts
   */
  async getUntypedScripts(limit: number): Promise<Script[]> {
    Logger.info(`Getting up to ${limit} untyped scripts...`);
    
    try {
      const { data, error } = await this.supabase
        .from('scripts')
        .select('id, file_path, title, language, summary, ai_generated_tags, manual_tags, last_modified_at, last_indexed_at, file_hash, metadata, created_at, updated_at, script_type_id, package_json_references, ai_assessment, assessment_quality_score, assessment_created_at, assessment_updated_at, assessment_model, assessment_version, assessment_date, document_type_id')
        .is('script_type_id', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        Logger.error("Error fetching untyped scripts:", error);
        return [];
      }
      
      Logger.info(`Found ${data ? data.length : 0} untyped scripts`);
      return data || [];
    } catch (error) {
      Logger.error("Error getting untyped scripts:", error);
      return [];
    }
  }
  
  /**
   * Gets recent scripts from the database
   * @param limit - Maximum number of scripts to retrieve
   * @returns Array of recent scripts
   */
  async getRecentScripts(limit: number): Promise<Script[]> {
    Logger.info(`Getting up to ${limit} recent scripts...`);
    
    try {
      const { data, error } = await this.supabase
        .from('scripts')
        .select('id, file_path, title, language, updated_at, summary, ai_generated_tags, manual_tags, last_modified_at, last_indexed_at, file_hash, metadata, created_at, script_type_id, package_json_references, ai_assessment, assessment_quality_score, assessment_created_at, assessment_updated_at, assessment_model, assessment_version, assessment_date, document_type_id')
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        Logger.error("Error fetching recent scripts:", error);
        return [];
      }
      
      Logger.info(`Found ${data ? data.length : 0} recent scripts`);
      return data || [];
    } catch (error) {
      Logger.error("Error getting recent scripts:", error);
      return [];
    }
  }
  
  /**
   * Removes script analysis results from the database
   * @returns Success status
   */
  async cleanScriptResults(): Promise<boolean> {
    Logger.info("Cleaning script analysis results...");
    
    try {
      const { error } = await this.supabase
        .from('scripts')
        .update({
          ai_assessment: null,
          assessment_quality_score: null,
          assessment_created_at: null,
          assessment_updated_at: null,
          assessment_model: null,
          assessment_date: null
        })
        .is('ai_assessment', 'not.null');
      
      if (error) {
        Logger.error("Error cleaning script results:", error);
        return false;
      }
      
      Logger.info("Script results cleaning completed successfully");
      return true;
    } catch (error) {
      Logger.error("Error cleaning script results:", error);
      return false;
    }
  }
  
  /**
   * Generates a summary report of scripts
   * @param options - Summary options
   * @returns Path to the generated report
   */
  async generateSummary(options: SummaryOptions): Promise<string | null> {
    Logger.info(`Generating summary for ${options.limit === -1 ? 'all' : options.limit} scripts`);
    
    try {
      // Fetch scripts from the database with full details needed for categorization
      let query = this.supabase
        .from('scripts')
        .select(`
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
        `);
      
      if (options.limit !== -1) {
        query = query.limit(options.limit);
      }
      
      query = query.order('updated_at', { ascending: false });
      
      const { data: scripts, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Verify we have scripts to process
      if (!scripts || scripts.length === 0) {
        Logger.info("No scripts found for summary report");
        return null;
      }
      
      // Get script types for name lookup
      const { data: scriptTypes } = await this.supabase
        .from('script_types')
        .select('id, name, description');
      
      // Create a map of script types for easier access
      const scriptTypeMap = new Map<string, {id: string, name: string, description?: string}>();
      if (scriptTypes) {
        scriptTypes.forEach(type => {
          scriptTypeMap.set(type.id, type);
        });
      }
      
      // Categorize scripts into the four categories specified in the technical spec
      const categorizedScripts: Record<'AI' | 'Integration' | 'Operations' | 'Development', Script[]> = {
        'AI': [],
        'Integration': [],
        'Operations': [],
        'Development': []
      };
      
      // Count used script types
      const scriptTypeCounts: Record<string, number> = {};
      
      // Process each script
      scripts.forEach(script => {
        // Categorize the script
        const category = this.categorizeScript(script as Script);
        categorizedScripts[category].push(script as Script);
        
        // Increment script type counter
        if (script.script_type_id) {
          scriptTypeCounts[script.script_type_id] = (scriptTypeCounts[script.script_type_id] || 0) + 1;
        }
      });
      
      // Generate the report
      let report = `# Script Analysis Summary Report\n\n`;
      report += `Generated: ${new Date().toISOString()}\n`;
      report += `Total Scripts: ${scripts.length}\n\n`;
      
      // Summary statistics
      report += `## Summary Statistics\n\n`;
      report += `| Category | Count | Percentage |\n`;
      report += `| --- | --- | --- |\n`;
      
      const totalScripts = scripts.length;
      for (const [category, categoryScripts] of Object.entries(categorizedScripts)) {
        const percentage = ((categoryScripts.length / totalScripts) * 100).toFixed(1);
        report += `| ${category} | ${categoryScripts.length} | ${percentage}% |\n`;
      }
      
      report += `\n`;
      
      // Show script types distribution if we have any
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
      
      // First add a table with file_path for quick reference
      report += `## File Path Overview\n\n`;
      report += `| ID | File Path | Category | Last Updated |\n`;
      report += `| --- | --- | --- | --- |\n`;
      
      // Show up to 20 files in the table, then indicate there are more
      scripts.slice(0, 20).forEach(script => {
        const updatedAt = script.updated_at ? new Date(script.updated_at).toISOString().split('T')[0] : 'N/A';
        const category = this.categorizeScript(script as Script);
        // Only show first part of ID to save space
        const shortId = script.id.substring(0, 8) + '...';
        report += `| ${shortId} | \`${script.file_path}\` | ${category} | ${updatedAt} |\n`;
      });
      
      if (scripts.length > 20) {
        report += `| ... | ... | ... | ... |\n`;
      }
      
      report += `\n\n`;
      
      // Generate detailed sections by category
      for (const [category, categoryScripts] of Object.entries(categorizedScripts)) {
        if (categoryScripts.length === 0) continue;
        
        report += `## ${category} Scripts (${categoryScripts.length})\n\n`;
        
        // Add a brief description based on the category
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
          
          const quality = this.assessScriptQuality(script as Script);
          
          report += `### ${script.title}\n`;
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
      
      // Create reports directory if it doesn't exist
      const reportsDir = 'docs/script-reports';
      try {
        await fs.mkdir(reportsDir, { recursive: true });
      } catch (mkdirError) {
        Logger.error(`Error creating reports directory: ${mkdirError instanceof Error ? mkdirError.message : 'Unknown error'}`);
      }
      
      // Write the report to a file
      const reportPath = `${reportsDir}/script-summary-${new Date().toISOString().slice(0, 10)}.md`;
      await fs.writeFile(reportPath, report);
      
      Logger.info(`Summary report generated: ${reportPath}`);
      return reportPath;
    } catch (error) {
      Logger.error("Error generating script summary:", error);
      return null;
    }
  }
  
  /**
   * Groups scripts by their script type
   * @param scripts - Array of scripts
   * @returns Map of script type to scripts
   */
  private groupByScriptType(scripts: Script[]): Record<string, Script[]> {
    const result: Record<string, Script[]> = {};
    
    for (const script of scripts) {
      const typeId = script.script_type_id || 'null';
      if (!result[typeId]) {
        result[typeId] = [];
      }
      result[typeId].push(script);
    }
    
    return result;
  }
  
  /**
   * Categorizes a script into one of the predefined categories
   * @param script - Script to categorize
   * @returns Category name (AI, Integration, Operations, or Development)
   */
  private categorizeScript(script: Script): 'AI' | 'Integration' | 'Operations' | 'Development' {
    // Default to 'Development' if no category is found
    let category: 'AI' | 'Integration' | 'Operations' | 'Development' = 'Development';
    
    const tags = script.ai_generated_tags || [];
    const summary = script.summary || null;
    const title = script.title || '';
    const filePath = script.file_path || '';
    
    // Check for AI related scripts
    if (
      tags.some(tag => /ai|claude|openai|gpt|llm|ml|model|prompt/i.test(tag)) ||
      filePath.includes('prompts') ||
      (summary && summary.description && 
       /ai|claude|openai|gpt|llm|ml|model|prompt/i.test(summary.description))
    ) {
      category = 'AI';
    }
    // Check for Integration related scripts
    else if (
      tags.some(tag => /api|integration|connect|external|supabase|database|google/i.test(tag)) ||
      filePath.includes('integration') ||
      (summary && summary.description && 
       /api|integration|connect|external|supabase|database|google/i.test(summary.description))
    ) {
      category = 'Integration';
    }
    // Check for Operations related scripts
    else if (
      tags.some(tag => /deploy|build|ci|cd|pipeline|release|backup|setup|config/i.test(tag)) ||
      filePath.includes('deploy') || filePath.includes('setup') || filePath.includes('config') ||
      (summary && summary.description && 
       /deploy|build|ci|cd|pipeline|release|backup|setup|config/i.test(summary.description))
    ) {
      category = 'Operations';
    }
    
    return category;
  }
  
  /**
   * Assesses the quality of a script based on AI assessment or default values
   * @param script - Script to assess
   * @returns Quality assessment with various metrics
   */
  private assessScriptQuality(script: Script): {
    code_quality: string;
    maintainability: string;
    utility: string;
    documentation: string;
  } {
    const hasAssessment = script.ai_assessment !== null;
    
    // If we have AI assessment, use it
    if (hasAssessment && script.ai_assessment) {
      return {
        code_quality: script.ai_assessment.quality || 'Unknown',
        maintainability: script.ai_assessment.maintainability || 'Unknown',
        utility: 'Unknown', // Not in current schema, could add later
        documentation: script.ai_assessment.documentation_quality || 'Unknown'
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
}