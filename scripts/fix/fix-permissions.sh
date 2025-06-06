#!/bin/bash

# This script fixes the CLI error by directly creating a standalone implementation
# without requiring the TypeScript build process

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPS_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
MONO_ROOT="$(dirname "$APPS_DIR")"
CLI_DIR="$MONO_ROOT/packages/cli"
CLI_DIST_DIR="$CLI_DIR/dist"

echo "Setting up CLI directory structure at $CLI_DIR"

# Ensure CLI directory exists
mkdir -p "$CLI_DIR/src/commands"
mkdir -p "$CLI_DIR/src/utils"
mkdir -p "$CLI_DIR/dist/commands"
mkdir -p "$CLI_DIR/dist/utils"

# Create package.json if it doesn't exist
if [ ! -f "$CLI_DIR/package.json" ]; then
  echo "Creating package.json..."
  cat > "$CLI_DIR/package.json" << 'EOL'
{
  "name": "dhg-cli",
  "version": "1.0.0",
  "description": "CLI tools for DHG",
  "main": "dist/index.js",
  "bin": {
    "dhg-cli": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "commander": "^9.4.0",
    "glob": "^8.0.3"
  },
  "devDependencies": {
    "@types/node": "^18.7.14",
    "typescript": "^4.8.2"
  }
}
EOL
fi

# Create tsconfig.json if it doesn't exist
if [ ! -f "$CLI_DIR/tsconfig.json" ]; then
  echo "Creating tsconfig.json..."
  cat > "$CLI_DIR/tsconfig.json" << 'EOL'
{
  "compilerOptions": {
    "target": "es2018",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOL
fi

# Create main index.ts file
echo "Creating main TypeScript files..."
cat > "$CLI_DIR/src/index.ts" << 'EOL'
#!/usr/bin/env node
import { Command } from 'commander';
import { scanScriptsCommand } from './commands/scan-scripts';

// Ensure environment variables are set
if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Using SUPABASE_SERVICE_ROLE_KEY as VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const program = new Command()
    .name('ai-workflow')
    .description('CLI for AI workflows')
    .version('1.0.0');

// Register commands
program.addCommand(scanScriptsCommand);

// Parse command-line arguments
program.parse();
EOL

# Create logger.ts
cat > "$CLI_DIR/src/utils/logger.ts" << 'EOL'
export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

export class Logger {
  private static level: LogLevel = LogLevel.INFO;

  static getInstance(): Logger {
    return Logger as any;
  }
  
  static getWinstonLevel(): string {
    switch (Logger.level) {
      case LogLevel.DEBUG: return 'debug';
      case LogLevel.INFO: return 'info';
      case LogLevel.WARN: return 'warn';
      case LogLevel.ERROR: return 'error';
      default: return 'info';
    }
  }
  
  static setLevel(level: LogLevel): void {
    Logger.level = level;
  }
  
  static debug(message: string, data?: any): void {
    if (Logger.level <= LogLevel.DEBUG) {
      console.log(`${new Date().toISOString()} [debug]: ${message}`, data || '');
    }
  }
  
  static info(message: string, data?: any): void {
    if (Logger.level <= LogLevel.INFO) {
      console.log(`${new Date().toISOString()} [info]: ${message}`, data || '');
    }
  }
  
  static warn(message: string, data?: any): void {
    if (Logger.level <= LogLevel.WARN) {
      console.warn(`${new Date().toISOString()} [warn]: ${message}`, data || '');
    }
  }
  
  static error(message: string, data?: any): void {
    if (Logger.level <= LogLevel.ERROR) {
      console.error(`${new Date().toISOString()} [error]: ${message}`, data || '');
    }
  }
}
EOL

# Create error-handler.ts
cat > "$CLI_DIR/src/utils/error-handler.ts" << 'EOL'
import { Logger } from './logger';

export class AppError extends Error {
  constructor(
    public message: string,
    public code: string = 'UNKNOWN_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ErrorHandler {
  static handle(error: Error, exitProcess: boolean = false): void {
    if (error instanceof AppError) {
      Logger.error(`${error.code}: ${error.message}`, error.details);
    } else {
      Logger.error(`UNHANDLED_ERROR: ${error.message}`, error.stack);
    }

    if (exitProcess) {
      Logger.info('Exiting process due to error');
      process.exit(1);
    }
  }
  
  static async wrap<T>(fn: () => Promise<T>, errorMessage: string = 'Operation failed'): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      } else if (error instanceof Error) {
        throw new AppError(`${errorMessage}: ${error.message}`, 'OPERATION_FAILED');
      } else {
        throw new AppError(`${errorMessage}: Unknown error occurred`, 'UNKNOWN_ERROR');
      }
    }
  }
}
EOL

# Create scan-scripts.ts
cat > "$CLI_DIR/src/commands/scan-scripts.ts" << 'EOL'
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { Logger, LogLevel } from '../utils/logger';
import { ErrorHandler, AppError } from '../utils/error-handler';

// Import glob with fallback
let glob: any;
try {
  glob = require('glob');
} catch (e) {
  console.error("Error loading glob module:", e);
  glob = null;
}

interface ScriptFile {
  file_path: string;
  language?: string;
  size_bytes?: number;
  line_count?: number;
  last_modified?: string;
  error?: string;
}

/**
 * Command to scan for script files in the specified directory
 */
export const scanScriptsCommand = new Command('scan-scripts')
  .description('Scan for script files in the specified directory')
  .option('-d, --dir <directory>', 'Directory to scan', process.cwd())
  .option('-e, --extensions <extensions>', 'Comma-separated list of file extensions to include', 'js,ts,sh,py')
  .option('-x, --exclude <patterns>', 'Comma-separated list of patterns to exclude', 'node_modules,dist,build,.git')
  .option('-r, --recursive', 'Scan directories recursively', true)
  .option('-o, --output <file>', 'Output file path for scan results', 'scripts-scan-results.json')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    try {
      if (options.verbose) {
        Logger.setLevel(LogLevel.DEBUG);
      }
      Logger.info('Starting script scanning...');
      Logger.debug('Options:', options);

      // Parse options
      const dir = path.resolve(options.dir);
      const extensions = options.extensions.split(',').map(ext => ext.trim());
      const excludePatterns = options.exclude.split(',').map(pattern => pattern.trim());
      const outputPath = path.resolve(options.output);

      // Validate directory
      if (!fs.existsSync(dir)) {
        throw new Error(`Directory not found: ${dir}`);
      }

      Logger.info(`Scanning directory: ${dir}`);
      Logger.info(`Looking for files with extensions: ${extensions.join(', ')}`);
      Logger.info(`Excluding patterns: ${excludePatterns.join(', ')}`);

      // Scan for script files
      const scriptFiles = await scanScriptFiles(dir, extensions, excludePatterns, options.recursive);

      // Get basic info for each script file
      const scriptInfo: ScriptFile[] = await Promise.all(scriptFiles.map(async (filePath) => {
        try {
          const stats = fs.statSync(filePath);
          const language = getLanguageFromExtension(path.extname(filePath));
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').length;

          return {
            file_path: filePath,
            language,
            size_bytes: stats.size,
            line_count: lines,
            last_modified: stats.mtime.toISOString(),
          };
        } catch (error: any) {
          Logger.error(`Error processing file ${filePath}:`, error);
          return {
            file_path: filePath,
            error: error.message,
          };
        }
      }));

      // Write results to output file
      fs.writeFileSync(outputPath, JSON.stringify(scriptInfo, null, 2));

      Logger.info(`Found ${scriptFiles.length} script files`);
      Logger.info(`Scan results written to: ${outputPath}`);
    } catch (error: any) {
      ErrorHandler.handle(error, true);
    }
  });

/**
 * Recursively scan for files matching given extensions
 */
function findFilesRecursive(directoryPath: string, extensions: string[], excludePatterns: string[] = []): string[] {
  const results: string[] = [];
  
  if (!fs.existsSync(directoryPath)) {
    return results;
  }
  
  const items = fs.readdirSync(directoryPath);
  
  for (const item of items) {
    const itemPath = path.join(directoryPath, item);
    
    // Check if path should be excluded
    const shouldExclude = excludePatterns.some(pattern => itemPath.includes(pattern));
    if (shouldExclude) {
      continue;
    }
    
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      // Recursively search subdirectories
      const subDirResults = findFilesRecursive(itemPath, extensions, excludePatterns);
      results.push(...subDirResults);
    } else {
      // Check if file extension matches any of the target extensions
      if (extensions.some(ext => itemPath.endsWith(`.${ext}`))) {
        results.push(itemPath);
      }
    }
  }
  
  return results;
}

/**
 * Use glob if available, otherwise fall back to recursive directory scanning
 */
async function scanScriptFiles(directory: string, extensions: string[], excludePatterns: string[], recursive: boolean): Promise<string[]> {
  try {
    const fullPath = path.resolve(directory);
    
    if (!fs.existsSync(fullPath)) {
      Logger.warn(`Directory does not exist: ${fullPath}`);
      return [];
    }
    
    Logger.debug(`Finding files in ${fullPath}`);
    
    // If glob is not available, use recursive directory scanning
    if (!glob) {
      Logger.warn('Glob module not available, using fallback file search method');
      return findFilesRecursive(fullPath, extensions, excludePatterns);
    }
    
    const allResults: string[] = [];
    
    // Process each extension using glob
    for (const ext of extensions) {
      try {
        const pattern = `**/*.${ext}`;
        Logger.debug(`Searching for pattern: ${pattern}`);
        
        const globOptions = {
          cwd: fullPath,
          dot: false,
          nodir: true,
          absolute: true,
          ignore: excludePatterns.map(pattern => `**/${pattern}/**`)
        };
        
        // The glob API changed between versions, handle both cases
        let results: string[];
        if (typeof glob.glob === 'function') {
          // New glob API (v8+)
          results = await glob.glob(pattern, globOptions);
        } else if (typeof glob === 'function') {
          // Old glob API
          results = await new Promise<string[]>((resolve, reject) => {
            glob(pattern, globOptions, (err: Error | null, files: string[]) => {
              if (err) reject(err);
              else resolve(files);
            });
          });
        } else {
          throw new Error('Glob module has unexpected structure');
        }
        
        if (Array.isArray(results)) {
          Logger.debug(`Found ${results.length} ${ext} files`);
          allResults.push(...results);
        } else {
          Logger.warn(`Unexpected result type for ${ext} files, skipping: ${typeof results}`);
        }
      } catch (error) {
        Logger.error(`Error searching for ${ext} files:`, error);
      }
    }
    
    // Sort by modification time (newest first)
    if (allResults.length > 0) {
      try {
        interface SortableFile {
          path: string;
          mtime: number;
        }
        
        const sortedResults = await Promise.all(allResults.map(async (filePath) => {
          try {
            const stats = fs.statSync(filePath);
            return { path: filePath, mtime: stats.mtime.getTime() };
          } catch (error) {
            Logger.warn(`Error getting stats for ${filePath}:`, error);
            return { path: filePath, mtime: 0 };
          }
        }));
        
        sortedResults.sort((a, b) => b.mtime - a.mtime);
        return sortedResults.map((item) => item.path);
      } catch (error) {
        Logger.error('Error sorting results:', error);
        return allResults;
      }
    }
    
    return allResults;
  } catch (error) {
    Logger.error('Error scanning script files:', error);
    throw error;
  }
}

/**
 * Get the language name based on file extension
 */
function getLanguageFromExtension(extension: string): string {
  const extensionMap: Record<string, string> = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.sh': 'shell',
    '.bash': 'shell',
    '.php': 'php',
    '.rb': 'ruby',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.sql': 'sql',
  };
  return extensionMap[extension.toLowerCase()] || 'unknown';
}
EOL

# Create the dist versions
echo "Building the CLI dist files..."

# Create minimal index.js
cat > "$CLI_DIST_DIR/index.js" << 'EOL'
#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const scan_scripts_1 = require("./commands/scan-scripts");

// Ensure environment variables are set
if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Using SUPABASE_SERVICE_ROLE_KEY as VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const program = new commander_1.Command()
    .name('ai-workflow')
    .description('CLI for AI workflows')
    .version('1.0.0');

// Register commands
program.addCommand(scan_scripts_1.scanScriptsCommand);

// Parse command-line arguments
program.parse();
EOL
chmod +x "$CLI_DIST_DIR/index.js"

# Create minimal logger.js
cat > "$CLI_DIST_DIR/utils/logger.js" << 'EOL'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = exports.Logger = void 0;

var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));

class Logger {
    static getInstance() {
        return Logger;
    }
    
    static getWinstonLevel() {
        switch (Logger.level) {
            case LogLevel.DEBUG: return 'debug';
            case LogLevel.INFO: return 'info';
            case LogLevel.WARN: return 'warn';
            case LogLevel.ERROR: return 'error';
            default: return 'info';
        }
    }
    
    static setLevel(level) {
        Logger.level = level;
    }
    
    static debug(message, data) {
        if (Logger.level <= LogLevel.DEBUG) {
            console.log(`${new Date().toISOString()} [debug]: ${message}`, data || '');
        }
    }
    
    static info(message, data) {
        if (Logger.level <= LogLevel.INFO) {
            console.log(`${new Date().toISOString()} [info]: ${message}`, data || '');
        }
    }
    
    static warn(message, data) {
        if (Logger.level <= LogLevel.WARN) {
            console.warn(`${new Date().toISOString()} [warn]: ${message}`, data || '');
        }
    }
    
    static error(message, data) {
        if (Logger.level <= LogLevel.ERROR) {
            console.error(`${new Date().toISOString()} [error]: ${message}`, data || '');
        }
    }
}

Logger.level = LogLevel.INFO;
exports.Logger = Logger;
EOL

# Create minimal error-handler.js
cat > "$CLI_DIST_DIR/utils/error-handler.js" << 'EOL'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.AppError = void 0;
const logger_1 = require("./logger");

class AppError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;

class ErrorHandler {
    static handle(error, exitProcess = false) {
        if (error instanceof AppError) {
            logger_1.Logger.error(`${error.code}: ${error.message}`, error.details);
        }
        else {
            logger_1.Logger.error(`UNHANDLED_ERROR: ${error.message}`, error.stack);
        }
        if (exitProcess) {
            logger_1.Logger.info('Exiting process due to error');
            process.exit(1);
        }
    }
    
    static async wrap(fn, errorMessage = 'Operation failed') {
        try {
            return await fn();
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            else if (error instanceof Error) {
                throw new AppError(`${errorMessage}: ${error.message}`, 'OPERATION_FAILED');
            }
            else {
                throw new AppError(`${errorMessage}: Unknown error occurred`, 'UNKNOWN_ERROR');
            }
        }
    }
}
exports.ErrorHandler = ErrorHandler;
EOL

# Create scan-scripts.js
cat > "$CLI_DIST_DIR/commands/scan-scripts.js" << 'EOL'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanScriptsCommand = void 0;
const commander_1 = require("commander");
const path = require("path");
const fs = require("fs");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../utils/error-handler");

// Import glob with fallback
let glob;
try {
    glob = require("glob");
} catch (e) {
    console.error("Error loading glob module:", e);
    glob = null;
}

/**
 * Command to scan for script files in the specified directory
 */
exports.scanScriptsCommand = new commander_1.Command('scan-scripts')
    .description('Scan for script files in the specified directory')
    .option('-d, --dir <directory>', 'Directory to scan', process.cwd())
    .option('-e, --extensions <extensions>', 'Comma-separated list of file extensions to include', 'js,ts,sh,py')
    .option('-x, --exclude <patterns>', 'Comma-separated list of patterns to exclude', 'node_modules,dist,build,.git')
    .option('-r, --recursive', 'Scan directories recursively', true)
    .option('-o, --output <file>', 'Output file path for scan results', 'scripts-scan-results.json')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(async (options) => {
    try {
        if (options.verbose) {
            logger_1.Logger.setLevel(logger_1.LogLevel.DEBUG);
        }
        logger_1.Logger.info('Starting script scanning...');
        logger_1.Logger.debug('Options:', options);
        // Parse options
        const dir = path.resolve(options.dir);
        const extensions = options.extensions.split(',').map(ext => ext.trim());
        const excludePatterns = options.exclude.split(',').map(pattern => pattern.trim());
        const outputPath = path.resolve(options.output);
        // Validate directory
        if (!fs.existsSync(dir)) {
            throw new Error(`Directory not found: ${dir}`);
        }
        logger_1.Logger.info(`Scanning directory: ${dir}`);
        logger_1.Logger.info(`Looking for files with extensions: ${extensions.join(', ')}`);
        logger_1.Logger.info(`Excluding patterns: ${excludePatterns.join(', ')}`);
        // Scan for script files
        const scriptFiles = await scanScriptFiles(dir, extensions, excludePatterns, options.recursive);
        // Get basic info for each script file
        const scriptInfo = await Promise.all(scriptFiles.map(async (filePath) => {
            try {
                const stats = fs.statSync(filePath);
                const language = getLanguageFromExtension(path.extname(filePath));
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n').length;
                return {
                    file_path: filePath,
                    language,
                    size_bytes: stats.size,
                    line_count: lines,
                    last_modified: stats.mtime.toISOString(),
                };
            }
            catch (error) {
                logger_1.Logger.error(`Error processing file ${filePath}:`, error);
                return {
                    file_path: filePath,
                    error: error.message,
                };
            }
        }));
        // Write results to output file
        fs.writeFileSync(outputPath, JSON.stringify(scriptInfo, null, 2));
        logger_1.Logger.info(`Found ${scriptFiles.length} script files`);
        logger_1.Logger.info(`Scan results written to: ${outputPath}`);
    }
    catch (error) {
        error_handler_1.ErrorHandler.handle(error, true);
    }
});

/**
 * Recursively scan for files matching given extensions
 */
function findFilesRecursive(directoryPath, extensions, excludePatterns = []) {
    const results = [];
    
    if (!fs.existsSync(directoryPath)) {
        return results;
    }
    
    const items = fs.readdirSync(directoryPath);
    
    for (const item of items) {
        const itemPath = path.join(directoryPath, item);
        
        // Check if path should be excluded
        const shouldExclude = excludePatterns.some(pattern => itemPath.includes(pattern));
        if (shouldExclude) {
            continue;
        }
        
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
            // Recursively search subdirectories
            const subDirResults = findFilesRecursive(itemPath, extensions, excludePatterns);
            results.push(...subDirResults);
        } else {
            // Check if file extension matches any of the target extensions
            if (extensions.some(ext => itemPath.endsWith(`.${ext}`))) {
                results.push(itemPath);
            }
        }
    }
    
    return results;
}

/**
 * Use glob if available, otherwise fall back to recursive directory scanning
 */
async function scanScriptFiles(directory, extensions, excludePatterns, recursive) {
    try {
        const fullPath = path.resolve(directory);
        
        if (!fs.existsSync(fullPath)) {
            logger_1.Logger.warn(`Directory does not exist: ${fullPath}`);
            return [];
        }
        
        logger_1.Logger.debug(`Finding files in ${fullPath}`);
        
        // If glob is not available, use recursive directory scanning
        if (!glob) {
            logger_1.Logger.warn('Glob module not available, using fallback file search method');
            return findFilesRecursive(fullPath, extensions, excludePatterns);
        }
        
        const allResults = [];
        
        // Process each extension using glob
        for (const ext of extensions) {
            try {
                const pattern = `**/*.${ext}`;
                logger_1.Logger.debug(`Searching for pattern: ${pattern}`);
                
                const globOptions = {
                    cwd: fullPath,
                    dot: false,
                    nodir: true,
                    absolute: true,
                    ignore: excludePatterns.map(pattern => `**/${pattern}/**`)
                };
                
                // The glob API changed between versions, handle both cases
                let results;
                if (typeof glob.glob === 'function') {
                    // New glob API (v8+)
                    results = await glob.glob(pattern, globOptions);
                } else if (typeof glob === 'function') {
                    // Old glob API
                    results = await new Promise((resolve, reject) => {
                        glob(pattern, globOptions, (err, files) => {
                            if (err) reject(err);
                            else resolve(files);
                        });
                    });
                } else {
                    throw new Error('Glob module has unexpected structure');
                }
                
                if (Array.isArray(results)) {
                    logger_1.Logger.debug(`Found ${results.length} ${ext} files`);
                    allResults.push(...results);
                } else {
                    logger_1.Logger.warn(`Unexpected result type for ${ext} files, skipping: ${typeof results}`);
                }
            } catch (error) {
                logger_1.Logger.error(`Error searching for ${ext} files:`, error);
            }
        }
        
        // Sort by modification time (newest first)
        if (allResults.length > 0) {
            try {
                const sortedResults = await Promise.all(allResults.map(async (filePath) => {
                    try {
                        const stats = fs.statSync(filePath);
                        return { path: filePath, mtime: stats.mtime.getTime() };
                    } catch (error) {
                        logger_1.Logger.warn(`Error getting stats for ${filePath}:`, error);
                        return { path: filePath, mtime: 0 };
                    }
                }));
                
                sortedResults.sort((a, b) => b.mtime - a.mtime);
                return sortedResults.map((item) => item.path);
            } catch (error) {
                logger_1.Logger.error('Error sorting results:', error);
                return allResults;
            }
        }
        
        return allResults;
    } catch (error) {
        logger_1.Logger.error('Error scanning script files:', error);
        throw error;
    }
}

/**
 * Get the language name based on file extension
 */
function getLanguageFromExtension(extension) {
    const extensionMap = {
        '.js': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.jsx': 'javascript',
        '.py': 'python',
        '.sh': 'shell',
        '.bash': 'shell',
        '.php': 'php',
        '.rb': 'ruby',
        '.java': 'java',
        '.go': 'go',
        '.rs': 'rust',
        '.c': 'c',
        '.cpp': 'cpp',
        '.cs': 'csharp',
        '.sql': 'sql',
    };
    return extensionMap[extension.toLowerCase()] || 'unknown';
}
EOL

# Install dependencies
cd "$CLI_DIR" && npm install commander glob

echo "✅ CLI has been set up successfully!"
echo "The scan-scripts command should now work correctly."
echo "You can now run: ./run-ai-analyze.sh"