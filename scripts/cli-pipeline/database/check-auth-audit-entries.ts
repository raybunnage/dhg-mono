#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkAuthAuditEntries() {
  console.log('🔍 Checking all auth_audit_log entries\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // Get all recent entries
    const { data: allLogs, error } = await supabase
      .from('auth_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log(`Found ${allLogs?.length || 0} recent auth_audit_log entries:\n`);

    allLogs?.forEach((log, index) => {
      console.log(`Entry ${index + 1}:`);
      console.log(`  Event Type: ${log.event_type}`);
      console.log(`  Created: ${log.created_at}`);
      console.log(`  User ID: ${log.user_id || 'NULL'}`);
      console.log(`  Metadata:`, JSON.stringify(log.metadata, null, 2));
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAuthAuditEntries().catch(console.error);