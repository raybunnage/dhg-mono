#!/bin/bash

# This script builds just the scan-scripts command in isolation

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="../../packages/cli"

# Create temp directory for isolated build
TEMP_DIR="/tmp/scan-scripts-build"
mkdir -p "$TEMP_DIR/src/commands"
mkdir -p "$TEMP_DIR/src/utils"
mkdir -p "$TEMP_DIR/src/services"

echo "Copying necessary files to temp directory..."

# Copy required files
cp "$CLI_DIR/src/utils/logger.ts" "$TEMP_DIR/src/utils/"
cp "$CLI_DIR/src/utils/error-handler.ts" "$TEMP_DIR/src/utils/"
cp "$CLI_DIR/src/services/file-service.ts" "$TEMP_DIR/src/services/"
cp "$CLI_DIR/src/commands/scan-scripts.ts" "$TEMP_DIR/src/commands/"

# Create minimal index.ts
cat > "$TEMP_DIR/src/index.ts" << EOL
#!/usr/bin/env node
import { Command } from 'commander';
import { scanScriptsCommand } from './commands/scan-scripts';

const program = new Command()
  .name('scan-scripts')
  .description('CLI for scanning script files')
  .version('1.0.0');

// Register commands
program.addCommand(scanScriptsCommand);

// Parse command-line arguments
program.parse();
EOL

# Copy package.json with minimal dependencies
cat > "$TEMP_DIR/package.json" << EOL
{
  "name": "scan-scripts-cli",
  "version": "1.0.0",
  "description": "CLI for scanning script files",
  "main": "dist/index.js",
  "bin": {
    "scan-scripts": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "glob": "^10.3.10",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.21",
    "typescript": "^5.3.3"
  }
}
EOL

# Copy tsconfig.json
cat > "$TEMP_DIR/tsconfig.json" << EOL
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOL

# Build the isolated package
echo "Building isolated scan-scripts command..."
cd "$TEMP_DIR" && npm install && npm run build

# Copy the built files back to our CLI dist directory
echo "Copying built files to CLI dist directory..."
mkdir -p "$CLI_DIR/dist/commands"
mkdir -p "$CLI_DIR/dist/utils"
mkdir -p "$CLI_DIR/dist/services"

cp "$TEMP_DIR/dist/utils/logger.js" "$CLI_DIR/dist/utils/"
cp "$TEMP_DIR/dist/utils/error-handler.js" "$CLI_DIR/dist/utils/"
cp "$TEMP_DIR/dist/services/file-service.js" "$CLI_DIR/dist/services/"
cp "$TEMP_DIR/dist/commands/scan-scripts.js" "$CLI_DIR/dist/commands/"

# Create minimal index.js for the CLI
cat > "$CLI_DIR/dist/index.js" << EOL
#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const scan_scripts_1 = require("./commands/scan-scripts");
const program = new commander_1.Command()
    .name('ai-workflow')
    .description('CLI for AI workflows')
    .version('1.0.0');
// Register commands
program.addCommand(scan_scripts_1.scanScriptsCommand);
// Parse command-line arguments
program.parse();
EOL

# Make the CLI index.js executable
chmod +x "$CLI_DIR/dist/index.js"

echo "Build completed. You can now run the scan-scripts command."
echo "Run from dhg-mono root: node packages/cli/dist/index.js scan-scripts [options]"