#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkArchiveTable() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    const { data, error } = await supabase
      .from('sys_archived_tables')
      .select('id')
      .limit(1);
    
    if (error?.code === 'PGRST116') {
      console.log('❌ sys_archived_tables does not exist');
      console.log('   Please run migration: 20250615_create_sys_archived_tables.sql');
      process.exit(1);
    } else if (error) {
      console.error('❌ Error checking sys_archived_tables:', error);
      process.exit(1);
    } else {
      console.log('✅ sys_archived_tables exists and is accessible');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkArchiveTable();