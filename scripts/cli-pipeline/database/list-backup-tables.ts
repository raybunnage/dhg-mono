#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function listBackupTables() {
  console.log('📋 Listing backup tables...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Method 1: Use the view
    console.log('📊 Querying backup inventory view:');
    const { data: viewData, error: viewError } = await supabase
      .from('backup_inventory_view')
      .select('*')
      .order('backup_date', { ascending: false });
    
    if (viewError) {
      console.error('❌ Error querying view:', viewError.message);
    } else if (viewData && viewData.length > 0) {
      console.log(`✅ Found ${viewData.length} backup tables:\n`);
      
      // Group by original table
      const byTable: Record<string, any[]> = {};
      viewData.forEach(backup => {
        if (!byTable[backup.original_table_name]) {
          byTable[backup.original_table_name] = [];
        }
        byTable[backup.original_table_name].push(backup);
      });
      
      // Display grouped results
      Object.entries(byTable).forEach(([table, backups]) => {
        console.log(`\n📁 ${table} (${backups.length} backups):`);
        backups.forEach(backup => {
          console.log(`   - ${backup.backup_table_name}`);
          console.log(`     Date: ${new Date(backup.backup_date).toLocaleDateString()}`);
          console.log(`     Rows: ${backup.row_count || 'Unknown'}`);
          console.log(`     Reason: ${backup.backup_reason || 'Not specified'}`);
        });
      });
    } else {
      console.log('ℹ️ No backup tables found');
    }
    
    // Method 2: Use the function
    console.log('\n\n📊 Using get_backup_tables function:');
    const { data: funcData, error: funcError } = await supabase
      .rpc('get_backup_tables');
    
    if (funcError) {
      console.error('❌ Error calling function:', funcError.message);
    } else if (funcData && funcData.length > 0) {
      console.log(`✅ Function returned ${funcData.length} backup entries`);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
listBackupTables().catch(console.error);