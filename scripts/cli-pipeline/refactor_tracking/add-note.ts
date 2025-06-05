#!/usr/bin/env ts-node
/**
 * Add a note to a command
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

// Parse command line arguments
const args = process.argv.slice(2);
const commandName = args[0];
const note = args.slice(1).join(' ');

async function addNote() {
  if (!commandName || !note) {
    console.error('Error: Both command name and note are required');
    console.log('Usage: add-note <command-name> <note text>');
    process.exit(1);
  }
  
  try {
    // Get existing notes
    const { data: existing } = await supabase
      .from('command_refactor_tracking')
      .select('notes')
      .eq('command_name', commandName)
      .single();
    
    if (!existing) {
      console.error(`❌ Command '${commandName}' not found`);
      process.exit(1);
    }
    
    // Append note with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const newNote = `[${timestamp}] ${note}`;
    const updatedNotes = existing.notes 
      ? `${existing.notes}\n${newNote}`
      : newNote;
    
    // Update
    const { error } = await supabase
      .from('command_refactor_tracking')
      .update({ notes: updatedNotes })
      .eq('command_name', commandName);
    
    if (error) throw error;
    
    console.log(`✅ Note added to ${commandName}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addNote();