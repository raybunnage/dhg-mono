/**
 * Adapter for script pipeline service
 * 
 * This adapter will eventually use the shared script-pipeline-service.
 * It's designed as an adapter to make the future transition smoother.
 * 
 * NOTES FOR MIGRATION:
 * 1. This is a temporary adapter that will be replaced with the shared service
 * 2. Keep the interface consistent with the shared service
 * 3. When migrating, update the implementation to use the shared service but
 *    maintain the same interface
 */
import { Logger } from '@/utils/logger';
import { expertService } from './expert-service';

/**
 * Interface representing a script file
 */
export interface ScriptFile {
  id?: string;
  file_path: string;
  title?: string;
  language?: string;
  document_type?: string;
  summary?: string;
  tags?: string[];
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export class ScriptPipelineAdapter {
  /**
   * Execute a script pipeline command
   * Mock implementation of the shared service executeCommand method
   */
  async executeCommand(command: string, ...args: string[]): Promise<number> {
    try {
      Logger.debug(`Executing script pipeline command: ${command} ${args.join(' ')}`);
      
      // Mock implementation - in the real adapter, this would call the shared service
      switch (command) {
        case 'find-new':
          return await this.findNewScripts();
        case 'sync':
          return await this.syncScripts();
        case 'show-recent':
          const count = args.length > 0 ? parseInt(args[0], 10) : 20;
          return await this.showRecentScripts(count);
        default:
          Logger.warn(`Command not implemented in adapter: ${command}`);
          return 1;
      }
    } catch (error) {
      Logger.error(`Error executing command ${command}:`, error);
      return 1;
    }
  }
  
  /**
   * Find new scripts
   * Mock implementation that always succeeds
   */
  private async findNewScripts(): Promise<number> {
    Logger.info('Finding new scripts');
    // Simulate success
    return 0;
  }
  
  /**
   * Sync scripts
   * Mock implementation that always succeeds
   */
  private async syncScripts(): Promise<number> {
    Logger.info('Syncing scripts');
    // Simulate success
    return 0;
  }
  
  /**
   * Show recent scripts
   * Mock implementation that returns success
   */
  private async showRecentScripts(count: number): Promise<number> {
    Logger.info(`Showing ${count} recent scripts`);
    // Simulate success
    return 0;
  }
  
  /**
   * Get recent scripts
   * Public method for components to use directly
   */
  async getRecentScripts(limit: number = 20): Promise<ScriptFile[]> {
    try {
      Logger.debug(`Getting ${limit} recent scripts`);
      
      // Mock implementation - in the real adapter, this would use the shared service
      // For now, just return some mock data
      return [
        {
          id: 'script-1',
          file_path: '/scripts/example1.sh',
          title: 'Example Script 1',
          language: 'bash',
          document_type: 'script',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'script-2',
          file_path: '/scripts/example2.js',
          title: 'Example Script 2',
          language: 'javascript',
          document_type: 'script',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    } catch (error) {
      Logger.error('Error getting recent scripts:', error);
      return [];
    }
  }
}

// Export singleton instance
export const scriptPipelineAdapter = new ScriptPipelineAdapter();