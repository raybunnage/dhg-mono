#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env.development') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!
);

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