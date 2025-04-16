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
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables in order of precedence
const repoRoot = path.resolve(__dirname, '../..');
const envLocal = path.join(repoRoot, '.env.local');
const envDev = path.join(repoRoot, '.env.development');
const envBase = path.join(repoRoot, '.env');
const appEnvDev = path.join(repoRoot, 'apps/dhg-improve-experts/.env.development');

// Load base .env first (lowest precedence)
if (fs.existsSync(envBase)) {
  console.log(`Loading base environment variables from ${envBase}`);
  dotenv.config({ path: envBase });
}

// Load environment-specific variables
if (fs.existsSync(envDev)) {
  console.log(`Loading environment-specific variables from ${envDev}`);
  dotenv.config({ path: envDev });
}

// Load local variables (highest precedence)
if (fs.existsSync(envLocal)) {
  console.log(`Loading local environment variables from ${envLocal}`);
  dotenv.config({ path: envLocal });
}

// Fallback to app-specific .env.development if needed
if (fs.existsSync(appEnvDev)) {
  console.log(`Loading app-specific environment variables from ${appEnvDev}`);
  dotenv.config({ path: appEnvDev });
}

// Supabase client setup - try CLI_ prefixed variables first, then fall back
const supabaseUrl = process.env.CLI_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.CLI_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase connection details not found in environment variables');
  console.error('Please set CLI_SUPABASE_URL and CLI_SUPABASE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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