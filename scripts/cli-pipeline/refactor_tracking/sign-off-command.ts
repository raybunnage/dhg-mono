#!/usr/bin/env ts-node
/**
 * Sign off on a command as complete
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

async function signOffCommand() {
  if (!commandName) {
    console.error('Error: Command name is required');
    console.log('Usage: sign-off <command-name>');
    process.exit(1);
  }
  
  try {
    // Check if command exists and is tested
    const { data: existing } = await supabase
      .from('command_refactor_tracking')
      .select('*')
      .eq('command_name', commandName)
      .single();
    
    if (!existing) {
      console.error(`❌ Command '${commandName}' not found`);
      process.exit(1);
    }
    
    if (existing.current_status !== 'tested') {
      console.error(`❌ Command must be in 'tested' status before sign-off`);
      console.error(`   Current status: ${existing.current_status}`);
      process.exit(1);
    }
    
    console.log(`\n🎯 Signing off on '${commandName}'\n`);
    
    // Show current state
    if (existing.description) {
      console.log(`Description: ${existing.description}`);
    }
    if (existing.test_results) {
      console.log(`\nTest Results: ${existing.test_results}`);
    }
    if (existing.issues_found) {
      console.log(`\n⚠️  Issues Found: ${existing.issues_found}`);
    }
    
    // Confirm sign-off
    const confirm = await question('\nConfirm sign-off? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Sign-off cancelled');
      rl.close();
      return;
    }
    
    const signedBy = await question('Your name: ');
    
    // Update the record
    const { error } = await supabase
      .from('command_refactor_tracking')
      .update({
        current_status: 'signed_off',
        signed_off_by: signedBy,
        signed_off_at: new Date().toISOString()
      })
      .eq('command_name', commandName);
    
    if (error) throw error;
    
    console.log(`\n🎉 ${commandName} signed off by ${signedBy}`);
    
    rl.close();
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

signOffCommand();