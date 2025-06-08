// Final standalone script to sync scripts with database
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Get required credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Verify credentials exist
if (!supabaseUrl) {
  console.error("Error: SUPABASE_URL environment variable is required");
  process.exit(1);
}

if (!supabaseKey) {
  console.error("Error: SUPABASE_KEY environment variable is required");
  process.exit(1);
}

console.log(`Using Supabase URL: ${supabaseUrl}`);
console.log("Using Supabase key from environment variables");

try {
  // Dynamically load Supabase client
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Run the script sync
  runScriptSync(supabase);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

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
            
            // Store the path relative to project root, not just the filename
            // This ensures we have the full path from the project root
            const relativePath = path.relative(rootDir, fullPath);
            
            scripts.push({
              file_path: relativePath,  // This is now the path from root, e.g. "scripts/cli-pipeline/script.sh"
              title: path.basename(fullPath),
              language: ext === '.sh' ? 'bash' : 'javascript',
              last_modified_at: stats.mtime.toISOString(),
              file_hash: hash
            });
            
            // Debug log to verify paths are correct
            console.log(`Found script: ${relativePath}`);
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

// Function to normalize file paths for consistent comparison
function normalizePath(filePath) {
  if (!filePath) return '';
  
  // Remove any leading /Users, /home, etc. paths and normalize to project-relative paths
  const normalizedPath = filePath
    .replace(/^\/Users\/[^\/]+\/Documents\/github\/dhg-mono\//, '')
    .replace(/^\/Users\/[^\/]+\/[^\/]+\/dhg-mono\//, '')
    .replace(/^\/home\/[^\/]+\/[^\/]+\/dhg-mono\//, '')
    .replace(/^.*?dhg-mono\//, '')
    .replace(/^\/?/, ''); // Remove leading slash
    
  return normalizedPath;
}

// Function to sync scripts with database
async function syncWithDatabase(supabase, scripts) {
  console.log("Synchronizing scripts with database...");
  
  const result = {
    added: 0,
    updated: 0,
    deleted: 0,
    errors: 0
  };
  
  try {
    // Log the discovered scripts
    console.log(`Processing ${scripts.length} scripts found on disk:`);
    scripts.forEach((script, index) => {
      if (index < 5) { // Only log first 5 to avoid excessive logging
        console.log(`  ${index + 1}. ${script.file_path}`);
      }
    });
    
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
    
    console.log(`Found ${dbScripts.length} scripts in database`);
    
    // Normalize all paths to ensure consistent comparison
    // This ensures scripts will be found even if database has absolute paths
    const normalizedDbScripts = dbScripts.map(script => ({
      ...script,
      normalizedPath: normalizePath(script.file_path)
    }));
    
    const normalizedDiskScripts = scripts.map(script => ({
      ...script,
      normalizedPath: normalizePath(script.file_path)
    }));
    
    // Create maps and sets for efficient lookups
    const dbScriptMap = new Map(normalizedDbScripts.map(script => [script.normalizedPath, script]));
    const diskScriptPathSet = new Set(normalizedDiskScripts.map(script => script.normalizedPath));
    
    // Log some of the normalized paths for debugging
    console.log("Normalized disk paths sample:");
    Array.from(diskScriptPathSet).slice(0, 3).forEach(path => {
      console.log(`  - ${path}`);
    });
    
    // Mark scripts that no longer exist as deleted
    const toDelete = normalizedDbScripts.filter(dbScript => 
      !diskScriptPathSet.has(dbScript.normalizedPath) && !dbScript.is_deleted
    );
    
    if (toDelete.length > 0) {
      console.log(`Marking ${toDelete.length} scripts as deleted...`);
      console.log("Scripts being marked as deleted:");
      toDelete.forEach(script => console.log(`- ${script.file_path} (normalized: ${script.normalizedPath})`));
      
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
    for (const script of normalizedDiskScripts) {
      const dbScript = dbScriptMap.get(script.normalizedPath);
      
      if (dbScript) {
        // Update existing script if hash changed or was previously marked as deleted
        if (dbScript.file_hash !== script.file_hash || dbScript.is_deleted) {
          console.log(`Updating script: ${script.file_path} (normalized: ${script.normalizedPath})`);
          const { error: updateError } = await supabase
            .from('scripts')
            .update({
              file_path: script.file_path, // Update with the correct relative path
              last_modified_at: script.last_modified_at,
              file_hash: script.file_hash,
              updated_at: new Date().toISOString(),
              is_deleted: false // Explicitly mark as not deleted
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
            is_deleted: false, // Explicitly mark as not deleted
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

// Main script sync function
async function runScriptSync(supabase) {
  try {
    console.log("Starting script sync process...");
    
    // Get the project root directory (the Git repository root)
    const projectRoot = process.cwd();
    console.log(`Project root: ${projectRoot}`);
    
    // Discover scripts
    const scripts = await discoverScripts(projectRoot);
    console.log(`Discovered ${scripts.length} script files`);
    
    if (scripts.length === 0) {
      console.log("No script files found.");
      return;
    }
    
    // Sync with database
    const result = await syncWithDatabase(supabase, scripts);
    
    console.log("Script sync completed successfully.");
    console.log(`Summary: Added=${result.added}, Updated=${result.updated}, Deleted=${result.deleted}, Errors=${result.errors}`);
  } catch (error) {
    console.error("Error during script sync:", error.message);
    process.exit(1);
  }
}