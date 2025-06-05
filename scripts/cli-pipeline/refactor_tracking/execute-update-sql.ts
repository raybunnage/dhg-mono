#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

async function executeSql() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Read the SQL file
  const sqlPath = path.join(__dirname, 'update-google-sync-commands.sql');
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
  
  // Show summary of current status
  console.log('\n📊 Current Command Status Summary:');
  
  const { data: summary } = await supabase
    .from('command_refactor_tracking')
    .select('status, keep_or_archive, count:id')
    .order('status');
  
  if (summary) {
    // Group by status
    const statusGroups: Record<string, number> = {};
    const archiveGroups: Record<string, number> = {};
    
    // Since we can't use GROUP BY directly, we'll aggregate in JS
    const { data: allCommands } = await supabase
      .from('command_refactor_tracking')
      .select('status, keep_or_archive');
    
    if (allCommands) {
      allCommands.forEach(cmd => {
        statusGroups[cmd.status] = (statusGroups[cmd.status] || 0) + 1;
        archiveGroups[cmd.keep_or_archive] = (archiveGroups[cmd.keep_or_archive] || 0) + 1;
      });
      
      console.log('\nBy Status:');
      Object.entries(statusGroups).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      
      console.log('\nBy Action:');
      Object.entries(archiveGroups).forEach(([action, count]) => {
        console.log(`  ${action}: ${count}`);
      });
    }
  }
}

executeSql().catch(console.error);