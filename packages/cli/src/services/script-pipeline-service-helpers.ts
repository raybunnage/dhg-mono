/**
 * Helper functions for the script-pipeline-service
 * These are temporary wrappers until the full migration to the shared package is complete
 */

import { scriptPipelineService as sharedScriptPipelineService } from '@dhg/shared/services';
import { LoggerUtils } from '../utils/logger-utils';

/**
 * Service for interacting with the script pipeline scripts
 * This wrapper maintains backward compatibility while delegating to the shared implementation
 */
export class ScriptPipelineService {
  /**
   * Execute a script pipeline command
   * @param command The command to execute
   * @param args Additional arguments
   * @returns Promise that resolves when command completes
   */
  async executeCommand(command: string, ...args: string[]): Promise<number> {
    LoggerUtils.debug(`Executing script pipeline command: ${command} ${args.join(' ')}`);
    
    try {
      return await sharedScriptPipelineService.executeCommand(command, ...args);
    } catch (error) {
      LoggerUtils.error(`Failed to run ${command} command`, error);
      throw error;
    }
  }
  
  /**
   * Synchronize database with script files on disk
   */
  async syncScripts(): Promise<number> {
    return sharedScriptPipelineService.syncScripts();
  }
  
  /**
   * Find and insert new script files
   */
  async findNewScripts(): Promise<number> {
    return sharedScriptPipelineService.findNewScripts();
  }
  
  /**
   * Show untyped script files
   */
  async showUntypedScripts(): Promise<number> {
    return sharedScriptPipelineService.showUntypedScripts();
  }
  
  /**
   * Show recent script files
   */
  async showRecentScripts(): Promise<number> {
    return sharedScriptPipelineService.showRecentScripts();
  }
  
  /**
   * Classify recent script files
   */
  async classifyRecentScripts(): Promise<number> {
    return sharedScriptPipelineService.classifyRecentScripts();
  }
  
  /**
   * Classify untyped script files
   * @param count Number of files to process
   */
  async classifyUntypedScripts(count: number = 10): Promise<number> {
    return sharedScriptPipelineService.classifyUntypedScripts(count);
  }
  
  /**
   * Clean script analysis results
   */
  async cleanScriptResults(): Promise<number> {
    return sharedScriptPipelineService.cleanScriptResults();
  }
  
  /**
   * Generate a summary report of scripts
   * @param count Number of scripts to include
   * @param includeDeleted Whether to include deleted scripts
   */
  async generateSummary(count: number = 50, includeDeleted: boolean = false): Promise<number> {
    return sharedScriptPipelineService.generateSummary(count, includeDeleted);
  }
  
  /**
   * Run the complete pipeline
   */
  async runCompletePipeline(): Promise<number> {
    return sharedScriptPipelineService.runCompletePipeline();
  }
}

// Export a singleton instance
export const scriptPipelineService = new ScriptPipelineService();