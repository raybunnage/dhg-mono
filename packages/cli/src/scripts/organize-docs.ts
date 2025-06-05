#!/usr/bin/env ts-node

/**
 * Document organization script
 * 
 * This script organizes documentation files into folders based on their document type.
 * It uses the document-organization service to perform the file movement and database updates.
 */

import { config as loadDotEnv } from 'dotenv';
import * as readline from 'readline';
import {
  initSupabaseConnection,
  listAllDocumentTypes,
  findAndMoveDocumentByType,
  moveAllFilesByDocumentType,
  DEFAULT_DOCUMENT_TYPE_MAPPING
} from '../services/document-organization';

// Load environment variables
loadDotEnv();

/**
 * Prompt user to choose an action
 */
async function promptForAction(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n=== DOCUMENT ORGANIZATION TOOL ===');
  console.log('1. List available document types');
  console.log('2. Move a single file by document type');
  console.log('3. Move ALL files according to document type mapping');
  console.log('4. Exit');
  
  return new Promise((resolve) => {
    rl.question('\nEnter your choice (1-4): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for document type
 */
async function promptForDocumentType(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\nEnter document type (e.g. "Code Documentation Markdown"): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Initializing...');
    const supabase = await initSupabaseConnection();
    let exit = false;
    
    while (!exit) {
      const choice = await promptForAction();
      
      switch (choice) {
        case '1':
          // List document types
          const docTypes = await listAllDocumentTypes(supabase);
          console.log('\nAvailable document types:');
          docTypes.forEach(dt => {
            console.log(`- ${dt.docType} (${dt.count} files)`);
          });
          break;
          
        case '2':
          // Move a single file
          const documentType = await promptForDocumentType();
          if (!documentType) {
            console.log('No document type provided. Skipping.');
            break;
          }
          
          // Find the target folder for this document type
          let targetFolder = '';
          for (const [type, folder] of Object.entries(DEFAULT_DOCUMENT_TYPE_MAPPING)) {
            if (type.toLowerCase() === documentType.toLowerCase()) {
              targetFolder = folder;
              break;
            }
          }
          
          if (!targetFolder) {
            console.log(`No target folder mapping found for "${documentType}". Using document type as folder name.`);
            targetFolder = documentType.toLowerCase().replace(/\s+/g, '-');
          }
          
          // Move the file
          const result = await findAndMoveDocumentByType(supabase, documentType, targetFolder);
          if (result.success) {
            console.log(`✅ Success: ${result.message}`);
          } else {
            console.log(`❌ Error: ${result.message}`);
          }
          break;
          
        case '3':
          // Move all files
          console.log('Moving all files based on document type mapping...');
          const moveResult = await moveAllFilesByDocumentType(supabase, DEFAULT_DOCUMENT_TYPE_MAPPING);
          
          console.log('\nOrganization complete:');
          moveResult.stats.forEach(stat => {
            console.log(`- ${stat.docType}: ${stat.moved} moved, ${stat.skipped} skipped, ${stat.errors} errors`);
          });
          
          if (moveResult.success) {
            console.log('✅ All files organized successfully!');
          } else {
            console.log('⚠️ Organization completed with some errors.');
          }
          break;
          
        case '4':
          console.log('Exiting...');
          exit = true;
          break;
          
        default:
          console.log('Invalid choice, please try again.');
      }
    }
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the main function
main()
  .then(() => console.log('Done!'))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });