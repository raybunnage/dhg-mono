import { Command } from 'commander';
import path from 'path';
import * as fs from 'fs';
import * as fileService from '../services/file-service';
import { Logger, LogLevel } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';

interface ScriptScanOptions {
  dir: string;
  extensions: string;
  exclude: string;
  recursive: boolean;
  output: string;
  verbose: boolean;
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
  .action(async (options: ScriptScanOptions) => {
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
      const scriptInfo = await Promise.all(
        scriptFiles.map(async (filePath) => {
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
          } catch (error) {
            Logger.error(`Error processing file ${filePath}:`, error);
            return {
              file_path: filePath,
              error: (error as Error).message,
            };
          }
        })
      );

      // Write results to output file
      fs.writeFileSync(outputPath, JSON.stringify(scriptInfo, null, 2));

      Logger.info(`Found ${scriptFiles.length} script files`);
      Logger.info(`Scan results written to: ${outputPath}`);

    } catch (error) {
      ErrorHandler.handle(error as Error, true);
    }
  });

/**
 * Scan for script files in the given directory
 */
async function scanScriptFiles(
  directory: string,
  extensions: string[],
  excludePatterns: string[],
  recursive: boolean
): Promise<string[]> {
  try {
    // Create file service instance
    const fs = new fileService.FileService();
    
    // Use fileService to scan for files
    const files = await fs.findFiles({
      directory,
      includePatterns: extensions.map(ext => `**/*.${ext}`),
      excludePatterns,
      recursive,
    });

    return files;
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