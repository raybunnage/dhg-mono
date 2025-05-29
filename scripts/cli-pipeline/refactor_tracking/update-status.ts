#!/usr/bin/env ts-node
/**
 * Update the status of a command
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

// Parse command line arguments
const args = process.argv.slice(2);
const commandName = args[0];
const newStatus = args[1];

const validStatuses = ['not_started', 'in_progress', 'needs_testing', 'tested', 'signed_off', 'archived'];

async function updateStatus() {
  if (!commandName || !newStatus) {
    console.error('Error: Both command name and status are required');
    console.log('Usage: update <command-name> <status>');
    console.log(`Valid statuses: ${validStatuses.join(', ')}`);
    process.exit(1);
  }
  
  if (!validStatuses.includes(newStatus)) {
    console.error(`Error: Invalid status '${newStatus}'`);
    console.log(`Valid statuses: ${validStatuses.join(', ')}`);
    process.exit(1);
  }
  
  try {
    // First check if command exists
    const { data: existing } = await supabase
      .from('command_refactor_tracking')
      .select('command_name, current_status')
      .eq('command_name', commandName)
      .single();
    
    if (!existing) {
      console.error(`❌ Command '${commandName}' not found`);
      process.exit(1);
    }
    
    // Update the status
    const { error } = await supabase
      .from('command_refactor_tracking')
      .update({ current_status: newStatus })
      .eq('command_name', commandName);
    
    if (error) throw error;
    
    console.log(`✅ Updated ${commandName}:`);
    console.log(`   ${existing.current_status} → ${newStatus}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateStatus();