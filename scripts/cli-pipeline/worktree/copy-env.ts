#!/usr/bin/env ts-node

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

interface CommandOptions {
  app?: string;
  sourceRoot?: string;
  targetRoot?: string;
}

async function copyEnvFiles(options: CommandOptions): Promise<void> {
  try {
    // Get the parent directory (dhg-mono) from current worktree location
    const currentDir = process.cwd();
    const sourceRoot = options.sourceRoot || path.resolve(currentDir, '../dhg-mono');
    const targetRoot = options.targetRoot || currentDir;

    console.log(`Source directory: ${sourceRoot}`);
    console.log(`Target directory: ${targetRoot}`);

    // Copy root .env.development
    const rootEnvSource = path.join(sourceRoot, '.env.development');
    const rootEnvTarget = path.join(targetRoot, '.env.development');

    if (!existsSync(rootEnvSource)) {
      console.error(`Error: Source .env.development not found at ${rootEnvSource}`);
      process.exit(1);
    }

    await fs.copyFile(rootEnvSource, rootEnvTarget);
    console.log(`✓ Copied root .env.development`);

    // Copy app-specific .env.development if specified
    if (options.app) {
      const appEnvSource = path.join(sourceRoot, 'apps', options.app, '.env.development');
      const appEnvTarget = path.join(targetRoot, 'apps', options.app, '.env.development');

      if (!existsSync(appEnvSource)) {
        console.error(`Error: App .env.development not found at ${appEnvSource}`);
        process.exit(1);
      }

      // Ensure the target app directory exists
      const targetAppDir = path.dirname(appEnvTarget);
      await fs.mkdir(targetAppDir, { recursive: true });

      await fs.copyFile(appEnvSource, appEnvTarget);
      console.log(`✓ Copied ${options.app} .env.development`);
    }

    console.log('\nEnvironment files copied successfully!');

  } catch (error) {
    console.error('Error copying environment files:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: CommandOptions = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--app' && args[i + 1]) {
    options.app = args[i + 1];
    i++;
  } else if (args[i] === '--source' && args[i + 1]) {
    options.sourceRoot = args[i + 1];
    i++;
  } else if (args[i] === '--target' && args[i + 1]) {
    options.targetRoot = args[i + 1];
    i++;
  } else if (args[i] === '--help') {
    console.log(`
Usage: copy-env [options]

Options:
  --app <name>      Name of the app to copy .env.development from (e.g., dhg-audio)
  --source <path>   Source root directory (defaults to ../dhg-mono)
  --target <path>   Target root directory (defaults to current directory)
  --help           Show this help message

Examples:
  copy-env                        # Copy only root .env.development
  copy-env --app dhg-audio       # Copy root and dhg-audio .env.development files
`);
    process.exit(0);
  }
}

copyEnvFiles(options);