// Direct database sync script with minimal dependencies
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Check environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_KEY environment variables must be set');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions
function generateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

// Function to discover script files
async function discoverScripts(rootDir) {
  console.log(`Discovering scripts in ${rootDir}...`);
  
  // Define patterns for scripts
  const scriptExtensions = ['.sh', '.js'];
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'backup', 'archive', '_archive', 'file_types', 'script-analysis-results'];
  
  // Function to scan directory recursively
  async function scanDirectory(dir, scripts = []) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip excluded directories
        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            await scanDirectory(fullPath, scripts);
          }
          continue;
        }
        
        // Check file extensions
        const ext = path.extname(entry.name);
        if (scriptExtensions.includes(ext)) {
          try {
            const stats = await fs.promises.stat(fullPath);
            const fileContent = await fs.promises.readFile(fullPath, 'utf8');
            const hash = generateHash(fileContent);
            
            // Use relative path for database storage
            const relativePath = path.relative(rootDir, fullPath);
            
            scripts.push({
              file_path: relativePath,
              title: path.basename(fullPath),
              language: ext === '.sh' ? 'bash' : 'javascript',
              last_modified_at: stats.mtime.toISOString(),
              file_hash: hash
            });
          } catch (fileError) {
            console.error(`Error processing file ${fullPath}:`, fileError.message);
          }
        }
      }
      
      return scripts;
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error.message);
      return scripts;
    }
  }
  
  return scanDirectory(rootDir);
}

// Function to sync scripts with database
async function syncWithDatabase(scripts) {
  console.log("Synchronizing scripts with database...");
  
  const result = {
    added: 0,
    updated: 0,
    deleted: 0,
    errors: 0
  };
  
  try {
    // Get existing scripts from database
    const { data: dbScripts, error } = await supabase
      .from('scripts')
      .select('id, file_path, file_hash, is_deleted');
    
    if (error) {
      console.error("Error fetching scripts from database:", error.message);
      throw new Error(`Failed to fetch scripts from database: ${error.message}`);
    }
    
    if (!dbScripts) {
      console.error("No scripts data returned from database");
      throw new Error("No scripts data returned from database");
    }
    
    // Create maps for efficient lookups
    const dbScriptMap = new Map(dbScripts.map(script => [script.file_path, script]));
    const diskScriptPaths = new Set(scripts.map(script => script.file_path));
    
    // Mark scripts that no longer exist as deleted
    const toDelete = dbScripts.filter(dbScript => 
      !diskScriptPaths.has(dbScript.file_path) && !dbScript.is_deleted
    );
    
    if (toDelete.length > 0) {
      console.log(`Marking ${toDelete.length} scripts as deleted...`);
      const { error: deleteError } = await supabase
        .from('scripts')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .in('id', toDelete.map(script => script.id));
      
      if (deleteError) {
        console.error("Error marking scripts as deleted:", deleteError.message);
        result.errors += toDelete.length;
      } else {
        result.deleted = toDelete.length;
      }
    }
    
    // Process each script for insert or update
    for (const script of scripts) {
      const dbScript = dbScriptMap.get(script.file_path);
      
      if (dbScript) {
        // Update existing script if hash changed or was previously marked as deleted
        if (dbScript.file_hash !== script.file_hash || dbScript.is_deleted) {
          console.log(`Updating script: ${script.file_path}`);
          const { error: updateError } = await supabase
            .from('scripts')
            .update({
              last_modified_at: script.last_modified_at,
              file_hash: script.file_hash,
              updated_at: new Date().toISOString(),
              is_deleted: false
            })
            .eq('id', dbScript.id);
          
          if (updateError) {
            console.error(`Error updating script ${script.file_path}:`, updateError.message);
            result.errors++;
          } else {
            result.updated++;
          }
        }
      } else {
        // Insert new script
        console.log(`Inserting new script: ${script.file_path}`);
        const { error: insertError } = await supabase
          .from('scripts')
          .insert({
            ...script,
            metadata: {},
            last_indexed_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error(`Error inserting script ${script.file_path}:`, insertError.message);
          result.errors++;
        } else {
          result.added++;
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error during script synchronization:", error.message);
    throw new Error(`Failed to synchronize scripts: ${error.message}`);
  }
}

// Main function
async function main() {
  try {
    console.log("Starting script sync process...");
    
    // Discover scripts
    const scripts = await discoverScripts(process.cwd());
    console.log(`Discovered ${scripts.length} script files`);
    
    if (scripts.length === 0) {
      console.log("No script files found.");
      return;
    }
    
    // Sync with database
    const result = await syncWithDatabase(scripts);
    
    console.log("Script sync completed successfully.");
    console.log(`Summary: Added=${result.added}, Updated=${result.updated}, Deleted=${result.deleted}, Errors=${result.errors}`);
  } catch (error) {
    console.error("Error during script sync:", error.message);
    process.exit(1);
  }
}

// Run the main function
main();