/**
 * Adapter for markdown file service
 * 
 * This adapter will eventually use the shared markdown-file-service.
 * It's designed as an adapter to make the future transition smoother.
 * 
 * NOTES FOR MIGRATION:
 * 1. This is a temporary adapter that will be replaced with the shared service
 * 2. Keep the interface consistent with the shared service
 * 3. When migrating, update the implementation to use the shared service but
 *    maintain the same interface
 */
import { markdownFileService, MarkdownFile, MarkdownTreeItem } from './markdownFileService';
import { Logger } from '@/utils/logger';

export class MarkdownFileAdapter {
  /**
   * Get file tree from API
   */
  async getFileTree(): Promise<MarkdownTreeItem[]> {
    try {
      Logger.debug('Getting file tree via adapter');
      return await markdownFileService.getFileTree();
    } catch (error) {
      Logger.error('Error getting file tree:', error);
      return [];
    }
  }

  /**
   * Get the content of a markdown file
   */
  async getFileContent(filePath: string): Promise<MarkdownFile | null> {
    try {
      Logger.debug(`Getting content for file: ${filePath} via adapter`);
      return await markdownFileService.getFileContent(filePath);
    } catch (error) {
      Logger.error(`Error getting file content for ${filePath}:`, error);
      
      // Return minimal placeholder content as last resort
      const fileName = filePath.split('/').pop() || 'Unknown';
      const title = fileName.replace(/\.md[x]?$/, '');
      
      return {
        id: `file_${filePath}`,
        filePath,
        title,
        content: `# ${title}\n\nPlaceholder content for ${filePath}`,
        lastModifiedAt: new Date().toISOString(),
        size: 0
      };
    }
  }

  /**
   * Run the markdown report generator
   */
  async runMarkdownReport(): Promise<{ success: boolean; fileTree?: MarkdownTreeItem[] }> {
    try {
      Logger.debug('Running markdown report via adapter');
      return await markdownFileService.runMarkdownReport();
    } catch (error) {
      Logger.error('Error running markdown report:', error);
      return { success: false };
    }
  }

  /**
   * Search markdown files
   */
  async searchFiles(query: string): Promise<MarkdownFile[]> {
    try {
      Logger.debug(`Searching for: "${query}" via adapter`);
      return await markdownFileService.searchFiles(query);
    } catch (error) {
      Logger.error(`Error searching files for "${query}":`, error);
      return [];
    }
  }

  /**
   * Synchronize documentation files with the database
   */
  async syncDocumentationFiles(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      Logger.debug('Syncing documentation files via adapter');
      return await markdownFileService.syncDocumentationFiles();
    } catch (error) {
      Logger.error('Error syncing documentation files:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Archive a markdown file (move it to .archive_docs folder)
   */
  async archiveFile(filePath: string): Promise<{ success: boolean; message: string; newPath: string }> {
    try {
      Logger.debug(`Archiving file: ${filePath} via adapter`);
      return await markdownFileService.archiveFile(filePath);
    } catch (error) {
      Logger.error(`Error archiving file ${filePath}:`, error);
      throw error; // Let the caller handle the error
    }
  }

  /**
   * Delete a markdown file from disk
   */
  async deleteFile(filePath: string): Promise<{ success: boolean; message: string }> {
    try {
      Logger.debug(`Deleting file: ${filePath} via adapter`);
      return await markdownFileService.deleteFile(filePath);
    } catch (error) {
      Logger.error(`Error deleting file ${filePath}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete file'
      };
    }
  }
}

// Export singleton instance
export const markdownFileAdapter = new MarkdownFileAdapter();