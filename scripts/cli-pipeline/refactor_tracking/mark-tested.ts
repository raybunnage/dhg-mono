#!/usr/bin/env ts-node
/**
 * Mark a command as tested with results
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as readline from 'readline';

const supabase = SupabaseClientService.getInstance().getClient();

// Parse command line arguments
const commandName = process.argv[2];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function markTested() {
  if (!commandName) {
    console.error('Error: Command name is required');
    console.log('Usage: test-complete <command-name>');
    process.exit(1);
  }
  
  try {
    // Check if command exists
    const { data: existing } = await supabase
      .from('command_refactor_tracking')
      .select('*')
      .eq('command_name', commandName)
      .single();
    
    if (!existing) {
      console.error(`❌ Command '${commandName}' not found`);
      process.exit(1);
    }
    
    console.log(`\n📋 Marking '${commandName}' as tested\n`);
    
    // Show test criteria
    if (existing.test_criteria && existing.test_criteria.length > 0) {
      console.log('Test Criteria:');
      existing.test_criteria.forEach((criteria: string, index: number) => {
        console.log(`  ${index + 1}. ${criteria}`);
      });
      console.log('');
    }
    
    // Get test results
    const testResults = await question('Enter test results (what was tested and outcomes): ');
    const issuesFound = await question('Any issues found? (leave blank if none): ');
    
    // Update the record
    const updateData: any = {
      current_status: 'tested',
      test_results: testResults
    };
    
    if (issuesFound) {
      updateData.issues_found = issuesFound;
    }
    
    const { error } = await supabase
      .from('command_refactor_tracking')
      .update(updateData)
      .eq('command_name', commandName);
    
    if (error) throw error;
    
    console.log(`\n✅ ${commandName} marked as tested`);
    
    if (issuesFound) {
      console.log('⚠️  Issues were recorded - command may need additional work');
    } else {
      console.log('💡 Command is ready for sign-off');
    }
    
    rl.close();
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

markTested();