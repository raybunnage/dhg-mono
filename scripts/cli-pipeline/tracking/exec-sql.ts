#!/usr/bin/env node

/**
 * Execute SQL Script Utility
 * Runs a SQL script against the Supabase database
 */
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils/logger';

async function executeSQL(filePath: string) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      Logger.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    
    // Read the SQL file
    const sql = fs.readFileSync(filePath, 'utf8');
    Logger.info(`Executing SQL file: ${filePath}`);
    
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Execute the SQL statements one by one
    const statements = sql.split(';').filter(stmt => stmt.trim());
    Logger.info(`Found ${statements.length} SQL statements`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      if (statement.trim()) {
        Logger.debug(`Executing: ${statement.trim().substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
        
        const { error } = await supabase.rpc('exec_sql', { sql_string: statement + ';' });
        
        if (error) {
          Logger.error(`Error executing SQL: ${error.message}`);
          Logger.error(`Statement: ${statement}`);
          errorCount++;
        } else {
          successCount++;
        }
      }
    }
    
    Logger.info(`Execution complete: ${successCount} successful, ${errorCount} failed statements`);
    
    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    Logger.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Check arguments
if (process.argv.length < 3) {
  Logger.error('Please provide a path to the SQL file to execute');
  Logger.info('Usage: npx ts-node exec-sql.ts <path-to-sql-file>');
  process.exit(1);
}

// Get file path from arguments
const filePath = process.argv[2];
executeSQL(filePath);