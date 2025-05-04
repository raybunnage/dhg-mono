#!/usr/bin/env ts-node
/**
 * Run Shell Check Command
 * 
 * This command integrates the shell-based mp4 file checker into the CLI pipeline.
 * It wraps the shell script to check for MP4 files in sources_google that might be 
 * missing in file_types/mp4 directory.
 * 
 * Usage:
 *   run-shell-check [options]
 * 
 * Options:
 *   --verbose         Show detailed output
 *   --script <n>   Specify which shell script to run (without .sh extension)
 * 
 * Available Scripts:
 *   mp4-files-check         - Comprehensive check for all mp4 files and their status
 *   check-missing-mp4-files - Simple check of missing mp4 files in file_types/mp4
 *   compare-mp4-files       - Compare mp4 files in database vs. filesystem
 *   find-missing-mp4-files  - Find mp4 files missing from the file system
 *   find-mp4-missing-files  - Another variant of the missing file finder
 *   mp4-files-summary       - Generate summary of mp4 files in the system
 */

import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';

// Simple logger implementation to avoid TypeScript issues with external imports
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

class SimpleLogger {
  private static level: LogLevel = LogLevel.INFO;

  static setLevel(newLevel: LogLevel): void {
    this.level = newLevel;
  }

  static error(message: string): void {
    console.error(`${new Date().toISOString()} [error]: ${message}`);
  }

  static warn(message: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`${new Date().toISOString()} [warn]: ${message}`);
    }
  }

  static info(message: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`${new Date().toISOString()} [info]: ${message}`);
    }
  }

  static debug(message: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`${new Date().toISOString()} [debug]: ${message}`);
    }
  }

  private static shouldLog(messageLevel: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(messageLevel) <= levels.indexOf(this.level);
  }
}

// Initialize logger
SimpleLogger.setLevel(LogLevel.INFO);

// Process command-line arguments
const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose'),
  script: getOptionValue(args, '--script') || 'mp4-files-check'
};

/**
 * Get value for a command line option
 */
function getOptionValue(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

/**
 * Run the shell script checker
 */
async function runShellChecker(): Promise<void> {
  const scriptName = `${options.script}.sh`;
  const shellScriptPath = path.join(
    __dirname, 
    '../shell-scripts',
    scriptName
  );

  // Check if script exists
  if (!fs.existsSync(shellScriptPath)) {
    throw new Error(`Shell script not found: ${shellScriptPath}`);
  }

  SimpleLogger.info(`Executing shell script: ${shellScriptPath}`);

  return new Promise((resolve, reject) => {
    const childProcess = spawn('bash', [shellScriptPath], {
      stdio: 'inherit' // Output directly to parent process
    });

    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    childProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    SimpleLogger.info(`Running shell-based MP4 file checker (${options.script})...`);
    await runShellChecker();
    SimpleLogger.info('Shell script completed successfully.');
  } catch (error: any) {
    SimpleLogger.error(`Error running shell script: ${error.message}`);
    process.exit(1);
  }
}

// Export default function for CLI integration
export default async function(cmdOptions: Record<string, unknown>): Promise<void> {
  // Apply command options if provided
  if (cmdOptions.verbose) {
    options.verbose = true;
    SimpleLogger.setLevel(LogLevel.DEBUG);
  }
  
  if (cmdOptions.script && typeof cmdOptions.script === 'string') {
    options.script = cmdOptions.script;
  }
  
  await main();
}

// If script is run directly (not imported)
if (require.main === module) {
  main().catch((error) => {
    SimpleLogger.error(`Unhandled error: ${error.toString()}`);
    process.exit(1);
  });
}