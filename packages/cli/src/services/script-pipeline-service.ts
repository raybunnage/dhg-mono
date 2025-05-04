import { spawn } from 'child_process';
import path from 'path';
import { Logger } from '../utils/logger';
import config from '../utils/config';

/**
 * Service for interacting with the script pipeline scripts
 */
export class ScriptPipelineService {
  private rootDir: string;
  private scriptPath: string;
  
  constructor() {
    // Get root directory (assuming cli package is in the monorepo)
    this.rootDir = path.resolve(__dirname, '../../../..');
    this.scriptPath = path.join(this.rootDir, 'scripts/cli-pipeline/script-pipeline-main.sh');
  }
  
  /**
   * Execute a script pipeline command
   * @param command The command to execute
   * @param args Additional arguments
   * @returns Promise that resolves when command completes
   */
  async executeCommand(command: string, ...args: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        Logger.info(`Executing script pipeline command: ${command} ${args.join(' ')}`);
        
        // Execute the original shell script with the specified command
        const childProcess = spawn('bash', [this.scriptPath, command, ...args], {
          stdio: 'inherit',
          env: {
            ...process.env,
            SUPABASE_URL: config.supabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: config.supabaseKey,
          }
        });
        
        childProcess.on('exit', (code: number | null) => {
          if (code === 0) {
            Logger.info(`Command ${command} completed successfully`);
            resolve(0);
          } else {
            Logger.error(`Command ${command} failed with exit code ${code}`);
            resolve(code || 1);
          }
        });
        
        childProcess.on('error', (err) => {
          Logger.error(`Error executing command ${command}:`, err);
          reject(err);
        });
      } catch (error) {
        Logger.error(`Failed to run ${command} command`, error);
        reject(error);
      }
    });
  }
  
  /**
   * Synchronize database with script files on disk
   */
  async syncScripts(): Promise<number> {
    return this.executeCommand('sync');
  }
  
  /**
   * Find and insert new script files
   */
  async findNewScripts(): Promise<number> {
    return this.executeCommand('find-new');
  }
  
  /**
   * Show untyped script files
   */
  async showUntypedScripts(): Promise<number> {
    return this.executeCommand('show-untyped');
  }
  
  /**
   * Show recent script files
   */
  async showRecentScripts(): Promise<number> {
    return this.executeCommand('show-recent');
  }
  
  /**
   * Classify recent script files
   */
  async classifyRecentScripts(): Promise<number> {
    return this.executeCommand('classify-recent');
  }
  
  /**
   * Classify untyped script files
   * @param count Number of files to process
   */
  async classifyUntypedScripts(count: number = 10): Promise<number> {
    return this.executeCommand('classify-untyped', count.toString());
  }
  
  /**
   * Clean script analysis results
   */
  async cleanScriptResults(): Promise<number> {
    return this.executeCommand('clean-script-results');
  }
  
  /**
   * Generate a summary report of scripts
   * @param count Number of scripts to include
   * @param includeDeleted Whether to include deleted scripts
   */
  async generateSummary(count: number = 50, includeDeleted: boolean = false): Promise<number> {
    return this.executeCommand('generate-summary', count.toString(), includeDeleted.toString());
  }
  
  /**
   * Run the complete pipeline
   */
  async runCompletePipeline(): Promise<number> {
    return this.executeCommand('all');
  }
}

// Export a singleton instance
export const scriptPipelineService = new ScriptPipelineService();