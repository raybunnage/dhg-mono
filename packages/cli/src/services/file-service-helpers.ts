/**
 * Helper functions for the file service
 * These are temporary wrappers until the full migration to the shared package is complete
 */

import { FileService, FileResult, fileService as sharedFileService } from '@dhg/shared/services';
import { LoggerUtils } from '../utils/logger-utils';

/**
 * Extends the FileService class from the shared package with additional CLI-specific methods
 */
export class FileServiceWrapper extends FileService {
  /**
   * Read a file from the filesystem (Wrapper for shared implementation)
   */
  readFile(filePath: string): FileResult {
    LoggerUtils.debug(`Reading file: ${filePath}`);
    return sharedFileService.readFile(filePath);
  }
  
  /**
   * Write content to a file (Wrapper for shared implementation)
   */
  writeFile(filePath: string, content: string): FileResult {
    LoggerUtils.debug(`Writing file: ${filePath}`);
    return sharedFileService.writeFile(filePath, content);
  }
  
  /**
   * Ensure a directory exists, creating it if necessary (Wrapper for shared implementation)
   */
  ensureDirectoryExists(dirPath: string): boolean {
    return sharedFileService.ensureDirectoryExists(dirPath);
  }
  
  /**
   * Find files recursively in a directory that match a pattern (Wrapper for shared implementation)
   */
  findFilesLegacy(
    directoryPath: string, 
    pattern: RegExp, 
    excludePatterns: RegExp[] = [/node_modules/, /\.git/, /dist/, /build/, /coverage/]
  ): string[] {
    return sharedFileService.findFilesLegacy(directoryPath, pattern, excludePatterns);
  }
  
  /**
   * Find files using glob patterns (Wrapper for shared implementation)
   */
  async findFiles(options: {
    directory: string;
    includePatterns: string[];
    excludePatterns: string[];
    recursive: boolean;
  }): Promise<string[]> {
    return sharedFileService.findFiles(options);
  }
}

// Export singleton instance
export const fileService = new FileServiceWrapper();

// Also export the FileResult interface for backward compatibility
export { FileResult } from '@dhg/shared/services';