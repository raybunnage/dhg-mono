/**
 * Utility functions for handling file operations
 */

import path from 'path';

/**
 * Validates that a file path is safe to use
 * - Ensures the path is within the project directory
 * - Ensures only markdown files are accessed
 * - Normalizes the path
 * 
 * @param filePath The file path to validate
 * @param basePath The base path to restrict to (defaults to process.cwd())
 * @returns The normalized safe file path or null if invalid
 */
export function getSafePath(filePath: string, basePath: string = process.cwd()): string | null {
  try {
    // Normalize the path (remove '..' segments, etc.)
    const normalizedPath = path.normalize(filePath).replace(/^\/+/, '');
    
    // Only allow markdown files
    if (!normalizedPath.endsWith('.md') && !normalizedPath.endsWith('.mdx')) {
      console.warn(`Rejected non-markdown file: ${filePath}`);
      return null;
    }
    
    // Construct the full path
    const fullPath = path.join(basePath, normalizedPath);
    
    // Ensure the path is within the base directory
    if (!fullPath.startsWith(basePath)) {
      console.warn(`Rejected directory traversal attempt: ${filePath}`);
      return null;
    }
    
    return fullPath;
  } catch (error) {
    console.error('Error validating file path:', error);
    return null;
  }
}

/**
 * Gets the project root directory
 * This works in different environments by trying multiple approaches
 */
export function getProjectRoot(): string {
  try {
    // First try process.cwd()
    let root = process.cwd();
    
    // If that doesn't work, try __dirname if available
    if (typeof __dirname !== 'undefined') {
      // Navigate up from the current file's directory
      root = path.resolve(__dirname, '..');
    }
    
    return root;
  } catch (error) {
    console.error('Error getting project root:', error);
    return process.cwd(); // Fallback to current working directory
  }
}

/**
 * Extracts title from markdown content
 * Looks for the first heading in the markdown content
 */
export function extractTitleFromMarkdown(content: string): string {
  try {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : 'Untitled Document';
  } catch (error) {
    console.error('Error extracting title from markdown:', error);
    return 'Untitled Document';
  }
}