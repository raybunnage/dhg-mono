#!/usr/bin/env ts-node
/**
 * Show tables structure
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function showTables(): Promise<void> {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get a list of tables
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');
      
    if (tablesError) {
      console.error(`Error fetching tables: ${tablesError.message}`);
      return;
    }
    
    if (!tables || tables.length === 0) {
      console.log('No tables found.');
      return;
    }
    
    console.log(`Found ${tables.length} tables:`);
    for (const table of tables) {
      console.log(`- ${table}`);
    }
    
    // Show expert_documents columns if it exists
    if (tables.includes('expert_documents')) {
      console.log('\nFetching columns for expert_documents table:');
      
      const { data: columns, error: columnsError } = await supabase
        .rpc('get_columns', { table_name: 'expert_documents' });
        
      if (columnsError) {
        console.error(`Error fetching columns: ${columnsError.message}`);
      } else if (columns) {
        console.log('Columns for expert_documents table:');
        columns.forEach((col: any) => {
          console.log(`- ${col.column_name} (${col.data_type})`);
        });
      }
    }
    
  } catch (error: any) {
    console.error(`Error showing tables: ${error.message || error}`);
  }
}

// Run the function
showTables();