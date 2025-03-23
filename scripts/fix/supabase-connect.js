#!/usr/bin/env node
/**
 * Standalone script to test Supabase connectivity and fix credentials issues
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const SCRIPT_DIR = __dirname;
const ROOT_DIR = path.join(SCRIPT_DIR, '../..');

// Remove these hardcoded credentials
const FALLBACK_URL = process.env.SUPABASE_URL || "";
const FALLBACK_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FALLBACK_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

/**
 * Read environment variables from .env file
 */
function readEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`Reading ${filePath}...`);
      const content = fs.readFileSync(filePath, 'utf8');
      const variables = {};
      
      content.split('\n').forEach(line => {
        if (line.trim() && !line.trim().startsWith('#')) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.substring(1, value.length - 1);
            }
            
            variables[key] = value;
          }
        }
      });
      
      return { exists: true, variables };
    }
    return { exists: false, variables: {} };
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return { exists: false, variables: {} };
  }
}

/**
 * Get Supabase credentials from environment or .env files
 */
function getSupabaseCredentials() {
  // Primary variables - simplified to use standardized names
  let url = process.env.SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let anonKey = process.env.SUPABASE_ANON_KEY;
  
  // Client-side variables as fallback
  if (!url) {
    url = process.env.VITE_SUPABASE_URL;
  }
  
  if (!serviceKey) {
    serviceKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  }
  
  if (!anonKey) {
    anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  }
  
  if (url && serviceKey) {
    console.log('Found Supabase credentials in environment variables');
    return { url, serviceKey, anonKey };
  }
  
  // Try reading from .env files
  console.log('Searching for Supabase credentials in .env files...');
  
  const envFiles = [
    path.join(ROOT_DIR, '.env.local'),
    path.join(ROOT_DIR, '.env.development'),
    path.join(ROOT_DIR, '.env'),
  ];
  
  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      const { exists, variables } = readEnvFile(envFile);
      if (exists) {
        // Check for URL (primary first, then fallbacks)
        if (!url) {
          url = variables.SUPABASE_URL || variables.VITE_SUPABASE_URL;
        }
        
        // Check for service key (primary first, then fallbacks)
        if (!serviceKey) {
          serviceKey = variables.SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_KEY || 
                      variables.VITE_SUPABASE_SERVICE_ROLE_KEY;
        }
        
        // Check for anon key (primary first, then fallbacks)
        if (!anonKey) {
          anonKey = variables.SUPABASE_ANON_KEY || variables.VITE_SUPABASE_ANON_KEY;
        }
        
        if (url && serviceKey) {
          console.log(`Found credentials in ${envFile}`);
          break;
        }
      }
    }
  }
  
  // Modify the getSupabaseCredentials function to handle missing credentials better
  if (!url) {
    console.error('❌ No Supabase URL found in environment variables or .env files');
    process.exit(1);
  }
  
  if (!serviceKey) {
    console.error('❌ No Supabase service key found in environment variables or .env files');
    process.exit(1);
  }
  
  if (!anonKey) {
    console.error('❌ No Supabase anon key found in environment variables or .env files');
    process.exit(1);
  }
  
  return { url, serviceKey, anonKey };
}

/**
 * Test Supabase connection using service role key
 */
async function testSupabaseConnection() {
  const { url, serviceKey } = getSupabaseCredentials();
  
  if (!url || !serviceKey) {
    console.error('❌ Missing Supabase credentials');
    return false;
  }
  
  console.log(`Testing connection to Supabase at: ${url}`);
  console.log(`Using key with length: ${serviceKey.length}`);
  
  try {
    const supabase = createClient(url, serviceKey);
    
    // Try to access a few tables to test the connection
    console.log('Testing access to scripts table...');
    const { error, status } = await supabase
      .from('scripts')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error accessing scripts table:', error.message);
      
      // Try another table as backup
      console.log('Testing access to documentation_files table...');
      const { error: error2 } = await supabase
        .from('documentation_files')
        .select('count', { count: 'exact', head: true });
      
      if (error2) {
        console.error('Error accessing documentation_files table:', error2.message);
        return false;
      }
    }
    
    console.log('✅ Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

/**
 * Run a CLI command using Supabase credentials
 */
function runCommand(command, args) {
  const { url, serviceKey, anonKey } = getSupabaseCredentials();
  
  // Set environment variables for child process using standardized names
  const env = {
    ...process.env,
    // Core variables
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SUPABASE_KEY: serviceKey, // For backward compatibility
    SUPABASE_ANON_KEY: anonKey,
    
    // Client-side variables
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: anonKey
  };
  
  console.log(`Running command: ${command} ${args.join(' ')}`);
  
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Find scripts and sync with database
 */
async function findAndSyncScripts() {
  try {
    // First make sure we can connect to Supabase
    const connected = await testSupabaseConnection();
    if (!connected) {
      console.error('❌ Unable to connect to Supabase. Cannot sync scripts.');
      process.exit(1);
    }
    
    // Create a full script as a string
    const scriptContent = `
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Find script files
async function findScripts() {
  const ROOT_DIR = '${ROOT_DIR}';
  const SCRIPT_EXTENSIONS = ['.sh', '.js'];
  const EXCLUDE_DIRS = [
    'node_modules', 
    '.git', 
    'dist', 
    'build', 
    '_archive', 
    'script-analysis-results', 
    'file_types',
    'backup',
    '.backups',
    'registry_archives'
  ];
  
  console.log('Finding script files (no file limit)...');
  
  // Simple recursive function to find files
  async function* findFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Check if directory should be excluded (exact match or contains excluded terms)
        const shouldExclude = 
          EXCLUDE_DIRS.includes(entry.name) || 
          entry.name.toLowerCase().includes('archive') || 
          entry.name.toLowerCase().includes('backup') ||
          entry.name.toLowerCase().includes('.backups') ||
          dir.includes('node_modules') ||    // Skip nested node_modules directories
          dir.includes('/_archive/') ||      // Skip nested archive directories
          dir.includes('/.backups/') ||      // Skip nested backup directories
          dir.includes('/registry_archives/');
        
        if (!shouldExclude) {
          yield* findFiles(fullPath);
        }
      } else if (entry.isFile() && SCRIPT_EXTENSIONS.includes(path.extname(entry.name))) {
        yield fullPath;
      }
    }
  }
  
  // Collect all script files
  const scripts = [];
  for await (const filePath of findFiles(ROOT_DIR)) {
    const stats = fs.statSync(filePath);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('md5').update(fileContent).digest('hex');
    // Convert to path relative to root dir
    const relativePath = path.relative(ROOT_DIR, filePath);
    
    // Get file creation date - use birthtime if available, or ctime as fallback
    const fileCreationDate = stats.birthtime || stats.ctime;
    
    // Store file size, creation date (in metadata), and modification date
    const scriptObject = {
      file_path: relativePath,
      title: path.basename(filePath),
      language: path.extname(filePath) === '.sh' ? 'bash' : 'javascript',
      last_modified_at: stats.mtime.toISOString(),
      file_hash: hash,
      // Create metadata object with file details including the actual creation date
      metadata: {
        file_size: stats.size,
        file_created_at: fileCreationDate.toISOString(),
        file_modified_at: stats.mtime.toISOString()
      }
    };
    
    scripts.push(scriptObject);
  }
  
  console.log(\`Found \${scripts.length} script files (processing all of them)\`);
  return scripts;
}

// Sync scripts with database
async function syncScripts(scripts) {
  console.log('Syncing scripts with database...');
  
  const result = {
    added: 0,
    updated: 0,
    deleted: 0,
    errors: 0
  };
  
  // Get existing scripts
  const { data: dbScripts, error } = await supabase
    .from('scripts')
    .select('id, file_path, file_hash, metadata');
    
  if (error) {
    console.error('Error fetching scripts:', error.message);
    return;
  }
  
  console.log(\`Found \${dbScripts?.length || 0} scripts in database\`);
  
  // Convert paths to a common format
  const normalizeScriptPath = (path) => path
    .replace(/^\\/+/, '')  // Remove leading slashes
    .replace(/^.*?dhg-mono\\//, ''); // Remove any path prefix up to dhg-mono
    
  // Create lookup maps
  const dbScriptMap = new Map();
  const diskScriptSet = new Set();
  
  if (dbScripts) {
    for (const script of dbScripts) {
      const normalizedPath = normalizeScriptPath(script.file_path);
      dbScriptMap.set(normalizedPath, script);
    }
  }
  
  for (const script of scripts) {
    const normalizedPath = normalizeScriptPath(script.file_path);
    diskScriptSet.add(normalizedPath);
    
    // Check if this script exists in the database
    const existingScript = dbScriptMap.get(normalizedPath);
    
    if (existingScript) {
      // Update if hash has changed, file size has changed, or file metadata dates don't match
      const existingMetadata = existingScript.metadata || {};
      const existingFileSize = existingMetadata.file_size;
      const existingFileCreatedAt = existingMetadata.file_created_at;
      const currentFileSize = script.metadata ? script.metadata.file_size : null;
      const currentFileCreatedAt = script.metadata ? script.metadata.file_created_at : null;
      
      if (existingScript.file_hash !== script.file_hash || 
          existingFileSize !== currentFileSize ||
          existingFileCreatedAt !== currentFileCreatedAt) {
        
        console.log("Updating script " + script.file_path + 
                   " - hash changed: " + (existingScript.file_hash !== script.file_hash) + 
                   ", size changed: " + (existingFileSize !== currentFileSize) + 
                   ", file_created_at changed: " + (existingFileCreatedAt !== currentFileCreatedAt));
        
        const { error: updateError } = await supabase
          .from('scripts')
          .update({
            file_path: script.file_path,
            last_modified_at: script.last_modified_at,
            file_hash: script.file_hash,
            metadata: {
              ...existingMetadata,
              file_size: script.metadata.file_size,
              file_created_at: script.metadata.file_created_at,
              file_modified_at: script.metadata.file_modified_at
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', existingScript.id);
          
        if (updateError) {
          console.error(\`Error updating script \${script.file_path}:\`, updateError.message);
          result.errors++;
        } else {
          result.updated++;
        }
      }
    } else {
      // Insert new script
      console.log(\`Inserting new script: \${script.file_path}\`);
      
      const { error: insertError } = await supabase
        .from('scripts')
        .insert({
          ...script,
          // The metadata with file_size is already included in the script object
          last_indexed_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error(\`Error inserting script \${script.file_path}:\`, insertError.message);
        result.errors++;
      } else {
        result.added++;
      }
    }
  }
  
  // Delete scripts that no longer exist on disk
  const toDelete = [];
  
  for (const [normalizedPath, script] of dbScriptMap.entries()) {
    if (!diskScriptSet.has(normalizedPath)) {
      toDelete.push(script.id);
    }
  }
  
  if (toDelete.length > 0) {
    console.log(\`Deleting \${toDelete.length} scripts that no longer exist on disk\`);
    
    const { error: deleteError } = await supabase
      .from('scripts')
      .delete()
      .in('id', toDelete);
      
    if (deleteError) {
      console.error('Error deleting scripts:', deleteError.message);
      result.errors += toDelete.length;
    } else {
      result.deleted = toDelete.length;
    }
  }
  
  console.log('Script synchronization complete');
  console.log(\`Summary: Added=\${result.added}, Updated=\${result.updated}, Deleted=\${result.deleted}, Errors=\${result.errors}\`);
}

// Run the script sync process
async function run() {
  try {
    const scripts = await findScripts();
    await syncScripts(scripts);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
`;
    
    // Create a temporary file to run instead of using -e which has issues with escaping
    const tempScriptPath = path.join(SCRIPT_DIR, 'temp-sync-scripts.js');
    
    // Write the temporary script file
    fs.writeFileSync(tempScriptPath, scriptContent);
    
    try {
      // Run the temporary script instead
      await runCommand('node', [tempScriptPath]);
    } finally {
      // Clean up by removing the temporary file
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }
    
    console.log('✅ Script find and sync completed successfully');
  } catch (error) {
    console.error('❌ Error running script find and sync:', error.message);
    process.exit(1);
  }
}

// Run the main function
findAndSyncScripts();