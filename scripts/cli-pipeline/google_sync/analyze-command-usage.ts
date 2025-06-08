#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface CommandUsageInfo {
  command_name: string;
  description: string | null;
  usage_count: number;
  last_used: string | null;
  file_path?: string;
}

async function analyzeGoogleSyncUsage(): Promise<CommandUsageInfo[]> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get google_sync pipeline ID
  const { data: pipeline } = await supabase
    .from('command_pipelines')
    .select('id')
    .eq('name', 'google_sync')
    .single();
    
  if (!pipeline) {
    console.error('Google sync pipeline not found');
    return [];
  }
  
  // Get all commands for google_sync
  const { data: commands, error: cmdError } = await supabase
    .from('command_definitions')
    .select('id, command_name, description')
    .eq('pipeline_id', pipeline.id)
    .order('command_name');
    
  if (cmdError) {
    console.error('Error fetching commands:', cmdError);
    return [];
  }
  
  // Get usage stats for last 2 months
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  
  const { data: usageData, error: usageError } = await supabase
    .from('command_tracking')
    .select('command_name, execution_time')
    .eq('pipeline_name', 'google_sync')
    .gte('execution_time', twoMonthsAgo.toISOString());
    
  if (usageError) {
    console.error('Error fetching usage data:', usageError);
  }
  
  // Process usage stats
  const usageStats: Record<string, number> = {};
  const lastUsed: Record<string, string> = {};
  
  usageData?.forEach(record => {
    usageStats[record.command_name] = (usageStats[record.command_name] || 0) + 1;
    if (!lastUsed[record.command_name] || record.execution_time > lastUsed[record.command_name]) {
      lastUsed[record.command_name] = record.execution_time;
    }
  });
  
  console.log('=== Google Sync Command Usage Analysis (Last 2 Months) ===\n');
  console.log('Command Name                        | Uses | Last Used');
  console.log('-----------------------------------|------|------------------------');
  
  const commandUsageInfo: CommandUsageInfo[] = [];
  
  commands?.forEach(cmd => {
    const usage = usageStats[cmd.command_name] || 0;
    const lastUse = lastUsed[cmd.command_name] || null;
    const lastUseStr = lastUse ? new Date(lastUse).toLocaleDateString() : 'Never';
    
    console.log(`${cmd.command_name.padEnd(35)}| ${usage.toString().padStart(4)} | ${lastUseStr}`);
    
    commandUsageInfo.push({
      command_name: cmd.command_name,
      description: cmd.description,
      usage_count: usage,
      last_used: lastUse
    });
  });
  
  const unusedCommands = commandUsageInfo.filter(cmd => cmd.usage_count === 0);
  
  console.log('\n=== Unused Commands (Candidates for Archiving) ===');
  if (unusedCommands.length === 0) {
    console.log('All commands have been used in the last 2 months!');
  } else {
    unusedCommands.forEach(cmd => {
      console.log(`- ${cmd.command_name}: ${cmd.description || 'No description'}`);
    });
  }
  
  return commandUsageInfo;
}

// Export for use in archiving script
export { analyzeGoogleSyncUsage, CommandUsageInfo };

// Run if called directly
if (require.main === module) {
  analyzeGoogleSyncUsage().catch(console.error);
}