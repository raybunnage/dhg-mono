#!/usr/bin/env ts-node
/**
 * Health Check for find-folder command
 * 
 * This script analyzes the find-folder command to ensure it conforms to project standards:
 * - Uses the GoogleDriveService singleton properly
 * - Uses the SupabaseClientService singleton properly
 * - Implements proper error handling
 * - Has correct command tracking integration
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = process.cwd();
const FIND_FOLDER_PATH = path.join(
  PROJECT_ROOT, 
  'scripts', 
  'cli-pipeline', 
  'google_sync', 
  'find-folder.ts'
);

// Check points and their descriptions
const CHECK_POINTS = [
  {
    id: 'singleton-google-drive',
    name: 'Google Drive Service Singleton',
    description: 'Checks if the command uses the GoogleDriveService singleton',
    check: (content: string) => content.includes('getGoogleDriveService') || content.includes('GoogleDriveService.getInstance()'),
  },
  {
    id: 'singleton-supabase',
    name: 'Supabase Client Singleton',
    description: 'Checks if the command uses the SupabaseClientService singleton',
    check: (content: string) => content.includes('SupabaseClientService.getInstance()'),
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    description: 'Checks if the command has proper error handling',
    check: (content: string) => content.includes('try {') && content.includes('catch (error') && content.includes('console.error'),
  },
  {
    id: 'command-tracking',
    name: 'Command Tracking Integration',
    check: (content: string) => {
      // Check if the command is properly integrated in google-sync-cli.sh with track_command
      const shellScriptPath = path.join(
        PROJECT_ROOT,
        'scripts',
        'cli-pipeline',
        'google_sync',
        'google-sync-cli.sh'
      );
      
      try {
        const shellContent = fs.readFileSync(shellScriptPath, 'utf-8');
        return shellContent.includes('track_command "find-folder"');
      } catch (error) {
        console.error('Error reading shell script:', error);
        return false;
      }
    },
    description: 'Checks if the command is integrated with command tracking in the shell script',
  },
  {
    id: 'help-documentation',
    name: 'Help Documentation',
    description: 'Checks if the command is documented in the help text',
    check: (content: string) => {
      // Check if the command is documented in google-sync-cli.sh help
      const shellScriptPath = path.join(
        PROJECT_ROOT,
        'scripts',
        'cli-pipeline',
        'google_sync',
        'google-sync-cli.sh'
      );
      
      try {
        const shellContent = fs.readFileSync(shellScriptPath, 'utf-8');
        return shellContent.includes('find-folder') && 
               shellContent.includes('./google-sync-cli.sh find-folder');
      } catch (error) {
        console.error('Error reading shell script:', error);
        return false;
      }
    },
  },
  {
    id: 'environment-vars',
    name: 'Environment Variables',
    description: 'Checks if the command properly loads environment variables',
    check: (content: string) => content.includes('loadEnvFiles') || content.includes('dotenv.config'),
  }
];

/**
 * Main function
 */
async function main() {
  console.log('\n===== find-folder COMMAND HEALTH CHECK =====\n');
  
  try {
    // Check if the file exists
    if (!fs.existsSync(FIND_FOLDER_PATH)) {
      console.error('❌ find-folder.ts file not found at:', FIND_FOLDER_PATH);
      process.exit(1);
    }
    
    // Read the file content
    const content = fs.readFileSync(FIND_FOLDER_PATH, 'utf-8');
    
    // Run checks
    let passedChecks = 0;
    const totalChecks = CHECK_POINTS.length;
    
    for (const checkPoint of CHECK_POINTS) {
      const passed = checkPoint.check(content);
      
      if (passed) {
        console.log(`✅ ${checkPoint.name}: PASSED`);
        passedChecks++;
      } else {
        console.log(`❌ ${checkPoint.name}: FAILED`);
        console.log(`   Description: ${checkPoint.description}`);
      }
    }
    
    // Print summary
    console.log('\n----- SUMMARY -----');
    console.log(`Passed checks: ${passedChecks}/${totalChecks} (${Math.round(passedChecks / totalChecks * 100)}%)`);
    
    if (passedChecks === totalChecks) {
      console.log('\n✅ The find-folder command passes all health checks!');
    } else {
      console.log('\n⚠️ The find-folder command needs improvements to meet project standards.');
    }
    
  } catch (error) {
    console.error('Error during health check:', error);
    process.exit(1);
  }
}

main();