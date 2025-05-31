/**
 * Direct Database Sync Script
 * 
 * This script directly syncs script files with the database using
 * SupabaseClientService singleton pattern instead of relying on database functions
 */
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Initialize Supabase using SupabaseClientService singleton
function initSupabase(): SupabaseClient {
  console.log('Initializing Supabase client using SupabaseClientService singleton');
  const supabaseService = SupabaseClientService.getInstance();
  
  // Test connection
  supabaseService.testConnection()
    .then(result => {
      if (result.success) {
        console.log('✅ Supabase connection test successful');
      } else {
        console.warn(`⚠️ Supabase connection test failed: ${result.error}`);
      }
    })
    .catch(err => {
      console.warn(`⚠️ Error testing Supabase connection: ${err.message}`);
    });
  
  return supabaseService.getClient();
}

// Find all script files
async function findScriptFiles(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const rootPath = '/Users/raybunnage/Documents/github/dhg-mono';
    const cliPipelinePath = path.join(rootPath, 'scripts', 'cli-pipeline');
    
    console.log(`Searching for script files in: ${cliPipelinePath}`);
    const cmd = `find "${cliPipelinePath}" -type f \\( -name "*.sh" -o -name "*.js" -o -name "*.ts" \\) | grep -v "node_modules" | grep -v "\\.archived" | grep -v "\\.backup" | grep -v "\\.test\\." | grep -v "\\.spec\\." | grep -v "\\.min\\."`;
    
    exec(cmd, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error finding script files: ${error.message}`);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.error(`Shell stderr: ${stderr}`);
      }
      
      const filePaths = stdout.split('\n').filter(Boolean);
      
      // Convert the absolute paths to relative paths from the project root
      const relativePaths = filePaths.map(filePath => {
        if (filePath.startsWith(rootPath)) {
          return filePath.substring(rootPath.length + 1); // +1 for the slash
        }
        return filePath;
      });
      
      console.log(`Found ${relativePaths.length} script files`);
      resolve(relativePaths);
    });
  });
}

// Sync database with script files
async function syncDatabase(supabase: SupabaseClient, scriptFiles: string[]): Promise<void> {
  console.log('Starting database sync...');
  
  // 1. Get all existing scripts from database
  const { data: existingScripts, error: fetchError } = await supabase
    .from('scripts_registry')
    .select('id, file_path');
    
  if (fetchError) {
    console.error(`Error fetching existing scripts: ${fetchError.message}`);
    throw fetchError;
  }
  
  console.log(`Found ${existingScripts?.length || 0} existing scripts in database`);
  
  // Create a map of file paths to IDs for faster lookup
  const existingScriptMap = new Map<string, string>();
  existingScripts?.forEach(script => {
    if (script.file_path) {
      existingScriptMap.set(script.file_path, script.id);
    }
  });
  
  // 2. Identify scripts to delete (in DB but not on disk)
  const scriptsToDelete: string[] = [];
  existingScripts?.forEach(script => {
    if (script.file_path && !scriptFiles.includes(script.file_path)) {
      scriptsToDelete.push(script.id);
    }
  });
  
  console.log(`Found ${scriptsToDelete.length} scripts to delete`);
  
  // 3. Delete scripts that no longer exist on disk
  if (scriptsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('scripts_registry')
      .delete()
      .in('id', scriptsToDelete);
      
    if (deleteError) {
      console.error(`Error deleting scripts: ${deleteError.message}`);
    } else {
      console.log(`Successfully deleted ${scriptsToDelete.length} scripts`);
    }
  }
  
  // 4. Identify new scripts to add (on disk but not in DB)
  const scriptsToAdd = scriptFiles.filter(filePath => !existingScriptMap.has(filePath));
  
  console.log(`Found ${scriptsToAdd.length} new scripts to add`);
  
  // 5. Add new scripts
  let addedCount = 0;
  const batchSize = 50; // Process in batches to avoid potential issues
  
  for (let i = 0; i < scriptsToAdd.length; i += batchSize) {
    const batch = scriptsToAdd.slice(i, i + batchSize);
    const scriptRecords = batch.map(filePath => {
      const fileExt = path.extname(filePath).substring(1).toLowerCase();
      const language = 
        fileExt === 'sh' ? 'bash' :
        fileExt === 'js' ? 'javascript' :
        fileExt === 'ts' ? 'typescript' :
        fileExt === 'py' ? 'python' :
        fileExt === 'rb' ? 'ruby' :
        fileExt === 'sql' ? 'sql' :
        'unknown';
      
      const fileName = path.basename(filePath);
      const title = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
      
      return {
        file_path: filePath,
        title,
        language,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_modified_at: new Date().toISOString(),
        metadata: { source: 'direct_sync', sync_date: new Date().toISOString() }
      };
    });
    
    if (scriptRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('scripts_registry')
        .insert(scriptRecords);
        
      if (insertError) {
        console.error(`Error inserting batch of scripts: ${insertError.message}`);
      } else {
        addedCount += scriptRecords.length;
        console.log(`Successfully added batch of ${scriptRecords.length} scripts`);
      }
    }
  }
  
  console.log(`Sync complete. Added ${addedCount} scripts, deleted ${scriptsToDelete.length} scripts.`);
  
  // 6. Get the total count of scripts in the database
  const { count } = await supabase
    .from('scripts_registry')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Total script records in database after sync: ${count || 'unknown'}`);
}

// Main function
async function main() {
  try {
    // Initialize Supabase client using the singleton pattern
    const supabase = initSupabase();
    
    // Find all script files
    const scriptFiles = await findScriptFiles();
    
    // Sync database with script files
    await syncDatabase(supabase, scriptFiles);
    
    console.log('Script sync completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during script sync:', error);
    process.exit(1);
  }
}

// Run the main function
main();