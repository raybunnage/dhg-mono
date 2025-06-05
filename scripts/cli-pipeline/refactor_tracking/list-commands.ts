#!/usr/bin/env ts-node
/**
 * List commands with their status
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

// Parse command line arguments
const args = process.argv.slice(2);
const typeIndex = args.indexOf('--type');
const typeFilter = typeIndex !== -1 && args[typeIndex + 1] ? args[typeIndex + 1] : null;
const pipelineIndex = args.indexOf('--pipeline');
const pipelineFilter = pipelineIndex !== -1 && args[pipelineIndex + 1] ? args[pipelineIndex + 1] : null;

async function listCommands() {
  try {
    let query = supabase
      .from('command_refactor_tracking')
      .select('command_name, command_type, current_status, description, pipeline')
      .order('pipeline')
      .order('command_type')
      .order('command_name');
    
    if (typeFilter) {
      query = query.eq('command_type', typeFilter);
    }
    
    if (pipelineFilter) {
      query = query.eq('pipeline', pipelineFilter);
    }
    
    const { data: commands, error } = await query;
    
    if (error) throw error;
    
    if (!commands || commands.length === 0) {
      console.log('No commands found');
      return;
    }
    
    // Group by pipeline first, then by type
    const grouped: Record<string, Record<string, any[]>> = {};
    commands.forEach(cmd => {
      const pipeline = cmd.pipeline || 'unassigned';
      if (!grouped[pipeline]) {
        grouped[pipeline] = {};
      }
      if (!grouped[pipeline][cmd.command_type]) {
        grouped[pipeline][cmd.command_type] = [];
      }
      grouped[pipeline][cmd.command_type].push(cmd);
    });
    
    // Display
    Object.keys(grouped).sort().forEach(pipeline => {
      console.log(`\n🚀 PIPELINE: ${pipeline.toUpperCase()}`);
      console.log('═'.repeat(80));
      
      Object.keys(grouped[pipeline]).sort().forEach(type => {
        console.log(`\n  📁 ${type.toUpperCase()} COMMANDS:`);
        console.log('  ' + '─'.repeat(78));
        
        grouped[pipeline][type].forEach(cmd => {
          const statusEmoji = getStatusEmoji(cmd.current_status);
          const statusColor = getStatusColor(cmd.current_status);
          console.log(`  ${statusEmoji} ${cmd.command_name.padEnd(35)} ${statusColor}${cmd.current_status}${'\x1b[0m'}`);
          if (cmd.description) {
            console.log(`     ${cmd.description}`);
          }
        });
      });
    });
    
    // Summary
    console.log('\n' + '─'.repeat(80));
    console.log(`Total: ${commands.length} commands`);
    
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

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'not_started': '\x1b[90m',    // gray
    'in_progress': '\x1b[33m',     // yellow
    'needs_testing': '\x1b[35m',   // magenta
    'tested': '\x1b[36m',          // cyan
    'signed_off': '\x1b[32m',      // green
    'archived': '\x1b[90m'         // gray
  };
  return colors[status] || '';
}

listCommands();