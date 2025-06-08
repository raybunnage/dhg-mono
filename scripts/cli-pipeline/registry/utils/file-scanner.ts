import * as fs from 'fs';
import * as path from 'path';
import { glob, globSync } from 'glob';

// Get the monorepo root directory
export const getMonorepoRoot = (): string => {
  return path.resolve(__dirname, '../../../..');
};

// Common file patterns
export const FILE_PATTERNS = {
  typescript: '**/*.{ts,tsx}',
  javascript: '**/*.{js,jsx}',
  package_json: '**/package.json',
  service_files: '**/*-{service,adapter,utils,util,helper}.{ts,js}',
  cli_scripts: '**/*-cli.sh'
};

// Ignore patterns for scanning
export const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.vite/**',
  '**/coverage/**',
  '**/*.test.{ts,js}',
  '**/*.spec.{ts,js}',
  '**/.archived_*/**'
];

// Scan directory for files matching pattern
export async function scanDirectory(
  directory: string,
  pattern: string = FILE_PATTERNS.typescript,
  ignorePatterns: string[] = IGNORE_PATTERNS
): Promise<string[]> {
  const absoluteDir = path.isAbsolute(directory) 
    ? directory 
    : path.join(getMonorepoRoot(), directory);
    
  // Check if directory exists
  if (!fs.existsSync(absoluteDir)) {
    console.error(`❌ Directory does not exist: ${absoluteDir}`);
    return [];
  }
  
  // Debug: List what's actually in the directory
  try {
    const dirContents = fs.readdirSync(absoluteDir);
    console.log(`📂 Directory contents (${dirContents.length} items):`, dirContents.slice(0, 5));
  } catch (err) {
    console.error(`❌ Cannot read directory contents:`, err);
  }
  
  try {
    // Use custom recursive file scanning as a fallback
    const files: string[] = [];
    
    function scanRecursively(dirPath: string) {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Check if directory should be ignored
          const shouldIgnore = ignorePatterns.some(pattern => {
            // Simple pattern matching for common ignore patterns
            if (pattern === '**/node_modules/**' && item === 'node_modules') return true;
            if (pattern === '**/dist/**' && item === 'dist') return true;
            if (pattern === '**/build/**' && item === 'build') return true;
            if (pattern === '**/.next/**' && item === '.next') return true;
            if (pattern === '**/.vite/**' && item === '.vite') return true;
            if (pattern === '**/coverage/**' && item === 'coverage') return true;
            if (pattern === '**/.archived_*/**' && item.startsWith('.archived_')) return true;
            return false;
          });
          
          if (!shouldIgnore) {
            scanRecursively(fullPath);
          }
        } else if (stat.isFile()) {
          // Check if file matches pattern
          const ext = path.extname(item);
          let shouldInclude = false;
          
          if (pattern === '*') {
            shouldInclude = true;
          } else {
            // Parse bracket notation like {ts,tsx,js,jsx}
            const bracketMatch = pattern.match(/\{([^}]+)\}/);
            if (bracketMatch) {
              const extensions = bracketMatch[1].split(',').map(e => e.trim());
              shouldInclude = extensions.some(extension => ext === `.${extension}`);
            } else if (pattern.includes('*.ts')) {
              shouldInclude = ext === '.ts';
            } else if (pattern.includes('*.js')) {
              shouldInclude = ext === '.js';
            } else if (pattern.includes('*.tsx')) {
              shouldInclude = ext === '.tsx';
            } else if (pattern.includes('*.jsx')) {
              shouldInclude = ext === '.jsx';
            }
          }
          
          // Additional filtering for test files
          if (shouldInclude) {
            const isTestFile = item.includes('.test.') || item.includes('.spec.');
            if (!isTestFile) {
              files.push(fullPath);
            }
          }
        }
      }
    }
    
    scanRecursively(absoluteDir);
    
    console.log(`📁 scanDirectory found ${files.length} files in ${absoluteDir} with pattern ${pattern}`);
    return files;
  } catch (error) {
    console.error(`❌ Error scanning directory ${absoluteDir}:`, error);
    return [];
  }
}

// Read file contents safely
export function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Read and parse JSON file
export function readJsonFile<T = any>(filePath: string): T | null {
  const content = readFileSafe(filePath);
  if (!content) return null;
  
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing JSON from ${filePath}:`, error);
    return null;
  }
}

// Get relative path from monorepo root
export function getRelativePath(absolutePath: string): string {
  return path.relative(getMonorepoRoot(), absolutePath);
}

// Extract service name from file path
export function extractServiceName(filePath: string): string {
  const basename = path.basename(filePath, path.extname(filePath));
  
  // Remove common suffixes
  const suffixes = ['-service', '-adapter', '-utils', '-util', '-helper'];
  let serviceName = basename;
  
  for (const suffix of suffixes) {
    if (serviceName.endsWith(suffix)) {
      serviceName = serviceName.slice(0, -suffix.length);
      break;
    }
  }
  
  return serviceName;
}

// Determine service type from filename
export function getServiceType(filePath: string): string {
  const basename = path.basename(filePath).toLowerCase();
  
  if (basename.includes('-service.')) return 'singleton';
  if (basename.includes('-adapter.')) return 'adapter';
  if (basename.includes('-util') || basename.includes('-utils.')) return 'utility';
  if (basename.includes('-helper.')) return 'helper';
  
  return 'utility'; // default
}

// Check if file contains singleton pattern
export function isSingletonService(content: string): boolean {
  const singletonPatterns = [
    /getInstance\s*\(/,
    /private\s+static\s+instance/,
    /static\s+instance\s*:/,
    /\.instance\s*=\s*new/
  ];
  
  return singletonPatterns.some(pattern => pattern.test(content));
}

// Extract export type from file content
export function getExportType(content: string): string {
  // Check for class exports
  if (/export\s+(default\s+)?class\s+\w+/.test(content)) {
    return 'class';
  }
  
  // Check for function exports
  if (/export\s+(default\s+)?function\s+\w+/.test(content) ||
      /export\s+const\s+\w+\s*=\s*\(/.test(content)) {
    return 'function';
  }
  
  // Check for object exports
  if (/export\s+(default\s+)?{\s*\w+/.test(content) ||
      /export\s+const\s+\w+\s*=\s*{/.test(content)) {
    return 'object';
  }
  
  // Check for constant exports
  if (/export\s+const\s+\w+\s*=/.test(content)) {
    return 'constant';
  }
  
  return 'unknown';
}

// Get list of subdirectories
export function getSubdirectories(directory: string): string[] {
  const absoluteDir = path.isAbsolute(directory)
    ? directory
    : path.join(getMonorepoRoot(), directory);
    
  try {
    return fs.readdirSync(absoluteDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => !name.startsWith('.'));
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error);
    return [];
  }
}

// Check if directory exists
export function directoryExists(directory: string): boolean {
  const absoluteDir = path.isAbsolute(directory)
    ? directory
    : path.join(getMonorepoRoot(), directory);
    
  try {
    return fs.statSync(absoluteDir).isDirectory();
  } catch {
    return false;
  }
}