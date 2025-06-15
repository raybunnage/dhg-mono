#!/usr/bin/env ts-node
/**
 * Apply Phase 1 Continuous Improvement migration using execute_sql
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client.js';
import fs from 'fs/promises';
import path from 'path';

async function applyMigration() {
  console.log('🚀 Applying Phase 1 Continuous Improvement migration...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Read the simplified SQL file
  const sqlPath = path.join(__dirname, 'phase1-tables-only.sql');
  const sqlContent = await fs.readFile(sqlPath, 'utf-8');
  
  // Execute the entire migration as one block
  console.log('📊 Creating tables and indexes...');
  
  try {
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql_query: sqlContent 
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      console.log('\nError details:');
      console.log('  Code:', error.code);
      console.log('  Message:', error.message);
      console.log('  Details:', error.details);
      
      // If execute_sql fails, provide manual instructions
      console.log('\n💡 To apply manually:');
      console.log('1. Go to: https://supabase.com/dashboard/project/jdksnfkupzywjdfefkyj/sql');
      console.log('2. Copy the content from: scripts/cli-pipeline/continuous/phase1-tables-only.sql');
      console.log('3. Paste and execute in the SQL editor');
      
      return false;
    }
    
    console.log('✅ Migration executed successfully!');
    console.log('   Result:', data);
    
    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const tables = ['continuous_inventory', 'continuous_test_runs', 'continuous_issues'];
    let allGood = true;
    
    for (const table of tables) {
      const { error: checkError } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (checkError?.code === '42P01') {
        console.log(`❌ Table '${table}' was not created`);
        allGood = false;
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }
    
    // Check view
    const { error: viewError } = await supabase
      .from('continuous_summary_view')
      .select('*')
      .single();
    
    if (viewError?.code === '42P01') {
      console.log('❌ View continuous_summary_view was not created');
      allGood = false;
    } else {
      console.log('✅ View continuous_summary_view exists');
    }
    
    if (allGood) {
      console.log('\n🎉 All Phase 1 tables created successfully!');
      console.log('\nYou can now run:');
      console.log('  ./scripts/cli-pipeline/continuous/continuous-cli.sh discover');
      return true;
    } else {
      console.log('\n⚠️  Some tables were not created. Check the SQL editor for errors.');
      return false;
    }
    
  } catch (e) {
    console.error('❌ Unexpected error:', e);
    return false;
  }
}

// Run
if (require.main === module) {
  applyMigration()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}