#!/usr/bin/env ts-node
/**
 * Check which tables are missing from sys_table_definitions
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

async function checkMissingDefinitions() {
  console.log('🔍 Checking for tables without definitions...\n');
  
  try {
    // Get all tables from information_schema
    const { data: allTables, error: tablesError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT 
          t.table_name,
          obj_description(c.oid) as table_comment,
          CASE 
            WHEN td.table_name IS NOT NULL THEN true
            ELSE false
          END as has_definition
        FROM information_schema.tables t
        LEFT JOIN pg_class c ON c.relname = t.table_name
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
        LEFT JOIN sys_table_definitions td ON td.table_name = t.table_name
        WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name LIKE ANY(ARRAY['worktree_%', 'import_%', 'registry_%', 'service_%'])
        ORDER BY t.table_name;
      `
    });
    
    if (tablesError) {
      // Fallback approach without execute_sql
      console.log('⚠️  execute_sql not available, using alternative approach...\n');
      
      // Get tables with specific prefixes
      const prefixes = ['worktree_', 'import_', 'registry_', 'service_'];
      const allTablesList: string[] = [];
      
      // Check each prefix
      for (const prefix of prefixes) {
        const { count, error } = await supabase
          .from('sys_table_definitions')
          .select('*', { count: 'exact', head: true })
          .like('table_name', `${prefix}%`);
          
        if (!error && count !== null) {
          console.log(`   ${prefix}* tables in sys_table_definitions: ${count}`);
        }
      }
      
      return;
    }
    
    const tablesWithoutDefs = allTables?.filter(t => !t.has_definition) || [];
    const tablesWithDefs = allTables?.filter(t => t.has_definition) || [];
    
    console.log(`📊 Summary:`);
    console.log(`   Total tables found: ${allTables?.length || 0}`);
    console.log(`   Tables with definitions: ${tablesWithDefs.length}`);
    console.log(`   Tables WITHOUT definitions: ${tablesWithoutDefs.length}\n`);
    
    if (tablesWithoutDefs.length > 0) {
      console.log('❌ Tables missing from sys_table_definitions:\n');
      tablesWithoutDefs.forEach(t => {
        console.log(`   - ${t.table_name}${t.table_comment ? ` (comment: ${t.table_comment})` : ''}`);
      });
      
      console.log('\n💡 Run "./database-cli.sh update-definitions" to add missing definitions');
    } else {
      console.log('✅ All tables have definitions!');
    }
    
    // Group by prefix
    console.log('\n📂 Tables by prefix:\n');
    const prefixGroups: Record<string, any[]> = {};
    allTables?.forEach(t => {
      const prefix = t.table_name.split('_')[0];
      if (!prefixGroups[prefix]) {
        prefixGroups[prefix] = [];
      }
      prefixGroups[prefix].push(t);
    });
    
    Object.entries(prefixGroups).forEach(([prefix, tables]) => {
      const withDefs = tables.filter(t => t.has_definition).length;
      const withoutDefs = tables.filter(t => !t.has_definition).length;
      console.log(`   ${prefix}_*: ${tables.length} total (${withDefs} with defs, ${withoutDefs} without)`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMissingDefinitions().catch(console.error);