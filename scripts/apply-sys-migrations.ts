#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as path from 'path';

console.log('🚀 Applying sys_cli_pipelines migrations...\n');

// Since we can't run migrations directly through the API, 
// let's prepare them for manual execution

const migrations = [
  '20250615_create_sys_archived_tables.sql',
  '20250615_add_refactoring_fields_to_sys_cli_pipelines.sql', 
  '20250615_migrate_registry_to_sys_cli_pipelines.sql'
];

console.log('📋 Migration files prepared:\n');
migrations.forEach((migration, index) => {
  const migrationPath = path.join(__dirname, '../supabase/migrations', migration);
  console.log(`${index + 1}. ${migration}`);
  console.log(`   Path: ${migrationPath}`);
});

console.log('\n⚠️  Please run these migrations manually through:');
console.log('   - Supabase Dashboard SQL Editor');
console.log('   - psql or pgAdmin');
console.log('   - Supabase CLI (if you have local db running)');

console.log('\n📝 After migrations are applied, run:');
console.log('   ts-node scripts/complete-sys-migration.ts');

// Let's at least run the refactoring update script since it doesn't require migrations
console.log('\n🔄 Preparing refactoring status update...');
console.log('   This will be run after migrations are applied.');

// Check if we can at least verify table status
try {
  console.log('\n🔍 Attempting to check current status...');
  execSync('ts-node scripts/run-sys-cli-pipelines-migrations.ts', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  console.error('Error checking status:', error);
}