#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const fs = require('fs');
const path = require('path');

async function applyViewsMigration() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📋 Applying views support migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../../../supabase/migrations/20250607000000_add_views_to_sys_table_definitions.sql');
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
    
    // Test the new functionality
    console.log('\n📊 Testing view population...');
    
    const { error: populateError } = await supabase.rpc('populate_view_definitions');
    
    if (populateError) {
      console.error('❌ Error populating views:', populateError);
    } else {
      console.log('✅ Views populated successfully!');
      
      // Count views
      const { count: viewCount, error: countError } = await supabase
        .from('sys_table_definitions')
        .select('*', { count: 'exact', head: true })
        .eq('object_type', 'view');
        
      if (!countError) {
        console.log(`\n📊 Found ${viewCount || 0} views in sys_table_definitions`);
      }
    }
    
    console.log('\n🎉 View support is now enabled in sys_table_definitions!');
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

applyViewsMigration();