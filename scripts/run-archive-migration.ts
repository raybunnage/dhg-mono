#!/usr/bin/env ts-node

import { SupabaseClientService } from '../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250615_create_sys_archived_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Running archive table migration...');
    
    // Execute the migration
    const { error } = await supabase.rpc('execute_ddl', {
      ddl_statement: migrationSQL
    });
    
    if (error) {
      // If execute_ddl doesn't exist, try direct execution
      console.log('⚠️  execute_ddl not found, trying alternative approach...');
      
      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        // Note: Direct SQL execution through Supabase client is limited
        // This is a placeholder - in production, use proper migration tools
      }
      
      console.log('⚠️  Migration needs to be run through Supabase CLI or database admin tool');
      console.log('📝 Migration file: supabase/migrations/20250615_create_sys_archived_tables.sql');
    } else {
      console.log('✅ Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

runMigration();