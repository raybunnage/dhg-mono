#!/usr/bin/env ts-node

/**
 * Documentation Processing Script
 * 
 * This script processes markdown files in the docs directory, extracting metadata,
 * registering them in the database, and queuing them for AI processing.
 * 
 * Usage:
 *   ts-node scripts/process-documentation.ts [command] [options]
 * 
 * Commands:
 *   scan [dir]       Scan a directory for markdown files and process them
 *   process [file]   Process a specific markdown file
 *   process-queue    Process the next file in the AI processing queue
 *   process-all      Process all files in the AI processing queue
 * 
 * Options:
 *   --docs-dir       Base directory for documentation files (default: ./docs)
 *   --limit          Limit the number of files to process (for process-all)
 *   --help           Show help
 */

import { DocumentationService } from '../apps/dhg-improve-experts/src/services/documentationService';
import path from 'path';
import fs from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'help';

// Parse options
const options: { [key: string]: string } = {};
for (let i = 1; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
    options[key] = value;
    if (value !== 'true') i++; // Skip the value in the next iteration
  }
}

// Get base docs directory
const docsDir = options['docs-dir'] || './docs';

// Ensure docs directory exists
if (!fs.existsSync(docsDir)) {
  console.error(`Error: Docs directory '${docsDir}' does not exist.`);
  process.exit(1);
}

// Initialize documentation service
const documentationService = new DocumentationService(docsDir);

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Documentation Processing Script

Usage:
  ts-node scripts/process-documentation.ts [command] [options]

Commands:
  scan [dir]       Scan a directory for markdown files and process them
  process [file]   Process a specific markdown file
  process-queue    Process the next file in the AI processing queue
  process-all      Process all files in the AI processing queue
  help             Show this help message

Options:
  --docs-dir       Base directory for documentation files (default: ./docs)
  --limit          Limit the number of files to process (for process-all)
  `);
}

/**
 * Scan a directory for markdown files
 */
async function scanDirectory(dir: string = '') {
  console.log(`Scanning directory: ${path.join(docsDir, dir)}`);
  
  try {
    const fileIds = await documentationService.scanDirectory(dir);
    console.log(`Processed ${fileIds.length} markdown files.`);
  } catch (error) {
    console.error('Error scanning directory:', error);
    process.exit(1);
  }
}

/**
 * Process a specific markdown file
 */
async function processFile(filePath: string) {
  console.log(`Processing file: ${path.join(docsDir, filePath)}`);
  
  try {
    const fileId = await documentationService.processMarkdownFile(filePath);
    console.log(`Processed file with ID: ${fileId}`);
  } catch (error) {
    console.error('Error processing file:', error);
    process.exit(1);
  }
}

/**
 * Process the next file in the AI processing queue
 */
async function processQueue() {
  console.log('Processing next file in queue...');
  
  try {
    const processed = await documentationService.processNextFileWithAI();
    
    if (processed) {
      console.log('Successfully processed file with AI.');
    } else {
      console.log('No files in queue or processing failed.');
    }
  } catch (error) {
    console.error('Error processing queue:', error);
    process.exit(1);
  }
}

/**
 * Process all files in the AI processing queue
 */
async function processAll() {
  console.log('Processing all files in queue...');
  
  try {
    const limit = options['limit'] ? parseInt(options['limit']) : Infinity;
    let processed = 0;
    let success = true;
    
    while (success && processed < limit) {
      success = await documentationService.processNextFileWithAI();
      if (success) {
        processed++;
        console.log(`Processed ${processed} files...`);
      }
    }
    
    console.log(`Finished processing ${processed} files.`);
  } catch (error) {
    console.error('Error processing all files:', error);
    process.exit(1);
  }
}

// Execute command
(async () => {
  switch (command) {
    case 'scan':
      await scanDirectory(args[1] || '');
      break;
    
    case 'process':
      if (!args[1]) {
        console.error('Error: No file specified.');
        showHelp();
        process.exit(1);
      }
      await processFile(args[1]);
      break;
    
    case 'process-queue':
      await processQueue();
      break;
    
    case 'process-all':
      await processAll();
      break;
    
    case 'help':
    default:
      showHelp();
      break;
  }
})(); 