import { FileService } from './file-service';
import { SupabaseClientService, getSupabaseClient } from './supabase-client';
import { PromptQueryService } from './prompt-query-service';
import { ClaudeService } from './claude-service';
import { createHash } from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';
import { Logger } from '../utils/logger';
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
  private readonly scriptExtensions = ['.sh', '.js'];
  private readonly excludeDirs = ['node_modules', '.git', 'dist', 'build'];
  private rootDir: string;
  
  constructor() {
    this.fileService = new FileService();
    this.promptQueryService = new PromptQueryService({});
    
    // Initialize Claude service with API key from environment
    const claudeApiKey = process.env.CLAUDE_API_KEY || '';
    this.claudeService = new ClaudeService(claudeApiKey);
    
    // Store root directory for path conversions
    this.rootDir = process.cwd();
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
      const supabase = getSupabaseClient();
      
      // Get existing scripts from database
      const { data: dbScripts, error } = await supabase
        .from('scripts')
        .select('id, file_path, file_hash, is_deleted');
      
      if (error) {
        Logger.error("Error fetching scripts from database:", error);
        throw new Error(`Failed to fetch scripts from database: ${error.message}`);
      }
      
      if (!dbScripts) {
        Logger.error("No scripts data returned from database");
        throw new Error("No scripts data returned from database");
      }
      
      // Create map and set for efficient lookups
      const dbScriptMap = new Map(dbScripts.map(script => [script.file_path, script]));
      const diskScriptPaths = new Set(scripts.map(script => script.file_path));
      
      // Mark scripts that no longer exist as deleted
      const toDelete = dbScripts.filter(dbScript => 
        !diskScriptPaths.has(dbScript.file_path) && !dbScript.is_deleted
      );
      
      if (toDelete.length > 0) {
        Logger.info(`Marking ${toDelete.length} scripts as deleted...`);
        const { error: deleteError } = await supabase
          .from('scripts')
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .in('id', toDelete.map(script => script.id));
        
        if (deleteError) {
          Logger.error("Error marking scripts as deleted:", deleteError);
          result.errors += toDelete.length;
        } else {
          result.deleted = toDelete.length;
        }
      }
      
      // Process each script for insert or update
      for (const script of scripts) {
        const dbScript = dbScriptMap.get(script.file_path);
        
        if (dbScript) {
          // Update existing script if hash changed or was previously marked as deleted
          if (dbScript.file_hash !== script.file_hash || dbScript.is_deleted) {
            Logger.info(`Updating script: ${script.file_path}`);
            const { error: updateError } = await supabase
              .from('scripts')
              .update({
                last_modified_at: script.last_modified_at,
                file_hash: script.file_hash,
                updated_at: new Date().toISOString(),
                is_deleted: false
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
          const { error: insertError } = await supabase
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
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
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
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('scripts')
        .select('id, file_path, title, language, summary, ai_generated_tags, manual_tags, last_modified_at, last_indexed_at, file_hash, metadata, created_at, updated_at, is_deleted, script_type_id, package_json_references, ai_assessment, assessment_quality_score, assessment_created_at, assessment_updated_at, assessment_model, assessment_version, assessment_date, document_type_id')
        .is('script_type_id', null)
        .eq('is_deleted', false)
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
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('scripts')
        .select('id, file_path, title, language, updated_at, summary, ai_generated_tags, manual_tags, last_modified_at, last_indexed_at, file_hash, metadata, created_at, is_deleted, script_type_id, package_json_references, ai_assessment, assessment_quality_score, assessment_created_at, assessment_updated_at, assessment_model, assessment_version, assessment_date, document_type_id')
        .eq('is_deleted', false)
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
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
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
    Logger.info(`Generating summary for ${options.limit === -1 ? 'all' : options.limit} scripts (include deleted: ${options.includeDeleted})`);
    
    try {
      const supabase = getSupabaseClient();
      
      // Fetch scripts from the database
      let query = supabase
        .from('scripts')
        .select(`
          id, 
          file_path, 
          title, 
          language, 
          summary,
          ai_generated_tags,
          script_type_id,
          created_at,
          updated_at,
          is_deleted
        `);
      
      if (!options.includeDeleted) {
        query = query.eq('is_deleted', false);
      }
      
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
      
      // Generate the report
      let report = `# Script Summary Report\n\n`;
      report += `Generated: ${new Date().toISOString()}\n`;
      report += `Total Scripts: ${scripts.length}\n\n`;
      
      // Group by script type
      const scriptsByType = this.groupByScriptType(scripts as Script[]);
      
      // Generate the report sections
      for (const [typeId, typeScripts] of Object.entries(scriptsByType)) {
        // Get type name if possible
        let typeName = 'Unclassified';
        
        if (typeId !== 'null') {
          const { data } = await supabase
            .from('script_types')
            .select('name')
            .eq('id', typeId)
            .single();
          
          if (data && data.name) {
            typeName = data.name;
          }
        }
        
        report += `## ${typeName} (${typeScripts.length})\n\n`;
        
        for (const script of typeScripts) {
          report += `### ${script.title}\n`;
          report += `- Path: ${script.file_path}\n`;
          report += `- Language: ${script.language}\n`;
          
          if (script.ai_generated_tags && script.ai_generated_tags.length > 0) {
            report += `- Tags: ${script.ai_generated_tags.join(', ')}\n`;
          }
          
          if (script.summary) {
            if (typeof script.summary === 'object') {
              report += `- Description: ${script.summary.description || 'N/A'}\n`;
              report += `- Purpose: ${script.summary.purpose || 'N/A'}\n`;
              
              if (script.summary.key_functions && script.summary.key_functions.length > 0) {
                report += `- Key Functions: ${script.summary.key_functions.join(', ')}\n`;
              }
            } else {
              report += `- Summary: ${JSON.stringify(script.summary)}\n`;
            }
          }
          
          report += `- Created: ${script.created_at}\n`;
          report += `- Updated: ${script.updated_at}\n`;
          
          if (script.is_deleted) {
            report += `- Status: Deleted\n`;
          }
          
          report += `\n`;
        }
      }
      
      // Create reports directory if it doesn't exist
      const reportsDir = 'reports';
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
}