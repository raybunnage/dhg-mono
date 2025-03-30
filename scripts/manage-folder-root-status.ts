#!/usr/bin/env ts-node
/**
 * Folder Root Status Manager CLI
 * 
 * This script provides commands to manage the root status of Google Drive folders in the database.
 * It allows setting or removing root status from folders in the sources_google table.
 * 
 * Usage:
 *   ts-node manage-folder-root-status.ts [command] [options]
 * 
 * Commands:
 *   list                     List all folders currently marked as root
 *   set-root <folderId>      Set a folder as a root folder
 *   remove-root <folderId>   Remove root status from a folder
 *   help                     Show this help message
 * 
 * Options:
 *   --dry-run                Show what would be changed without making changes
 *   --verbose                Show more detailed output
 * 
 * Examples:
 *   ts-node manage-folder-root-status.ts list
 *   ts-node manage-folder-root-status.ts set-root 1234-5678-90ab-cdef
 *   ts-node manage-folder-root-status.ts remove-root 1234-5678-90ab-cdef --dry-run
 */

import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import { GoogleAuthService, SourcesGoogleUpdateService, GoogleDriveService } from '../packages/shared/services/google-drive';

// Load environment variables
dotenv.config();

// Ensure Supabase credentials are available
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL or key not found in environment variables');
  console.error('Available environment variables:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));
  process.exit(1);
}

// Create Supabase client
const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create a simple access token object for direct authentication
const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN || '';

// Set up a simple mock auth service that returns the provided access token directly
class SimpleAuthService {
  private token: string;
  
  constructor(token: string) {
    this.token = token;
  }
  
  async getAccessToken(): Promise<string | null> {
    return this.token;
  }
  
  static getInstance(token: string): SimpleAuthService {
    return new SimpleAuthService(token);
  }
}

// Set up services
const authService = SimpleAuthService.getInstance(accessToken);
const driveService = GoogleDriveService.getInstance(authService as any, supabase);
const updateService = SourcesGoogleUpdateService.getInstance(driveService, supabase);

// Set up CLI
const program = new Command()
  .name('manage-folder-root-status')
  .description('CLI to manage Google Drive folder root status')
  .version('1.0.0');

// List command
program
  .command('list')
  .description('List all folders currently marked as root')
  .action(async () => {
    console.log('Fetching root folders...');
    try {
      const rootFolders = await updateService.getRootFolders();
      
      if (!rootFolders || rootFolders.length === 0) {
        console.log('No root folders found.');
        return;
      }
      
      console.log(`Found ${rootFolders.length} root folders:`);
      console.log('------------------------------');
      
      rootFolders.forEach((folder, index) => {
        console.log(`${index + 1}. ${folder.name}`);
        console.log(`   ID: ${folder.id}`);
        console.log(`   Drive ID: ${folder.drive_id}`);
        console.log(`   Last Synced: ${folder.last_indexed || 'Never'}`);
        console.log(`   Status: ${folder.sync_status || 'Unknown'}`);
        if (folder.sync_error) {
          console.log(`   Error: ${folder.sync_error}`);
        }
        console.log('------------------------------');
      });
    } catch (error) {
      console.error('❌ Error listing root folders:', error);
    }
  });

// Set root command
program
  .command('set-root <folderId>')
  .description('Set a folder as a root folder')
  .option('--dry-run', 'Show what would be changed without making changes')
  .option('--verbose', 'Show more detailed output')
  .action(async (folderId: string, options: { dryRun?: boolean; verbose?: boolean }) => {
    try {
      console.log(`Setting root status for folder with ID: ${folderId}`);
      
      const result = await updateService.updateFolderRootStatus(folderId, true, {
        dryRun: options.dryRun,
        verbose: options.verbose || options.dryRun
      });
      
      if (result.success) {
        console.log(`✅ ${options.dryRun ? 'Would set' : 'Set'} folder as root successfully`);
      } else {
        console.error('❌ Failed to set folder as root:', result.error);
      }
    } catch (error) {
      console.error('❌ Error setting folder as root:', error);
    }
  });

// Remove root command
program
  .command('remove-root <folderId>')
  .description('Remove root status from a folder')
  .option('--dry-run', 'Show what would be changed without making changes')
  .option('--verbose', 'Show more detailed output')
  .action(async (folderId: string, options: { dryRun?: boolean; verbose?: boolean }) => {
    try {
      console.log(`Removing root status from folder with ID: ${folderId}`);
      
      const result = await updateService.updateFolderRootStatus(folderId, false, {
        dryRun: options.dryRun,
        verbose: options.verbose || options.dryRun
      });
      
      if (result.success) {
        console.log(`✅ ${options.dryRun ? 'Would remove' : 'Removed'} root status from folder successfully`);
      } else {
        console.error('❌ Failed to remove root status from folder:', result.error);
      }
    } catch (error) {
      console.error('❌ Error removing root status from folder:', error);
    }
  });

// Find command (by name pattern)
program
  .command('find <namePattern>')
  .description('Find folders by name pattern')
  .action(async (namePattern: string) => {
    try {
      console.log(`Searching for folders matching: ${namePattern}`);
      
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, name, drive_id, is_root, mime_type')
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .eq('deleted', false)
        .ilike('name', `%${namePattern}%`);
        
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log('No matching folders found.');
        return;
      }
      
      console.log(`Found ${data.length} matching folders:`);
      console.log('------------------------------');
      
      data.forEach((folder, index) => {
        console.log(`${index + 1}. ${folder.name}`);
        console.log(`   ID: ${folder.id}`);
        console.log(`   Drive ID: ${folder.drive_id}`);
        console.log(`   Root status: ${folder.is_root ? 'Root folder' : 'Not a root folder'}`);
        console.log('------------------------------');
      });
    } catch (error) {
      console.error('❌ Error finding folders:', error);
    }
  });

// Help command
program
  .command('help')
  .description('Display help information')
  .action(() => {
    program.help();
  });

// Parse command line arguments
program.parse(process.argv);

// If no commands were provided, show help
if (process.argv.length <= 2) {
  program.help();
}