import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger';
import { AppError, ErrorHandler } from '../utils/error-handler';

export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
  path: string;
  stats?: {
    size: number;
    modified: Date;
    lines: number;
  };
}

export class FileService {
  /**
   * Read a file from the filesystem
   */
  readFile(filePath: string): FileResult {
    try {
      const fullPath = path.resolve(filePath);
      Logger.debug(`Reading file: ${fullPath}`);
      
      if (!fs.existsSync(fullPath)) {
        Logger.warn(`File does not exist: ${fullPath}`);
        return {
          success: false,
          error: `File not found: ${fullPath}`,
          path: fullPath
        };
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = this.getFileStats(fullPath);
      
      Logger.debug(`Successfully read file with size: ${content.length} bytes`);
      
      return {
        success: true,
        content,
        path: fullPath,
        stats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Logger.error(`Error reading file: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        path: filePath
      };
    }
  }
  
  /**
   * Write content to a file
   */
  writeFile(filePath: string, content: string): FileResult {
    try {
      const fullPath = path.resolve(filePath);
      Logger.debug(`Writing file: ${fullPath}`);
      
      // Ensure directory exists
      this.ensureDirectoryExists(path.dirname(fullPath));
      
      fs.writeFileSync(fullPath, content, 'utf8');
      const stats = this.getFileStats(fullPath);
      
      Logger.debug(`Successfully wrote file with size: ${content.length} bytes`);
      
      return {
        success: true,
        path: fullPath,
        stats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Logger.error(`Error writing file: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        path: filePath
      };
    }
  }
  
  /**
   * Ensure a directory exists, creating it if necessary
   */
  ensureDirectoryExists(dirPath: string): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        Logger.debug(`Creating directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Logger.error(`Error creating directory: ${errorMessage}`);
      return false;
    }
  }
  
  /**
   * Get statistics for a file
   */
  getFileStats(filePath: string): FileResult['stats'] {
    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;
      
      return {
        size: stats.size,
        modified: stats.mtime,
        lines
      };
    } catch (error) {
      Logger.warn(`Error getting file stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    }
  }
  
  /**
   * Find files recursively in a directory that match a pattern
   */
  findFiles(
    directoryPath: string, 
    pattern: RegExp, 
    excludePatterns: RegExp[] = [/node_modules/, /\.git/, /dist/, /build/, /coverage/]
  ): string[] {
    let results: string[] = [];
    
    try {
      const fullPath = path.resolve(directoryPath);
      if (!fs.existsSync(fullPath)) {
        Logger.warn(`Directory does not exist: ${fullPath}`);
        return results;
      }
      
      const items = fs.readdirSync(fullPath);
      
      for (const item of items) {
        const itemPath = path.join(fullPath, item);
        const excluded = excludePatterns.some(regex => regex.test(itemPath));
        
        if (excluded) {
          continue;
        }
        
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          results = results.concat(this.findFiles(itemPath, pattern, excludePatterns));
        } else if (pattern.test(item)) {
          results.push(itemPath);
        }
      }
      
      return results;
    } catch (error) {
      Logger.error(`Error finding files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return results;
    }
  }
}