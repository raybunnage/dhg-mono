#!/usr/bin/env ts-node
/**
 * Direct implementation of add-expert command
 * 
 * This is a simplified, direct implementation to work around commander.js option parsing issues
 */

import { addExpert } from './commands/add-expert';

// Parse command line arguments
const args = process.argv.slice(2);
const options: {
  expertName?: string;
  fullName?: string;
  mnemonic?: string;
  isInCoreGroup?: boolean;
  metadata?: Record<string, any>;
  dryRun?: boolean;
  verbose?: boolean;
} = {
  isInCoreGroup: false,
  dryRun: false,
  verbose: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--expert-name' && i + 1 < args.length) {
    options.expertName = args[++i];
  }
  else if (arg === '--full-name' && i + 1 < args.length) {
    options.fullName = args[++i];
  }
  else if (arg === '--mnemonic' && i + 1 < args.length) {
    options.mnemonic = args[++i];
  }
  else if (arg === '--metadata' && i + 1 < args.length) {
    try {
      options.metadata = JSON.parse(args[++i]);
    } catch (error) {
      console.error('Error: --metadata must be a valid JSON string');
      process.exit(1);
    }
  }
  else if (arg === '--core-group') {
    options.isInCoreGroup = true;
  }
  else if (arg === '--dry-run' || arg === '-d') {
    options.dryRun = true;
  }
  else if (arg === '--verbose' || arg === '-v') {
    options.verbose = true;
  }
}

// Validate required parameters
if (!options.expertName) {
  console.error('Error: --expert-name is required');
  process.exit(1);
}

// Execute the add-expert function
addExpert({
  expertName: options.expertName,
  fullName: options.fullName,
  mnemonic: options.mnemonic,
  metadata: options.metadata,
  isInCoreGroup: options.isInCoreGroup || false,
  dryRun: options.dryRun || false,
  verbose: options.verbose || false
});