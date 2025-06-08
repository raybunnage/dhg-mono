#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function checkPipelineStatuses(): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Check current statuses
  const { data: pipelines, error } = await supabase
    .from('command_pipelines')
    .select('name, status')
    .order('status');
  
  if (error) {
    console.error('Error fetching pipelines:', error);
    return;
  }
  
  console.log('📊 Current Pipeline Statuses:');
  const statusCounts = new Map<string, number>();
  for (const p of pipelines || []) {
    statusCounts.set(p.status, (statusCounts.get(p.status) || 0) + 1);
  }
  
  for (const [status, count] of statusCounts) {
    console.log(`   ${status}: ${count} pipelines`);
  }
  
  console.log('\n🔍 Attempting to update status to "inactive":');
  
  const { error: updateError } = await supabase
    .from('command_pipelines')
    .update({ status: 'inactive' })
    .eq('name', 'documentation');
  
  if (updateError) {
    console.error('Update error:', updateError);
  } else {
    console.log('✅ Successfully updated status to "inactive"');
  }
}

checkPipelineStatuses().catch(console.error);