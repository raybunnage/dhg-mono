#!/usr/bin/env ts-node

/**
 * ENHANCED SCRIPT TO VIEW DOCUMENTATION FILES WITH MENU SYSTEM
 * Following CLI Pipeline Guidance for structure and patterns
 */

import { config as dotenvConfig } from 'dotenv';
// Use the project's SupabaseClient type to avoid version conflicts
import { SupabaseClient } from '../../packages/cli/src/services/supabase-client';
import * as path from 'path';
import * as readline from 'readline';
import * as fs from 'fs';
import { Logger } from '../../packages/cli/src/utils/logger';
import { ErrorHandler } from '../../packages/cli/src/utils/error-handler';
import { SupabaseClientService } from '../../packages/cli/src/services/supabase-client';
import config from '../../packages/cli/src/utils/config';

// Define interfaces for type safety and consistent return values
interface MenuResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Load environment variables from different .env files with absolute paths
dotenvConfig(); // Load base .env
dotenvConfig({ path: path.resolve(process.cwd(), '.env.development') });
dotenvConfig({ path: path.resolve(process.cwd(), '.env.local') });

// Create a readline interface for user prompts
function createRl(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Prompt user for an action
async function promptForAction(): Promise<string> {
  const rl = createRl();
  
  Logger.info('\n=== DOCUMENTATION FILES VIEWER ===');
  Logger.info('1. Count documentation files');
  Logger.info('2. View sample file paths');
  Logger.info('3. Check files without document types');
  Logger.info('4. View document types');
  Logger.info('5. Exit');
  
  return new Promise<string>((resolve) => {
    rl.question('\nEnter your choice (1-5): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Initialize Supabase connection using the singleton service pattern
async function initSupabase(): Promise<SupabaseClient> {
  try {
    // Get configuration from shared config utility
    const supabaseUrl = config.supabaseUrl;
    const supabaseKey = config.supabaseKey;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase connection details in configuration');
    }
    
    Logger.info(`Using Supabase URL: ${supabaseUrl.substring(0, 20)}...`);
    Logger.info('Supabase key is present: YES');
    
    // Use the SupabaseClientService singleton pattern
    const supabaseService = SupabaseClientService.getInstance();
    
    // Initialize if needed
    if (!supabaseService.isInitialized()) {
      supabaseService.initialize(supabaseUrl, supabaseKey);
    }
    
    // Get client from service
    return supabaseService.getClient();
    
  } catch (error) {
    ErrorHandler.handle(error as Error);
    throw error;
  }
}

// Count documentation files with typed return values
async function countDocumentationFiles(supabase: SupabaseClient): Promise<MenuResult> {
  Logger.info('\nCounting records in documentation_files table...');
  
  try {
    const { count, error } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      Logger.error(`Error counting records: ${error.message}`);
      Logger.debug('Full error:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    
    Logger.info('------------------------------------------');
    Logger.info(`RECORDS FOUND IN DOCUMENTATION_FILES: ${count || 0}`);
    Logger.info('------------------------------------------');
    
    // Count active vs. deleted records
    const { count: activeCount, error: activeError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);
      
    const { count: deletedCount, error: deletedError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);
      
    if (!activeError && !deletedError) {
      Logger.info(`Active records (is_deleted = FALSE): ${activeCount || 0}`);
      Logger.info(`Deleted records (is_deleted = TRUE): ${deletedCount || 0}`);
    }
    
    return {
      success: true,
      data: {
        total: count || 0,
        active: activeCount || 0,
        deleted: deletedCount || 0
      }
    };
    
  } catch (error) {
    ErrorHandler.handle(error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// View sample file paths with typed return value
async function viewSampleFilePaths(supabase: SupabaseClient): Promise<MenuResult> {
  Logger.info('\nFetching sample file paths...');
  
  try {
    const { data, error } = await supabase
      .from('documentation_files')
      .select('file_path, title, is_deleted')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      Logger.error(`Error fetching file paths: ${error.message}`);
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    
    if (!data || data.length === 0) {
      Logger.info('No files found.');
      return {
        success: true,
        data: []
      };
    }
    
    Logger.info('\nMost recent documentation files:');
    Logger.info('------------------------------------------');
    data.forEach((file, i) => {
      Logger.info(`${i+1}. ${file.file_path} ${file.is_deleted ? '[DELETED]' : ''}`);
      if (file.title) Logger.info(`   Title: ${file.title}`);
    });
    Logger.info('------------------------------------------');
    
    return {
      success: true,
      data: data
    };
    
  } catch (error) {
    ErrorHandler.handle(error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Check files without document types with typed return value
async function checkFilesWithoutDocTypes(supabase: SupabaseClient): Promise<MenuResult> {
  Logger.info('\nChecking for files without document types...');
  
  try {
    const { data, error } = await supabase
      .from('documentation_files')
      .select('id, file_path, title')
      .is('document_type_id', null)
      .eq('is_deleted', false)
      .order('file_path')
      .limit(20);
    
    if (error) {
      Logger.error(`Error fetching files without types: ${error.message}`);
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    
    const { count, error: countError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .is('document_type_id', null)
      .eq('is_deleted', false);
      
    if (countError) {
      Logger.warn(`Error counting files without types: ${countError.message}`);
    }
    
    Logger.info(`\nFound ${count || 0} files without document types`);
    
    if (!data || data.length === 0) {
      Logger.info('No files without document types.');
      return {
        success: true,
        data: {
          count: 0,
          files: []
        }
      };
    }
    
    Logger.info('\nSample files without document types:');
    Logger.info('------------------------------------------');
    data.forEach((file, i) => {
      Logger.info(`${i+1}. ${file.file_path}`);
      if (file.title) Logger.info(`   Title: ${file.title}`);
    });
    Logger.info('------------------------------------------');
    
    if (count && count > data.length) {
      Logger.info(`...and ${count - data.length} more files without document types`);
    }
    
    return {
      success: true,
      data: {
        count: count || 0,
        files: data
      }
    };
    
  } catch (error) {
    ErrorHandler.handle(error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// View document types with typed return value
async function viewDocumentTypes(supabase: SupabaseClient): Promise<MenuResult> {
  Logger.info('\nFetching document types...');
  
  try {
    const { data, error } = await supabase
      .from('document_types')
      .select('*')
      .order('name');
    
    if (error) {
      Logger.error(`Error fetching document types: ${error.message}`);
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
    
    if (!data || data.length === 0) {
      Logger.info('No document types found.');
      return {
        success: true,
        data: []
      };
    }
    
    Logger.info('\nAvailable document types:');
    Logger.info('------------------------------------------');
    
    // Group by category
    const byCategory: Record<string, any[]> = {};
    data.forEach(dt => {
      const category = dt.category || 'Uncategorized';
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push(dt);
    });
    
    // Display by category
    Object.entries(byCategory).forEach(([category, types]) => {
      Logger.info(`\n${category}:`);
      types.forEach(dt => {
        Logger.info(`- ${dt.name} (ID: ${dt.id})`);
        if (dt.description) Logger.info(`  ${dt.description}`);
      });
    });
    
    Logger.info('------------------------------------------');
    Logger.info(`Total: ${data.length} document types`);
    
    return {
      success: true,
      data: {
        types: data,
        byCategory: byCategory,
        count: data.length
      }
    };
    
  } catch (error) {
    ErrorHandler.handle(error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Main function with proper error handling and typed return values
async function main(): Promise<{success: boolean, error?: string}> {
  Logger.info('Starting documentation files viewer...');
  Logger.debug('Current directory:', process.cwd());
  
  try {
    // Initialize Supabase using singleton pattern
    const supabase = await initSupabase();
    let exit = false;
    
    while (!exit) {
      const choice = await promptForAction();
      
      switch (choice) {
        case '1': {
          const result = await countDocumentationFiles(supabase);
          if (!result.success) {
            Logger.error(`Failed to count documentation files: ${result.error}`);
          }
          break;
        }
        
        case '2': {
          const result = await viewSampleFilePaths(supabase);
          if (!result.success) {
            Logger.error(`Failed to view sample file paths: ${result.error}`);
          }
          break;
        }
        
        case '3': {
          const result = await checkFilesWithoutDocTypes(supabase);
          if (!result.success) {
            Logger.error(`Failed to check files without document types: ${result.error}`);
          }
          break;
        }
        
        case '4': {
          const result = await viewDocumentTypes(supabase);
          if (!result.success) {
            Logger.error(`Failed to view document types: ${result.error}`);
          }
          break;
        }
        
        case '5':
          Logger.info('Exiting...');
          exit = true;
          break;
        
        default:
          Logger.warn('Invalid choice. Please try again.');
      }
    }
    
    Logger.info('\nScript completed successfully!');
    return { success: true };
    
  } catch (error) {
    // Use ErrorHandler for standardized error handling
    ErrorHandler.handle(error as Error);
    return {
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run the main function with proper error handling
main()
  .then(result => {
    if (!result.success) {
      Logger.error(`Script failed: ${result.error}`);
      process.exit(1);
    }
  })
  .catch(error => {
    // Handle any unexpected errors
    ErrorHandler.handle(error as Error);
    Logger.error('Unhandled error in main');
    process.exit(1);
  });