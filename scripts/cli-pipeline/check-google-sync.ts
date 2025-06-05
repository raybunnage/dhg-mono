#!/usr/bin/env ts-node
/**
 * Health Check for sync-and-update-metadata command
 * 
 * This script analyzes the sync-and-update-metadata command to ensure it conforms to project standards:
 * - Uses the GoogleDriveService singleton properly
 * - Uses the SupabaseClientService singleton properly
 * - Implements proper error handling and retry logic
 * - Has correct command tracking integration
 * - Implements --new-folder-only flag correctly
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = process.cwd();
const SYNC_FILE_PATH = path.join(
  PROJECT_ROOT, 
  'scripts', 
  'cli-pipeline', 
  'google_sync', 
  'sync-and-update-metadata.ts'
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
    id: 'retry-logic',
    name: 'API Retry Logic',
    description: 'Checks if the command implements retry logic for API operations',
    check: (content: string) => 
      content.includes('retryCount') && 
      content.includes('maxRetries') && 
      content.includes('await new Promise(resolve => setTimeout(resolve,'),
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
        return shellContent.includes('track_command "sync-and-update-metadata"') ||
               shellContent.includes('track_command "sync"');
      } catch (error) {
        console.error('Error reading shell script:', error);
        return false;
      }
    },
    description: 'Checks if the command is integrated with command tracking in the shell script',
  },
  {
    id: 'new-folder-only',
    name: 'New Folder Only Flag',
    description: 'Checks if the command implements the --new-folder-only flag',
    check: (content: string) => 
      content.includes('--new-folder-only') && 
      content.includes('new-folder-only'),
  },
  {
    id: 'help-documentation',
    name: 'Help Documentation',
    description: 'Checks if the command is documented in the help text including the --new-folder-only flag',
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
        return shellContent.includes('--new-folder-only') && 
               shellContent.includes('./google-sync-cli.sh sync --new-folder-only');
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
  },
  {
    id: 'pagination',
    name: 'Improved Pagination',
    description: 'Checks if the command uses a larger page size for API requests',
    check: (content: string) => 
      content.includes('pageSize: 1000') || 
      (content.includes('pageSize:') && content.includes('1000')),
  }
];

/**
 * Main function
 */
async function main() {
  console.log('\n===== GOOGLE SYNC COMMAND HEALTH CHECK =====\n');
  
  try {
    // Check if the file exists
    if (!fs.existsSync(SYNC_FILE_PATH)) {
      console.error('❌ sync-and-update-metadata.ts file not found at:', SYNC_FILE_PATH);
      process.exit(1);
    }
    
    // Read the file content
    const content = fs.readFileSync(SYNC_FILE_PATH, 'utf-8');
    
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
      console.log('\n✅ The Google Sync command passes all health checks!');
    } else {
      console.log('\n⚠️ The Google Sync command needs improvements to meet project standards.');
    }
    
  } catch (error) {
    console.error('Error during health check:', error);
    process.exit(1);
  }
}

main();