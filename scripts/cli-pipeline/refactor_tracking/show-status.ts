#!/usr/bin/env ts-node
/**
 * Show overall refactoring status
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

async function showStatus() {
  console.log('\n=== Google Sync Command Refactoring Status ===\n');
  
  try {
    // Get summary by type and status
    const { data: summary, error } = await supabase
      .from('command_refactor_status_summary')
      .select('*')
      .order('command_type')
      .order('current_status');
    
    if (error) throw error;
    
    // Calculate totals
    const totals = {
      existing: { total: 0, signed_off: 0 },
      new: { total: 0, signed_off: 0 },
      to_archive: { total: 0, archived: 0 }
    };
    
    summary?.forEach(row => {
      const type = row.command_type as keyof typeof totals;
      if (type in totals) {
        totals[type].total += row.count;
        if (row.current_status === 'signed_off') {
          if (type === 'existing' || type === 'new') {
            totals[type].signed_off += row.count;
          }
        } else if (row.current_status === 'archived' && type === 'to_archive') {
          totals.to_archive.archived += row.count;
        }
      }
    });
    
    // Display overview
    console.log('📊 Overview:');
    console.log(`   Existing Commands: ${totals.existing.signed_off}/${totals.existing.total} signed off`);
    console.log(`   New Commands: ${totals.new.signed_off}/${totals.new.total} signed off`);
    console.log(`   To Archive: ${totals.to_archive.archived}/${totals.to_archive.total} archived`);
    
    // Calculate overall progress
    const totalCommands = totals.existing.total + totals.new.total + totals.to_archive.total;
    const completedCommands = totals.existing.signed_off + totals.new.signed_off + totals.to_archive.archived;
    const progressPercent = totalCommands > 0 ? Math.round((completedCommands / totalCommands) * 100) : 0;
    
    console.log(`\n📈 Overall Progress: ${completedCommands}/${totalCommands} (${progressPercent}%)`);
    
    // Show breakdown by status
    console.log('\n📋 Status Breakdown:\n');
    
    const statusGroups: Record<string, any[]> = {};
    summary?.forEach(row => {
      if (!statusGroups[row.current_status]) {
        statusGroups[row.current_status] = [];
      }
      statusGroups[row.current_status].push(row);
    });
    
    const statusOrder = ['not_started', 'in_progress', 'needs_testing', 'tested', 'signed_off', 'archived'];
    
    statusOrder.forEach(status => {
      if (statusGroups[status]) {
        const emoji = getStatusEmoji(status);
        console.log(`${emoji} ${status}:`);
        statusGroups[status].forEach(row => {
          console.log(`   - ${row.command_type}: ${row.count}`);
        });
        console.log('');
      }
    });
    
    // Get recently updated commands
    const { data: recentUpdates } = await supabase
      .from('command_refactor_tracking')
      .select('command_name, current_status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (recentUpdates && recentUpdates.length > 0) {
      console.log('🕐 Recently Updated:');
      recentUpdates.forEach(cmd => {
        const date = new Date(cmd.updated_at).toLocaleDateString();
        console.log(`   - ${cmd.command_name}: ${cmd.current_status} (${date})`);
      });
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

showStatus();