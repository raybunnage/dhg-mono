#\!/usr/bin/env node

/**
 * Filters out MP4 files that have already been transcribed
 */

const fs = require('fs');
const path = require('path');
const { Logger } = require('../../../../packages/shared/utils');
const { SupabaseClientService } = require('../../../../packages/shared/services/supabase-client');
const { LogLevel } = require('../../../../packages/shared/utils/logger');

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const inputFileIndex = args.indexOf('--input');
const inputFile = inputFileIndex !== -1 && args[inputFileIndex + 1] ? args[inputFileIndex + 1] : null;

async function processInput(inputText) {
  try {
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Parse the input for cp commands
    const copyCommands = inputText.split('\n').filter(line => line.trim().startsWith('cp '));
    if (copyCommands.length === 0) {
      console.log('\n=== UNTRANSCRIBED FILES ===\n');
      console.log('# No files to copy');
      process.exit(0);
    }
    
    // Extract filenames from commands
    const fileInfo = copyCommands.map(cmd => {
      const targetMatch = cmd.match(/cp ".*" ".*\/([^\/]+)"/);
      return {
        command: cmd,
        filename: targetMatch ? targetMatch[1] : null
      };
    }).filter(info => info.filename);
    
    // Get list of transcribed source files
    const { data: expertDocs } = await supabase
      .from('expert_documents')
      .select('source_id, sources_google!inner(name)')
      .not('raw_content', 'is', null);
    
    // Create set of already transcribed filenames
    const transcribedFiles = new Set(expertDocs.map(doc => doc.sources_google.name));
    
    // Filter out already transcribed files
    const untranscribedCommands = fileInfo
      .filter(info => !transcribedFiles.has(info.filename))
      .map(info => info.command);
    
    // Output result
    console.log('\n=== UNTRANSCRIBED FILES ===\n');
    console.log(untranscribedCommands.join('\n'));
    
    if (untranscribedCommands.length === 0) {
      console.log('# No untranscribed files to copy');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// If input file is specified, read from file
if (inputFile) {
  try {
    const inputText = fs.readFileSync(inputFile, 'utf8');
    processInput(inputText);
  } catch (error) {
    Logger.error(`Error reading input file: ${error.message}`);
    process.exit(1);
  }
} else {
  // Read list of copy commands from stdin
  let input = '';
  process.stdin.on('data', chunk => {
    input += chunk;
  });

  process.stdin.on('end', async () => {
    await processInput(input);
  });
}
