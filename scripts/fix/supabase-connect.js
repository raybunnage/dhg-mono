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

// Hardcoded credentials from .env.development as fallback
const FALLBACK_URL = "https://jdksnfkupzywjdfefkyj.supabase.co";
const FALLBACK_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E";
const FALLBACK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQxODkwMTMsImV4cCI6MjA0OTc2NTAxM30.035475oKIiE1pSsfQbRoje4-FRT9XDKAk6ScHYtaPsQ";

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
  // Try environment variables first
  let url = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 
                   process.env.CLI_SUPABASE_KEY || process.env.CLI_SUPABASE_SERVICE_ROLE_KEY ||
                   process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  let anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
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
        // Check for URL
        url = url || variables.SUPABASE_URL || variables.CLI_SUPABASE_URL || variables.VITE_SUPABASE_URL;
        
        // Check for service key
        serviceKey = serviceKey || variables.SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_KEY || 
                      variables.CLI_SUPABASE_KEY || variables.CLI_SUPABASE_SERVICE_ROLE_KEY ||
                      variables.VITE_SUPABASE_SERVICE_ROLE_KEY;
        
        // Check for anon key
        anonKey = anonKey || variables.SUPABASE_ANON_KEY || variables.VITE_SUPABASE_ANON_KEY;
        
        if (url && serviceKey) {
          console.log(`Found credentials in ${envFile}`);
          break;
        }
      }
    }
  }
  
  // Use fallbacks if needed
  if (!url) {
    url = FALLBACK_URL;
    console.log('Using fallback URL:', url);
  }
  
  if (!serviceKey) {
    serviceKey = FALLBACK_SERVICE_KEY;
    console.log('Using fallback service role key');
  }
  
  if (!anonKey) {
    anonKey = FALLBACK_ANON_KEY;
    console.log('Using fallback anon key');
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
  
  // Set environment variables for child process
  const env = {
    ...process.env,
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SUPABASE_KEY: serviceKey,
    CLI_SUPABASE_URL: url,
    CLI_SUPABASE_KEY: serviceKey,
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SUPABASE_ANON_KEY: anonKey,
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
  const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build'];
  
  console.log('Finding script files...');
  
  // Simple recursive function to find files
  async function* findFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.includes(entry.name)) {
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
    
    scripts.push({
      file_path: relativePath,
      title: path.basename(filePath),
      language: path.extname(filePath) === '.sh' ? 'bash' : 'javascript',
      last_modified_at: stats.mtime.toISOString(),
      file_hash: hash
    });
  }
  
  console.log(\`Found \${scripts.length} script files\`);
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
    .select('id, file_path, file_hash');
    
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
      // Update if hash has changed
      if (existingScript.file_hash !== script.file_hash) {
        console.log(\`Updating script: \${script.file_path}\`);
        
        const { error: updateError } = await supabase
          .from('scripts')
          .update({
            file_path: script.file_path,
            last_modified_at: script.last_modified_at,
            file_hash: script.file_hash,
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
          metadata: {},
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