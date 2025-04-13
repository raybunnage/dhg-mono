/**
 * File Metadata Service
 * 
 * Handles file metadata operations for Google Drive, 
 * including file signature generation, path management,
 * and content type detection.
 */
import path from 'path';

export interface PathOptions {
  separator?: string;
  includeRoot?: boolean;
  trimTrailing?: boolean;
}

/**
 * File Metadata Service
 * Standardized service for handling file metadata across the application
 */
export class FileMetadataService {
  private static instance: FileMetadataService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): FileMetadataService {
    if (!FileMetadataService.instance) {
      FileMetadataService.instance = new FileMetadataService();
    }
    return FileMetadataService.instance;
  }

  /**
   * Generate a file signature based on name and modification time
   * This signature can be used to detect when files are renamed or modified
   * 
   * @param fileName The name of the file
   * @param modifiedTime The modification time (ISO string)
   * @returns A unique signature for the file
   */
  public generateFileSignature(fileName: string, modifiedTime?: string): string {
    const cleanName = this.sanitizeForSignature(fileName);
    const cleanTime = modifiedTime ? this.sanitizeForSignature(modifiedTime) : '';
    return `${cleanName}${cleanTime}`;
  }

  /**
   * Sanitize a string for use in a file signature
   * Removes all non-alphanumeric characters
   * 
   * @param input The string to sanitize
   * @returns Sanitized string with only alphanumeric characters
   */
  private sanitizeForSignature(input: string): string {
    return input.replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Convert a path to an array of path segments
   * 
   * @param filePath The file path to convert
   * @returns An array of path segments
   */
  public pathToArray(filePath: string): string[] {
    // Split by path separator and filter out empty segments
    const segments = filePath.split('/').filter(Boolean);
    
    // Handle absolute paths by adding empty string at beginning
    if (filePath.startsWith('/')) {
      segments.unshift('');
    }
    
    return segments;
  }

  /**
   * Create a normalized file path
   * 
   * @param parentPath The parent path
   * @param fileName The file name
   * @param options Path options
   * @returns A normalized path
   */
  public createFilePath(
    parentPath: string | null, 
    fileName: string,
    options: PathOptions = {}
  ): string {
    const { 
      separator = '/',
      includeRoot = true,
      trimTrailing = true
    } = options;
    
    if (!parentPath) {
      return fileName;
    }
    
    // Ensure parent path has trailing separator
    let normalizedParent = parentPath;
    if (!normalizedParent.endsWith(separator)) {
      normalizedParent += separator;
    }
    
    // Ensure proper formatting
    const fullPath = `${normalizedParent}${fileName}`;
    
    // Add root slash if needed
    if (includeRoot && !fullPath.startsWith(separator)) {
      return `${separator}${fullPath}`;
    }
    
    // Remove trailing slash if needed
    if (trimTrailing && fullPath.endsWith(separator)) {
      return fullPath.slice(0, -1);
    }
    
    return fullPath;
  }

  /**
   * Update file path when a file is renamed
   * 
   * @param currentPath The current file path
   * @param newFileName The new file name
   * @returns Updated file path
   */
  public updatePathOnRename(currentPath: string, newFileName: string): string {
    if (!currentPath) return newFileName;
    
    const pathParts = currentPath.split('/');
    pathParts[pathParts.length - 1] = newFileName;
    return pathParts.join('/');
  }

  /**
   * Calculate the path depth
   * 
   * @param filePath The file path
   * @param countRoot Whether to count the root as a level
   * @returns The path depth
   */
  public calculatePathDepth(filePath: string, countRoot: boolean = true): number {
    const segments = this.pathToArray(filePath);
    
    // For absolute paths, first segment is empty string
    // If countRoot is false, we don't count the root level
    if (filePath.startsWith('/') && !countRoot) {
      return Math.max(0, segments.length - 1);
    }
    
    return segments.length;
  }

  /**
   * Get the parent path from a file path
   * 
   * @param filePath The file path
   * @returns The parent path
   */
  public getParentPath(filePath: string): string {
    if (!filePath) return '';
    
    // Use built-in path functions to handle this correctly
    const parentPath = path.dirname(filePath);
    
    // Special case: root path
    if (parentPath === '.') return '';
    
    return parentPath;
  }
}

// Export default singleton instance
const fileMetadataService = FileMetadataService.getInstance();
export default fileMetadataService;