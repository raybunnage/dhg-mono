#!/usr/bin/env ts-node
/**
 * Create sources_google_experts Table Script
 * 
 * This script creates the sources_google_experts table to replace the expert_id field
 * in sources_google with a proper many-to-many relationship.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils/logger';

// Load environment variables
dotenv.config();

async function main() {
  try {
    Logger.info('Setting up sources_google_experts table...');
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'create_sources_google_experts.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL file not found: ${sqlFilePath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Split the SQL into statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + ';');
    
    Logger.info(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      Logger.info(`Executing statement ${i + 1}/${statements.length}...`);
      
      // Skip comment-only statements
      if (statement.trim().startsWith('--')) {
        Logger.info('Skipping comment statement');
        continue;
      }
      
      try {
        const { data, error } = await supabase.rpc('execute_sql', { sql: statement });
        
        if (error) {
          Logger.error(`Error executing statement ${i + 1}: ${error.message}`);
          Logger.debug(`Failed statement: ${statement.substring(0, 100)}...`);
          
          // If this is the enum creation and it fails because it already exists, continue
          if (statement.includes('CREATE TYPE expert_role_type') && 
              error.message.includes('already exists')) {
            Logger.info('Enum type already exists, continuing...');
            continue;
          }
          
          // If this is the table creation and it fails because it already exists, continue
          if (statement.includes('CREATE TABLE') &&
              error.message.includes('already exists')) {
            Logger.info('Table already exists, continuing...');
            continue;
          }
          
          // Otherwise, report the error but continue with remaining statements
          Logger.warn('Continuing despite error...');
        } else {
          Logger.info(`Statement ${i + 1} executed successfully`);
        }
      } catch (e) {
        Logger.error(`Exception executing statement ${i + 1}: ${e.message}`);
        Logger.debug(`Failed statement: ${statement.substring(0, 100)}...`);
      }
    }
    
    // Check if the table was created successfully
    const { data: checkTable, error: checkError } = await supabase.rpc('execute_sql', {
      sql: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sources_google_experts')"
    });
    
    if (checkError) {
      throw new Error(`Failed to check if table exists: ${checkError.message}`);
    }
    
    const tableExists = checkTable[0].exists;
    
    if (tableExists) {
      Logger.info('Table created successfully!');
      
      // Ask if we should migrate existing data
      const shouldMigrate = process.argv.includes('--migrate');
      
      if (shouldMigrate) {
        Logger.info('Migrating existing expert_id data...');
        
        const { data: migrateData, error: migrateError } = await supabase.rpc('execute_sql', {
          sql: "SELECT migrate_expert_ids();"
        });
        
        if (migrateError) {
          Logger.error(`Error migrating data: ${migrateError.message}`);
        } else {
          Logger.info('Data migration completed successfully');
          
          // Count migrated records
          const { data: countData, error: countError } = await supabase.rpc('execute_sql', {
            sql: "SELECT COUNT(*) FROM sources_google_experts"
          });
          
          if (countError) {
            Logger.error(`Error counting migrated records: ${countError.message}`);
          } else {
            Logger.info(`Migrated ${countData[0].count} expert associations`);
          }
        }
      } else {
        Logger.info('To migrate existing expert_id data, run with --migrate flag');
      }
    } else {
      throw new Error('Table creation failed');
    }
    
    Logger.info('Setup complete!');
    
  } catch (error) {
    Logger.error('Error setting up table:', error);
    process.exit(1);
  }
}

main();