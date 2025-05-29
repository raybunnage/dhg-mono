#!/usr/bin/env ts-node
/**
 * Show details for a specific command
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

// Parse command line arguments
const commandName = process.argv[2];

async function showCommand() {
  if (!commandName) {
    console.error('Error: Command name is required');
    console.log('Usage: show <command-name>');
    process.exit(1);
  }
  
  try {
    const { data: command, error } = await supabase
      .from('command_refactor_tracking')
      .select('*')
      .eq('command_name', commandName)
      .single();
    
    if (error || !command) {
      console.error(`❌ Command '${commandName}' not found`);
      process.exit(1);
    }
    
    console.log(`\n📋 Command: ${command.command_name}`);
    console.log('─'.repeat(60));
    
    console.log(`Type: ${command.command_type}`);
    console.log(`Status: ${getStatusEmoji(command.current_status)} ${command.current_status}`);
    
    if (command.description) {
      console.log(`\nDescription:\n  ${command.description}`);
    }
    
    if (command.test_criteria && command.test_criteria.length > 0) {
      console.log('\nTest Criteria:');
      command.test_criteria.forEach((criteria: string, index: number) => {
        console.log(`  ${index + 1}. ${criteria}`);
      });
    }
    
    if (command.test_results) {
      console.log(`\nTest Results:\n  ${command.test_results}`);
    }
    
    if (command.issues_found) {
      console.log(`\n⚠️  Issues Found:\n  ${command.issues_found}`);
    }
    
    if (command.notes) {
      console.log(`\nNotes:\n  ${command.notes}`);
    }
    
    if (command.signed_off_by) {
      console.log(`\n✍️  Signed off by: ${command.signed_off_by}`);
      console.log(`   Date: ${new Date(command.signed_off_at).toLocaleString()}`);
    }
    
    console.log(`\nCreated: ${new Date(command.created_at).toLocaleString()}`);
    console.log(`Updated: ${new Date(command.updated_at).toLocaleString()}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    'not_started': '⏳',
    'in_progress': '🔄',
    'needs_testing': '🧪',
    'tested': '✅',
    'signed_off': '🎉',
    'archived': '📦'
  };
  return emojis[status] || '❓';
}

showCommand();