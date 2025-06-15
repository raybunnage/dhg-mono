#!/usr/bin/env ts-node

import { SupabaseClientService } from '../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // List of migrations to run in order
  const migrations = [
    '20250615_create_sys_archived_tables.sql',
    '20250615_add_refactoring_fields_to_sys_cli_pipelines.sql',
    '20250615_migrate_registry_to_sys_cli_pipelines.sql'
  ];
  
  console.log('🚀 Running sys_cli_pipelines migrations...\n');
  
  for (const migration of migrations) {
    console.log(`📄 Migration: ${migration}`);
    console.log('━'.repeat(50));
    
    const migrationPath = path.join(__dirname, '../supabase/migrations', migration);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL by statements (naive split by semicolon at end of line)
    const statements = sql
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);
    
    // Note: Direct SQL execution through Supabase client is limited
    // In production, these should be run through proper migration tools
    console.log('⚠️  Note: These migrations need to be run through:');
    console.log('   1. Supabase Dashboard SQL Editor');
    console.log('   2. psql or another PostgreSQL client');
    console.log('   3. Supabase CLI with proper database connection\n');
    
    // Show first few lines of each statement for verification
    statements.forEach((stmt, idx) => {
      const preview = stmt.split('\n').slice(0, 3).join('\n');
      console.log(`Statement ${idx + 1}:`);
      console.log(preview);
      if (stmt.split('\n').length > 3) console.log('...');
      console.log('');
    });
    
    console.log('─'.repeat(50) + '\n');
  }
  
  console.log('📋 Migration files ready at:');
  migrations.forEach(m => {
    console.log(`   supabase/migrations/${m}`);
  });
  
  console.log('\n✅ Please run these migrations through your database tool of choice');
}

// Test if we can at least check table existence
async function checkTables() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log('\n🔍 Checking current table status...\n');
    
    // Check if sys_archived_tables exists
    const { data: archivedTable, error: archivedError } = await supabase
      .from('sys_archived_tables')
      .select('id')
      .limit(1);
    
    if (archivedError?.code === 'PGRST116') {
      console.log('❌ sys_archived_tables does not exist yet');
    } else if (archivedError) {
      console.log('⚠️  Error checking sys_archived_tables:', archivedError.message);
    } else {
      console.log('✅ sys_archived_tables exists');
    }
    
    // Check if registry_cli_pipelines exists
    const { count: registryCount, error: registryError } = await supabase
      .from('registry_cli_pipelines')
      .select('*', { count: 'exact', head: true });
    
    if (registryError) {
      console.log('⚠️  Error checking registry_cli_pipelines:', registryError.message);
    } else {
      console.log(`✅ registry_cli_pipelines exists with ${registryCount} records`);
    }
    
    // Check if sys_cli_pipelines exists
    const { count: sysCount, error: sysError } = await supabase
      .from('sys_cli_pipelines')
      .select('*', { count: 'exact', head: true });
    
    if (sysError) {
      console.log('⚠️  Error checking sys_cli_pipelines:', sysError.message);
    } else {
      console.log(`✅ sys_cli_pipelines exists with ${sysCount} records`);
    }
    
    // Check if refactoring fields exist
    const { data: sample, error: fieldError } = await supabase
      .from('sys_cli_pipelines')
      .select('name, refactoring_group, refactoring_status')
      .limit(1);
    
    if (fieldError?.message?.includes('refactoring_group')) {
      console.log('❌ Refactoring fields do not exist yet');
    } else if (fieldError) {
      console.log('⚠️  Error checking refactoring fields:', fieldError.message);
    } else {
      console.log('✅ Refactoring fields exist in sys_cli_pipelines');
    }
    
  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

// Run both functions
async function main() {
  await runMigrations();
  await checkTables();
}

main().catch(console.error);