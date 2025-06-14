/**
 * Common file and filesystem utilities
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate SHA-256 hash of file contents
 * @param filePath - Path to file
 * @returns Hash string
 */
export async function generateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Generate hash of string content
 * @param content - String content
 * @returns Hash string
 */
export function generateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Check if file exists
 * @param filePath - Path to check
 * @returns True if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 * @param filePath - Path to file
 * @returns File size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.promises.stat(filePath);
  return stats.size;
}

/**
 * Get file extension without dot
 * @param filePath - File path or name
 * @returns Extension without dot
 */
export function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

/**
 * Get safe filename by removing special characters
 * @param filename - Original filename
 * @returns Safe filename
 */
export function getSafeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Create directory if it doesn't exist
 * @param dirPath - Directory path
 * @returns True if created or already exists
 */
export async function ensureDirectory(dirPath: string): Promise<boolean> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error);
    return false;
  }
}

/**
 * Read JSON file
 * @param filePath - Path to JSON file
 * @returns Parsed JSON object
 */
export async function readJsonFile<T = any>(filePath: string): Promise<T> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write JSON file
 * @param filePath - Path to JSON file
 * @param data - Data to write
 * @param pretty - Pretty print JSON (default: true)
 */
export async function writeJsonFile(filePath: string, data: any, pretty: boolean = true): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

/**
 * Get all files matching pattern recursively
 * @param dir - Directory to search
 * @param pattern - RegExp pattern to match
 * @returns Array of file paths
 */
export async function findFiles(dir: string, pattern: RegExp): Promise<string[]> {
  const files: string[] = [];
  
  async function walk(currentDir: string) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await walk(fullPath);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return files;
}