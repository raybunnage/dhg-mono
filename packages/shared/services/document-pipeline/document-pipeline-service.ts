import { spawn } from 'child_process';
import path from 'path';
import { Logger } from '../../utils/logger';
import config from '../../utils/config';

/**
 * Service for interacting with the document pipeline scripts
 */
export class DocumentPipelineService {
  private rootDir: string;
  private scriptPath: string;
  
  constructor() {
    // Get root directory (assuming cli package is in the monorepo)
    this.rootDir = path.resolve(__dirname, '../../../../../');
    this.scriptPath = path.join(this.rootDir, 'scripts/cli-pipeline/document-pipeline-main.sh');
  }
  
  /**
   * Execute a document pipeline command
   * @param command The command to execute
   * @param args Additional arguments
   * @returns Promise that resolves when command completes
   */
  async executeCommand(command: string, ...args: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        Logger.info(`Executing document pipeline command: ${command} ${args.join(' ')}`);
        
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
          Logger.error(`Error executing command ${command}`);
          reject(err);
        });
      } catch (error) {
        Logger.error(`Failed to run ${command} command`);
        reject(error);
      }
    });
  }
  
  /**
   * Show recent document files
   * @param count Number of files to show
   */
  async showRecentFiles(count: number = 20): Promise<number> {
    return this.executeCommand('show-recent', count.toString());
  }
  
  /**
   * Find and insert new document files
   */
  async findNewFiles(): Promise<number> {
    return this.executeCommand('find-new');
  }
  
  /**
   * Show untyped document files
   */
  async showUntypedFiles(): Promise<number> {
    return this.executeCommand('show-untyped');
  }
  
  /**
   * Classify recent document files
   * @param count Number of files to process
   */
  async classifyRecentFiles(count: number = 20): Promise<number> {
    return this.executeCommand('classify-recent', count.toString());
  }
  
  /**
   * Classify untyped document files
   * @param count Number of files to process
   */
  async classifyUntypedFiles(count: number = 10): Promise<number> {
    return this.executeCommand('classify-untyped', count.toString());
  }
  
  /**
   * Synchronize database with files on disk
   */
  async syncFiles(): Promise<number> {
    return this.executeCommand('sync');
  }
  
  /**
   * Generate a summary report of documents
   * @param count Number of documents to include
   * @param includeDeleted Whether to include deleted files
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
export const documentPipelineService = new DocumentPipelineService();