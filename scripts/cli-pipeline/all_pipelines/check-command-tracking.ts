#!/usr/bin/env ts-node
/**
 * Check command_tracking table structure and sample data
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

async function checkCommandTracking() {
  try {
    // Get sample tracking data
    const { data: tracking, error } = await supabase
      .from('command_tracking')
      .select('*')
      .limit(5)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log('=== COMMAND TRACKING SAMPLE ===');
    console.log(JSON.stringify(tracking, null, 2));
    
    // Get usage counts by pipeline and command
    const { data: usageCounts, error: countError } = await supabase
      .from('command_tracking')
      .select('pipeline_name, command_name')
      .order('pipeline_name, command_name');
    
    if (countError) throw countError;
    
    // Aggregate counts
    const counts: Record<string, Record<string, number>> = {};
    usageCounts?.forEach(record => {
      if (!counts[record.pipeline_name]) {
        counts[record.pipeline_name] = {};
      }
      if (!counts[record.pipeline_name][record.command_name]) {
        counts[record.pipeline_name][record.command_name] = 0;
      }
      counts[record.pipeline_name][record.command_name]++;
    });
    
    console.log('\n=== USAGE COUNTS BY PIPELINE ===');
    Object.entries(counts).forEach(([pipeline, commands]) => {
      console.log(`\n${pipeline}:`);
      Object.entries(commands)
        .sort(([, a], [, b]) => b - a)
        .forEach(([command, count]) => {
          console.log(`  ${command}: ${count} executions`);
        });
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCommandTracking();