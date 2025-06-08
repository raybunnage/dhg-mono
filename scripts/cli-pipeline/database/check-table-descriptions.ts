#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

async function checkTableDescriptions() {
  // Get all tables with metadata
  const { data, error } = await supabase
    .rpc('get_all_tables_with_metadata');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Filter public schema tables
  const publicTables = data.filter((t: any) => t.table_schema === 'public');
  
  console.log('Tables with descriptions:');
  publicTables
    .filter((t: any) => t.description)
    .forEach((t: any) => console.log(`  - ${t.table_name}: ${t.description}`));
    
  console.log('\nTables WITHOUT descriptions:');
  publicTables
    .filter((t: any) => !t.description)
    .forEach((t: any) => console.log(`  - ${t.table_name}`));
    
  console.log(`\nTotal: ${publicTables.filter((t: any) => t.description).length} with descriptions, ${publicTables.filter((t: any) => !t.description).length} without`);
}

checkTableDescriptions().catch(console.error);