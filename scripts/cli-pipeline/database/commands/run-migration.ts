#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration(migrationFile: string) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Construct full path to migration file
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations',
    migrationFile
  );
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }
  
  console.log(`Running migration: ${migrationFile}`);
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolons but be careful about strings containing semicolons
    const statements = sql
      .split(/;\s*$/gm)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    console.log(`Found ${statements.length} SQL statements`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments-only statements
      if (statement.replace(/--.*$/gm, '').trim() === ';') {
        continue;
      }
      
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
      
      const { error } = await supabase.rpc('execute_sql', {
        query: statement
      });
      
      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
        throw error;
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    // Regenerate types
    console.log('\n🔄 Regenerating TypeScript types...');
    const { exec } = require('child_process');
    exec('pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts', (error, stdout, stderr) => {
      if (error) {
        console.error('Failed to regenerate types:', error);
      } else {
        console.log('✅ Types regenerated successfully!');
      }
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Get migration file from command line
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: ts-node run-migration.ts <migration-file>');
  process.exit(1);
}

runMigration(migrationFile);