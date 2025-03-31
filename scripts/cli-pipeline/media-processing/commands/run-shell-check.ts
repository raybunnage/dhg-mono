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
 *   --verbose       Show detailed output
 *   --script <name> Specify which shell script to run (without .sh extension)
 */

import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';
import * as fs from 'fs';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

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

  Logger.info(`Executing shell script: ${shellScriptPath}`);

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
    Logger.info(`Running shell-based MP4 file checker (${options.script})...`);
    await runShellChecker();
    Logger.info('Shell script completed successfully.');
  } catch (error: any) {
    Logger.error(`Error running shell script: ${error.message}`);
    process.exit(1);
  }
}

// Export default function for CLI integration
export default async function(cmdOptions: any): Promise<void> {
  // Apply command options if provided
  if (cmdOptions.verbose) {
    options.verbose = true;
    Logger.setLevel(LogLevel.DEBUG);
  }
  
  if (cmdOptions.script) {
    options.script = cmdOptions.script;
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