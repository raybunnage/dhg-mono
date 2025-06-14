#!/usr/bin/env ts-node

import { supabase } from '../../../packages/shared/services/supabase-client/universal';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyTestingMigration() {
  try {
    
    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase/migrations/20250610_create_service_testing_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('🚀 Applying testing infrastructure migration...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('execute_sql', { sql_query: statement });
        if (error) {
          console.error(`Error executing statement: ${error.message}`);
          if (!error.message.includes('already exists')) {
            throw error;
          } else {
            console.log('  → Statement already applied, skipping...');
          }
        } else {
          console.log('  ✅ Success');
        }
      }
    }
    
    console.log('✅ Testing infrastructure migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  applyTestingMigration();
}