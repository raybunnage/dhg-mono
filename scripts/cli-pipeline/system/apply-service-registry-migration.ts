#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📋 Applying service registry migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../../../supabase/migrations/20250606000000_create_service_dependency_mapping_system.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: migrationContent
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('\n📊 Verifying tables...');
    
    // Verify tables were created
    const tables = [
      'sys_shared_services',
      'sys_applications', 
      'sys_cli_pipelines',
      'sys_app_service_dependencies',
      'sys_pipeline_service_dependencies',
      'sys_service_dependencies'
    ];
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        console.error(`❌ Table ${table} check failed:`, error);
      } else {
        console.log(`✅ Table ${table} exists (${count || 0} rows)`);
      }
    }
    
    console.log('\n🎉 Service registry system is ready!');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

applyMigration();