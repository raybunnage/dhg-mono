#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Get the app name from command line args
const appName = process.argv[2];
if (!appName) {
  console.error('Please provide an app name, e.g.: pnpm tree dhg-improve-experts');
  process.exit(1);
}

const appPath = path.join('apps', appName);

// Patterns to ignore
const ignorePatterns = [
  'node_modules',
  'dist',
  '.turbo',
  '.git',
  '*.log',
  '*.lock',
  'coverage',
  '.env*',
  'tsconfig.json',
  'vite.config.ts',
  'tailwind.config.js',
  'postcss.config.js'
].map(pattern => `-I "${pattern}"`).join(' ');

// Patterns to show
const showPatterns = [
  'src/app/**/*',
  'src/pages/**/*',
  'src/components/**/*',
  'src/utils/**/*',
  'src/_archive/**/*',
  'src/integrations/**/*',
  'public/docs/**/*'
].map(pattern => path.join(appPath, pattern)).join(' ');

try {
  // Use tree command with custom formatting
  const command = `tree -I "node_modules|dist|.turbo|.git" --dirsfirst -a -F ${ignorePatterns} ${appPath}/src`;
  const output = execSync(command, { encoding: 'utf8' });
  
  console.log('\n=== App Structure ===\n');
  console.log(output);
  
  // Show important files count
  const fileCount = execSync(`find ${appPath}/src -type f -not -path "*/node_modules/*" -not -path "*/dist/*" | wc -l`, { encoding: 'utf8' });
  console.log(`\nTotal source files: ${fileCount.trim()}`);
  
  // Show active vs archived files
  const activeFiles = execSync(`find ${appPath}/src -type f -not -path "*/_archive/*" -not -path "*/node_modules/*" | wc -l`, { encoding: 'utf8' });
  const archivedFiles = execSync(`find ${appPath}/src/_archive -type f 2>/dev/null | wc -l`, { encoding: 'utf8' });
  
  console.log(`Active files: ${activeFiles.trim()}`);
  console.log(`Archived files: ${archivedFiles.trim()}`);

} catch (error) {
  if (error.message.includes('tree: command not found')) {
    console.error('\nError: The "tree" command is not installed.');
    console.log('Please install it using:');
    console.log('  - On macOS: brew install tree');
    console.log('  - On Ubuntu/Debian: sudo apt-get install tree');
    console.log('  - On Windows: Install via chocolatey: choco install tree\n');
  } else {
    console.error('Error:', error.message);
  }
  process.exit(1);
} 