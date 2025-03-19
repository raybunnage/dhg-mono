#!/usr/bin/env ts-node

/**
 * SIMPLE SCRIPT TO COUNT RECORDS IN DOCUMENTATION_FILES TABLE
 * This is a minimal script that just connects and counts records
 */

import { config as dotenvConfig } from 'dotenv';
import * as path from 'path';
import { Logger } from '../../packages/cli/src/utils/logger';
import { ErrorHandler } from '../../packages/cli/src/utils/error-handler';
import { SupabaseClientService } from '../../packages/cli/src/services/supabase-client';
import config from '../../packages/cli/src/utils/config';

// Define interfaces for typed return values
interface ScriptResult {
  success: boolean;
  error?: string;
  count?: number;
}

// Load environment variables - use absolute paths to ensure loading works
dotenvConfig(); // Load base .env
dotenvConfig({ path: path.resolve(process.cwd(), '.env.development') }); // Load environment specific
dotenvConfig({ path: path.resolve(process.cwd(), '.env.local') }); // Load local overrides

async function main(): Promise<ScriptResult> {
  Logger.info('Starting script to display document file paths...');
  
  try {
    // Use the ConfigService for connection details
    const supabaseUrl = config.supabaseUrl;
    const supabaseKey = config.supabaseKey;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase connection details in configuration');
    }
    
    Logger.info(`Using Supabase URL: ${supabaseUrl.substring(0, 20)}...`);
    Logger.info('Supabase key is present: YES');
    
    // Use the SupabaseClientService singleton
    Logger.info('Initializing Supabase client...');
    const supabaseService = SupabaseClientService.getInstance();
    
    // Initialize client if needed
    if (!supabaseService.isInitialized()) {
      supabaseService.initialize(supabaseUrl, supabaseKey);
    }
    
    // Get the shared client instance
    const supabase = supabaseService.getClient();
    
    // Count records
    Logger.info('Counting records in documentation_files table...');
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
    
    // List the first 10 file paths for verification
    Logger.info('\nFetching sample file paths...');
    const { data: pathData, error: pathError } = await supabase
      .from('documentation_files')
      .select('file_path')
      .limit(10);
    
    if (pathError) {
      Logger.warn(`Error fetching file paths: ${pathError.message}`);
    } else if (pathData && pathData.length > 0) {
      Logger.info('\nSample file paths:');
      Logger.info('------------------------------------------');
      pathData.forEach(record => {
        Logger.info(record.file_path);
      });
      Logger.info('------------------------------------------');
    } else {
      Logger.info('No file paths found.');
    }
    
    Logger.info('\nScript completed successfully!');
    return {
      success: true,
      count: count || 0
    };
    
  } catch (error) {
    // Use ErrorHandler for standardized error handling
    ErrorHandler.handle(error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run the script
main()
  .then(result => {
    if (!result.success) {
      Logger.error(`Script failed: ${result.error}`);
      process.exit(1);
    }
  })
  .catch(error => {
    ErrorHandler.handle(error as Error);
    process.exit(1);
  });