#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

async function executeSql() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Read the SQL file
  const sqlPath = path.join(__dirname, 'update-google-sync-commands-fixed.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
  
  // Split by semicolons and filter out empty statements
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`🔧 Executing ${statements.length} SQL statements...\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const statement of statements) {
    try {
      // Use RPC to execute raw SQL
      const { error } = await supabase.rpc('execute_sql', {
        sql_query: statement + ';'
      });
      
      if (error) {
        console.error(`❌ Error executing statement:`, error.message);
        console.error(`Statement: ${statement.substring(0, 100)}...`);
        errorCount++;
      } else {
        successCount++;
        // Show progress for long operations
        if (successCount % 10 === 0) {
          console.log(`✅ Executed ${successCount} statements...`);
        }
      }
    } catch (err) {
      console.error(`❌ Exception executing statement:`, err);
      errorCount++;
    }
  }
  
  console.log(`\n✅ Successfully executed: ${successCount} statements`);
  if (errorCount > 0) {
    console.log(`❌ Failed: ${errorCount} statements`);
  }
  
  // Show updated summary
  console.log('\n📊 Updated Command Status Summary:');
  
  const { data: statusSummary } = await supabase
    .from('command_refactor_tracking')
    .select('current_status')
    .order('current_status');
  
  if (statusSummary) {
    // Count by status
    const statusCounts: Record<string, number> = {};
    statusSummary.forEach(row => {
      statusCounts[row.current_status] = (statusCounts[row.current_status] || 0) + 1;
    });
    
    console.log('\nBy Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Show total
    console.log(`\nTotal commands tracked: ${statusSummary.length}`);
  }
  
  // Show commands by action needed
  console.log('\n🎯 Commands by Action Needed:');
  
  const { data: keepCommands } = await supabase
    .from('command_refactor_tracking')
    .select('command_name')
    .or('current_status.eq.completed,current_status.eq.tested')
    .ilike('notes', '%KEEP%');
  
  const { data: refactorCommands } = await supabase
    .from('command_refactor_tracking')
    .select('command_name')
    .eq('current_status', 'refactor_needed');
  
  const { data: archiveCommands } = await supabase
    .from('command_refactor_tracking')
    .select('command_name')
    .eq('current_status', 'deprecated');
  
  console.log(`\n✅ Commands to KEEP: ${keepCommands?.length || 0}`);
  if (keepCommands && keepCommands.length > 0) {
    keepCommands.slice(0, 10).forEach(cmd => console.log(`   - ${cmd.command_name}`));
    if (keepCommands.length > 10) console.log(`   ... and ${keepCommands.length - 10} more`);
  }
  
  console.log(`\n🔄 Commands to REFACTOR: ${refactorCommands?.length || 0}`);
  if (refactorCommands && refactorCommands.length > 0) {
    refactorCommands.slice(0, 10).forEach(cmd => console.log(`   - ${cmd.command_name}`));
    if (refactorCommands.length > 10) console.log(`   ... and ${refactorCommands.length - 10} more`);
  }
  
  console.log(`\n📦 Commands to ARCHIVE: ${archiveCommands?.length || 0}`);
  if (archiveCommands && archiveCommands.length > 0) {
    archiveCommands.slice(0, 5).forEach(cmd => console.log(`   - ${cmd.command_name}`));
    if (archiveCommands.length > 5) console.log(`   ... and ${archiveCommands.length - 5} more`);
  }
}

executeSql().catch(console.error);