#!/usr/bin/env ts-node
/**
 * Find Missing JS Files Command
 * 
 * This command integrates the JavaScript-based mp4 file checker into the CLI pipeline.
 * It wraps the Node.js script to check for MP4 files in sources_google that might be 
 * missing in file_types/mp4 directory.
 * 
 * This is a legacy implementation converted from a standalone script to fit into
 * the CLI pipeline architecture. It uses a different approach than the TypeScript
 * implementation in check-media-files.ts but provides similar functionality.
 * 
 * Usage:
 *   find-missing-js-files [options]
 * 
 * Options:
 *   --verbose       Show detailed output
 */

import * as path from 'path';
import { fork } from 'child_process';

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
  verbose: args.includes('--verbose')
};

/**
 * Run the JavaScript file finder
 */
async function runJSFileFinder(): Promise<void> {
  const jsScriptPath = path.join(
    __dirname, 
    '../js-scripts/find-missing-mp4-files.js'
  );

  SimpleLogger.info(`Executing JavaScript file finder: ${jsScriptPath}`);

  return new Promise<void>((resolve, reject) => {
    const childProcess = fork(jsScriptPath, [], {
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
    SimpleLogger.info('Running JavaScript-based MP4 file finder...');
    await runJSFileFinder();
    SimpleLogger.info('JavaScript file finder completed successfully.');
  } catch (error: any) {
    SimpleLogger.error(`Error running JavaScript file finder: ${error.message}`);
    process.exit(1);
  }
}

// Export default function for CLI integration
export default async function(cmdOptions: Record<string, unknown>): Promise<void> {
  if (cmdOptions.verbose) {
    SimpleLogger.setLevel(LogLevel.DEBUG);
  }
  await main();
}

// If script is run directly (not imported)
if (require.main === module) {
  main().catch((error) => {
    SimpleLogger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}