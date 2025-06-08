#!/usr/bin/env ts-node
/**
 * List commands that need attention
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

async function needsWork() {
  try {
    const { data: commands, error } = await supabase
      .from('command_refactor_needing_attention_view')
      .select('*')
      .order('priority')
      .order('command_name');
    
    if (error) throw error;
    
    if (!commands || commands.length === 0) {
      console.log('🎉 All commands are signed off or archived!');
      return;
    }
    
    console.log('\n🔧 Commands Needing Attention:\n');
    
    // Group by status
    const byStatus: Record<string, any[]> = {};
    commands.forEach(cmd => {
      if (!byStatus[cmd.current_status]) {
        byStatus[cmd.current_status] = [];
      }
      byStatus[cmd.current_status].push(cmd);
    });
    
    const statusOrder = ['not_started', 'in_progress', 'needs_testing', 'tested'];
    
    statusOrder.forEach(status => {
      if (byStatus[status] && byStatus[status].length > 0) {
        console.log(`${getStatusEmoji(status)} ${status.toUpperCase()} (${byStatus[status].length}):`);
        console.log('─'.repeat(60));
        
        byStatus[status].forEach(cmd => {
          console.log(`  • ${cmd.command_name} (${cmd.command_type})`);
          if (cmd.description) {
            console.log(`    ${cmd.description}`);
          }
        });
        console.log('');
      }
    });
    
    // Summary
    console.log('📊 Summary:');
    console.log(`   Total commands needing work: ${commands.length}`);
    
    // Suggestions
    console.log('\n💡 Suggested actions:');
    if (byStatus['not_started'] && byStatus['not_started'].length > 0) {
      console.log('   - Start with "not_started" commands');
      console.log('   - Use: update <command> in_progress');
    }
    if (byStatus['needs_testing'] && byStatus['needs_testing'].length > 0) {
      console.log('   - Test commands marked as "needs_testing"');
      console.log('   - Use: test-complete <command>');
    }
    if (byStatus['tested'] && byStatus['tested'].length > 0) {
      console.log('   - Sign off on tested commands');
      console.log('   - Use: sign-off <command>');
    }
    
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

needsWork();