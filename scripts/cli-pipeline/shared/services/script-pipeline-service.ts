/**
 * Script Pipeline Service
 * 
 * Provides a unified service for interacting with script pipeline functionality.
 * This service replaces the previous script-pipeline-main.sh and script-manager.sh scripts.
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger-service';
import { DatabaseService } from './database-service';
import { ClaudeService } from './claude-service';
import { EnvironmentService } from './environment-service';

/**
 * Script Pipeline Service implementation
 */
export class ScriptPipelineService {
  private static instance: ScriptPipelineService;
  private rootDir: string;
  private reportsDir: string;
  private dbService: DatabaseService;
  private claudeService: ClaudeService;
  private envService: EnvironmentService;
  
  /**
   * Create a new script pipeline service
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.rootDir = path.resolve(__dirname, '../../../../../');
    this.reportsDir = path.join(this.rootDir, 'script-analysis-results');
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
    
    // Initialize services
    this.dbService = DatabaseService.getInstance();
    this.claudeService = ClaudeService.getInstance();
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
      // Create log file for output
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const logFile = path.join(this.reportsDir, `script-pipeline-${timestamp.replace('T', '_')}.log`);
      const logStream = fs.createWriteStream(logFile);
      
      logger.info(`Executing script: ${scriptPath} with args: ${args.join(' ')}`);
      logger.info(`Logging to: ${logFile}`);
      
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
      
      // Capture output for logging
      child.stdout.pipe(logStream);
      child.stderr.pipe(logStream);
      
      child.stdout.on('data', (data) => {
        process.stdout.write(data);
      });
      
      child.stderr.on('data', (data) => {
        process.stderr.write(data);
      });
      
      child.on('close', (code) => {
        logStream.end();
        if (code === 0) {
          logger.info(`Script execution completed successfully`);
          resolve(0);
        } else {
          logger.error(`Script execution failed with code ${code}`);
          resolve(code || 1);
        }
      });
      
      child.on('error', (err) => {
        logStream.end();
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
      
      const { data, error } = await this.dbService.executeRpc<any>('find_and_sync_scripts', {});
      
      if (error) {
        logger.error(`Error syncing scripts: ${error.message}`);
        return 1;
      }
      
      logger.info(`Successfully synced ${data?.affected_rows || 0} script files`);
      return 0;
    } catch (error: any) {
      logger.error('Error during script sync', error);
      return 1;
    }
  }
  
  /**
   * Find and insert new script files
   */
  public async findNewScripts(): Promise<number> {
    logger.info('Starting discovery of new script files');
    
    try {
      // Connect to Supabase if not already connected
      await this.dbService.ensureConnection();
      
      const { data, error } = await this.dbService.executeRpc<any>('find_and_sync_scripts', {});
      
      if (error) {
        logger.error(`Error finding new scripts: ${error.message}`);
        return 1;
      }
      
      logger.info(`Found ${data?.new_scripts || 0} new script files`);
      return 0;
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
      // Check if the classify script exists
      const classifyScript = path.join(this.rootDir, 'scripts/cli-pipeline/analysis/classify-script-with-prompt.sh');
      
      if (!fs.existsSync(classifyScript)) {
        logger.error(`Classify script not found at: ${classifyScript}`);
        return 1;
      }
      
      // Execute the classification script
      return await this.executeScript(classifyScript, [count.toString()]);
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
      // Check if the classify script exists
      const classifyScript = path.join(this.rootDir, 'scripts/cli-pipeline/analysis/classify-script-with-prompt.sh');
      
      if (!fs.existsSync(classifyScript)) {
        logger.error(`Classify script not found at: ${classifyScript}`);
        return 1;
      }
      
      // Execute the classification script
      return await this.executeScript(classifyScript, [count.toString()]);
    } catch (error: any) {
      logger.error('Error during script classification', error);
      return 1;
    }
  }
  
  /**
   * Generate a summary report of scripts
   */
  public async generateSummary(count: number = 50, includeDeleted: boolean = false): Promise<number> {
    logger.info(`Generating summary report for ${count} scripts (include deleted: ${includeDeleted})`);
    
    try {
      const reportFile = path.join(this.reportsDir, `script-summary-${new Date().toISOString().split('T')[0]}.md`);
      
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
          is_deleted,
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
      
      // Add filter for deleted if needed
      if (!includeDeleted) {
        query.filter = { is_deleted: false };
      }
      
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
      
      // Write the report to file
      fs.writeFileSync(reportFile, report);
      logger.info(`Report generated successfully at: ${reportFile}`);
      
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
    report += `Total Scripts: ${scripts.length}\n`;
    report += `Includes Deleted: ${scripts.some(s => s.is_deleted)}\n\n`;
    
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
    report += `| ID | File Path | Status | Category | Last Updated |\n`;
    report += `| --- | --- | --- | --- | --- |\n`;
    
    scripts.slice(0, 20).forEach(script => {
      const status = script.is_deleted ? '🔴 DELETED' : '🟢 ACTIVE';
      const updatedAt = script.updated_at 
        ? new Date(script.updated_at).toISOString().split('T')[0] 
        : 'N/A';
      const category = this.categorizeScript(script);
      report += `| ${script.id.substring(0, 8)}... | \`${script.file_path}\` | ${status} | ${category} | ${updatedAt} |\n`;
    });
    
    if (scripts.length > 20) {
      report += `| ... | ... | ... | ... | ... |\n`;
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
        report += `- **Status**: ${script.is_deleted ? 'Deleted' : 'Active'}\n`;
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