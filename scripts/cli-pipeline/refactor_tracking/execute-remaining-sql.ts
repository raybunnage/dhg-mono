#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

async function executeSql() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Read the SQL file
  const sqlPath = path.join(__dirname, 'insert-remaining-commands.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
  
  // Execute as one statement since it's a single INSERT with ON CONFLICT
  try {
    const { error } = await supabase.rpc('execute_sql', {
      sql_query: sqlContent
    });
    
    if (error) {
      console.error(`❌ Error executing SQL:`, error.message);
    } else {
      console.log(`✅ Successfully inserted remaining commands`);
    }
  } catch (err) {
    console.error(`❌ Exception executing SQL:`, err);
  }
  
  // Show final summary
  console.log('\n📊 Final Command Refactor Tracking Summary:');
  
  const { data: allCommands } = await supabase
    .from('command_refactor_tracking')
    .select('current_status, command_type');
  
  if (allCommands) {
    // Count by status
    const statusCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    
    allCommands.forEach(cmd => {
      statusCounts[cmd.current_status] = (statusCounts[cmd.current_status] || 0) + 1;
      typeCounts[cmd.command_type] = (typeCounts[cmd.command_type] || 0) + 1;
    });
    
    console.log('\n🎯 By Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    console.log('\n📦 By Type:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log(`\n📊 Total commands tracked: ${allCommands.length}`);
  }
  
  // Show action summary
  const { data: keepCommands } = await supabase
    .from('command_refactor_tracking')
    .select('command_name, notes')
    .or('current_status.eq.completed,current_status.eq.tested,current_status.eq.in_progress')
    .ilike('notes', '%KEEP%');
  
  const { data: refactorCommands } = await supabase
    .from('command_refactor_tracking')
    .select('command_name, notes')
    .eq('current_status', 'refactor_needed');
  
  const { data: archiveCommands } = await supabase
    .from('command_refactor_tracking')
    .select('command_name')
    .eq('current_status', 'deprecated');
  
  console.log('\n🎬 ACTION SUMMARY:');
  console.log(`✅ Commands to KEEP: ${keepCommands?.length || 0}`);
  console.log(`🔄 Commands to REFACTOR: ${refactorCommands?.length || 0}`);
  console.log(`📦 Commands to ARCHIVE: ${archiveCommands?.length || 0}`);
  
  // Show keep commands
  console.log('\n✅ Core Commands to Keep:');
  keepCommands?.forEach(cmd => {
    console.log(`   - ${cmd.command_name}`);
  });
  
  // Show refactor groups
  console.log('\n🔄 Refactoring Plan:');
  const refactorGroups: Record<string, string[]> = {};
  
  refactorCommands?.forEach(cmd => {
    const match = cmd.notes.match(/Refactor into: (\w+)/);
    if (match) {
      const target = match[1];
      if (!refactorGroups[target]) refactorGroups[target] = [];
      refactorGroups[target].push(cmd.command_name);
    }
  });
  
  Object.entries(refactorGroups).forEach(([target, commands]) => {
    console.log(`\n   ${target} command (${commands.length} commands to merge):`);
    commands.slice(0, 5).forEach(cmd => console.log(`     - ${cmd}`));
    if (commands.length > 5) console.log(`     ... and ${commands.length - 5} more`);
  });
}

executeSql().catch(console.error);