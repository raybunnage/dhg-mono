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
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

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

  Logger.info(`Executing JavaScript file finder: ${jsScriptPath}`);

  return new Promise((resolve, reject) => {
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
    Logger.info('Running JavaScript-based MP4 file finder...');
    await runJSFileFinder();
    Logger.info('JavaScript file finder completed successfully.');
  } catch (error: any) {
    Logger.error(`Error running JavaScript file finder: ${error.message}`);
    process.exit(1);
  }
}

// Export default function for CLI integration
export default async function(cmdOptions: any): Promise<void> {
  if (cmdOptions.verbose) {
    Logger.setLevel(LogLevel.DEBUG);
  }
  await main();
}

// If script is run directly (not imported)
if (require.main === module) {
  main().catch((error) => {
    Logger.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
}