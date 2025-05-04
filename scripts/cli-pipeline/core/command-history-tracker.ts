#!/usr/bin/env ts-node
/**
 * Command History Tracker
 * 
 * This script helps track command history by wrapping command execution
 * and recording the results in the Supabase database.
 * 
 * Usage:
 *   ts-node command-history-tracker.ts [category] [command]
 * 
 * Example:
 *   ts-node command-history-tracker.ts git "git push origin main"
 *   ts-node command-history-tracker.ts pnpm "pnpm install marked"
 * 
 * Note: This script requires ts-node to be installed globally or in your project.
 */

import { spawn } from 'child_process';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import path from 'path';

// Use the singleton SupabaseClientService instead of creating a new client
const supabase = SupabaseClientService.getInstance().getClient();

// Command categories
const validCategories = [
  'git', 'pnpm', 'build', 'deploy', 'database', 'system', 'other',
  'media_processing', 'document_pipeline', 'google_sync', 'presentations',
  'prompt_service', 'script_pipeline', 'experts'
];

// Parse arguments
const category = process.argv[2];
const command = process.argv[3];

if (!category || !command) {
  console.error('Usage: ts-node command-history-tracker.ts [category] [command]');
  console.error(`Valid categories: ${validCategories.join(', ')}`);
  process.exit(1);
}

if (!validCategories.includes(category)) {
  console.error(`Error: Invalid category '${category}'`);
  console.error(`Valid categories: ${validCategories.join(', ')}`);
  process.exit(1);
}

/**
 * Record command execution in the database
 */
async function recordCommand(
  command: string,
  category: string,
  exitCode: number,
  durationMs: number
): Promise<void> {
  try {
    // Get category ID
    const { data: categoryData, error: categoryError } = await supabase
      .from('command_categories')
      .select('id')
      .eq('name', category)
      .single();

    if (categoryError || !categoryData) {
      console.error(`Error: Category '${category}' not found`);
      return;
    }

    // Sanitize command
    const { data: sanitizedData, error: sanitizeError } = await supabase
      .rpc('sanitize_command', { command_text: command });

    if (sanitizeError) {
      console.error('Error sanitizing command:', sanitizeError);
      return;
    }

    const sanitizedCommand = sanitizedData || command;

    // Insert command history
    const { error: insertError } = await supabase
      .from('command_history')
      .insert({
        command_text: command,
        sanitized_command: sanitizedCommand,
        category_id: categoryData.id,
        exit_code: exitCode,
        success: exitCode === 0,
        duration_ms: durationMs
      });

    if (insertError) {
      console.error('Error recording command:', insertError);
    } else {
      console.log('Command recorded successfully');
    }
  } catch (error) {
    console.error('Error in recordCommand:', error);
  }
}

/**
 * Execute the command and record its execution
 */
async function executeCommand(command: string, category: string): Promise<void> {
  console.log(`Executing command: ${command}`);
  
  // Split the command into parts
  const parts = command.split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);
  
  const startTime = Date.now();
  
  // Spawn the command
  const childProcess = spawn(cmd, args, {
    stdio: 'inherit',
    shell: true
  });
  
  // Handle command completion
  childProcess.on('close', async (code) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Command exited with code ${code}`);
    console.log(`Duration: ${duration}ms`);
    
    await recordCommand(command, category, code || 0, duration);
    process.exit(code || 0);
  });
  
  // Handle errors
  childProcess.on('error', (error) => {
    console.error(`Error executing command: ${error.message}`);
    process.exit(1);
  });
}

// Execute the command
executeCommand(command, category).catch(error => {
  console.error('Error:', error);
  process.exit(1);
}); 