#!/usr/bin/env ts-node
/**
 * Folder Root Status Manager CLI (Simplified Version)
 * 
 * This script provides commands to manage the root status of Google Drive folders in the database.
 * It allows setting or removing root status from folders in the sources_google table.
 * 
 * Usage:
 *   ts-node manage-folder-root-status-simple.ts [command] [options]
 * 
 * Commands:
 *   list                     List all folders currently marked as root
 *   set-root <folderId>      Set a folder as a root folder
 *   remove-root <folderId>   Remove root status from a folder
 *   find <namePattern>       Find folders by name pattern
 *   help                     Show this help message
 * 
 * Options:
 *   --dry-run                Show what would be changed without making changes
 *   --verbose                Show more detailed output
 * 
 * Examples:
 *   ts-node manage-folder-root-status-simple.ts list
 *   ts-node manage-folder-root-status-simple.ts set-root 1234-5678-90ab-cdef
 *   ts-node manage-folder-root-status-simple.ts remove-root 1234-5678-90ab-cdef --dry-run
 */

import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';

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

// Set up CLI
const program = new Command()
  .name('manage-folder-root-status-simple')
  .description('CLI to manage Google Drive folder root status')
  .version('1.0.0');

// List command
program
  .command('list')
  .description('List all folders currently marked as root')
  .action(async () => {
    console.log('Fetching root folders...');
    try {
      const { data, error } = await supabase
        .from('sources_google')
        .select('*')
        .eq('is_root', true)
        .eq('deleted', false)
        .order('name');
        
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log('No root folders found.');
        return;
      }
      
      console.log(`Found ${data.length} root folders:`);
      console.log('------------------------------');
      
      data.forEach((folder, index) => {
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
      const verbose = options.verbose || options.dryRun;
      
      // Get folder details first
      const { data: folder, error: fetchError } = await supabase
        .from('sources_google')
        .select('id, name, drive_id, is_root')
        .eq('id', folderId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!folder) {
        throw new Error(`Folder with ID ${folderId} not found`);
      }

      if (folder.is_root === true) {
        if (verbose) {
          console.log(`Folder "${folder.name}" is already a root folder`);
        }
        console.log(`✅ Folder is already set as root`);
        return;
      }

      if (!options.dryRun) {
        const now = new Date().toISOString();
        const updateData = {
          is_root: true,
          updated_at: now,
          parent_folder_id: null,
          parent_path: null,
          parent_id: null,
          path: `/${folder.name}`
        };

        const { error: updateError } = await supabase
          .from('sources_google')
          .update(updateData)
          .eq('id', folderId);

        if (updateError) {
          throw updateError;
        }

        if (verbose) {
          console.log(`Successfully set root status for folder "${folder.name}"`);
        }
        console.log(`✅ Set folder as root successfully`);
      } else {
        if (verbose) {
          console.log(`Would set root status for folder "${folder.name}"`);
        }
        console.log(`✅ Would set folder as root (dry run)`);
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
      const verbose = options.verbose || options.dryRun;
      
      // Get folder details first
      const { data: folder, error: fetchError } = await supabase
        .from('sources_google')
        .select('id, name, drive_id, is_root')
        .eq('id', folderId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!folder) {
        throw new Error(`Folder with ID ${folderId} not found`);
      }

      if (folder.is_root === false) {
        if (verbose) {
          console.log(`Folder "${folder.name}" is already not a root folder`);
        }
        console.log(`✅ Folder is already not marked as root`);
        return;
      }

      if (!options.dryRun) {
        const now = new Date().toISOString();
        const updateData = {
          is_root: false,
          updated_at: now
        };

        const { error: updateError } = await supabase
          .from('sources_google')
          .update(updateData)
          .eq('id', folderId);

        if (updateError) {
          throw updateError;
        }

        if (verbose) {
          console.log(`Successfully removed root status from folder "${folder.name}"`);
        }
        console.log(`✅ Removed root status from folder successfully`);
      } else {
        if (verbose) {
          console.log(`Would remove root status from folder "${folder.name}"`);
        }
        console.log(`✅ Would remove root status from folder (dry run)`);
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