/**
 * Adapter for script file service
 * 
 * This adapter will eventually use the shared script-file-service.
 * It's designed as an adapter to make the future transition smoother.
 * 
 * NOTES FOR MIGRATION:
 * 1. This is a temporary adapter that will be replaced with the shared service
 * 2. Keep the interface consistent with the shared service
 * 3. When migrating, update the implementation to use the shared service but
 *    maintain the same interface
 */
import { scriptFileService, ScriptFileResponse } from './scriptFileService';
import { Logger } from '@/utils/logger';

export class ScriptFileAdapter {
  /**
   * Get file content by path
   */
  async getFileContent(filePath: string): Promise<ScriptFileResponse> {
    try {
      Logger.debug(`Getting script file content: ${filePath} via adapter`);
      return await scriptFileService.getFileContent(filePath);
    } catch (error) {
      Logger.error(`Error getting script file content for ${filePath}:`, error);
      throw error; // Let the caller handle the error
    }
  }
  
  /**
   * Delete a script file from disk
   */
  async deleteFile(filePath: string): Promise<{ success: boolean; message: string }> {
    try {
      Logger.debug(`Deleting script file: ${filePath} via adapter`);
      return await scriptFileService.deleteFile(filePath);
    } catch (error) {
      Logger.error(`Error deleting script file ${filePath}:`, error);
      throw error; // Let the caller handle the error
    }
  }
  
  /**
   * Archive a script file (move it to .archived_scripts folder)
   */
  async archiveFile(filePath: string): Promise<{ success: boolean; message: string; new_path: string }> {
    try {
      Logger.debug(`Archiving script file: ${filePath} via adapter`);
      return await scriptFileService.archiveFile(filePath);
    } catch (error) {
      Logger.error(`Error archiving script file ${filePath}:`, error);
      throw error; // Let the caller handle the error
    }
  }
  
  /**
   * List available script files
   */
  async listScriptFiles(): Promise<{ total: number; files: string[] }> {
    try {
      Logger.debug('Listing script files via adapter');
      return await scriptFileService.listScriptFiles();
    } catch (error) {
      Logger.error('Error listing script files:', error);
      throw error; // Let the caller handle the error
    }
  }
}

// Export singleton instance
export const scriptFileAdapter = new ScriptFileAdapter();