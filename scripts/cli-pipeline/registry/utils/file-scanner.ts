import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

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
    
  const files = await glob(pattern, {
    cwd: absoluteDir,
    ignore: ignorePatterns,
    absolute: true
  });
  
  return files;
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