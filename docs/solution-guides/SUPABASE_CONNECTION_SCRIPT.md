# Supabase Connection Script Solution Guide

This document explains how the `scripts/fix/supabase-connect.js` script works to ensure reliable Supabase connections across different environments.

## Overview

The `supabase-connect.js` script provides a robust solution for connecting to Supabase by:

1. Finding and using Supabase credentials from multiple possible sources
2. Testing connection before performing operations
3. Using temporary script files instead of inline execution to avoid escaping issues
4. Properly handling environment variables in child processes

## Key Features

### 1. Credential Resolution

The script searches for Supabase credentials in this order:

```javascript
// Try environment variables first
let url = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 
                process.env.CLI_SUPABASE_KEY || process.env.CLI_SUPABASE_SERVICE_ROLE_KEY ||
                process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
```

If not found in environment variables, it searches multiple `.env` files:
- `.env.local`
- `.env.development`
- `.env`

As a last resort, it uses hardcoded fallback credentials.

### 2. Environment File Parsing

The script properly parses `.env` files with robust handling of:
- Comments (lines starting with #)
- Quoted values
- Different variable name formats

```javascript
function readEnvFile(filePath) {
  // ...
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
  // ...
}
```

### 3. Connection Testing

Before operations are performed, the script tests the Supabase connection:

```javascript
async function testSupabaseConnection() {
  // ...
  try {
    const supabase = createClient(url, serviceKey);
    
    // Try to access a few tables to test the connection
    const { error } = await supabase
      .from('scripts')
      .select('count', { count: 'exact', head: true });
    
    // Fallback to another table if needed
    // ...
  }
  // ...
}
```

### 4. Child Process Environment

When running commands, the script properly passes all Supabase credentials to child processes:

```javascript
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
    // ... additional environment variables
  };
  
  // ... spawn child process with this environment
}
```

### 5. Avoiding String Escaping Issues

A key improvement in the script is using temporary files instead of trying to pass complex multi-line code to `node -e`:

```javascript
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
```

This approach avoids shell escaping issues that often occur when passing complex code as a command line argument.

### 6. Directory Exclusion

When scanning for script files, the script efficiently excludes directories that shouldn't be included:

```javascript
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
```

## Implementation in Other Scripts

To implement similar connection handling in other scripts:

1. Import the connection utility:
```javascript
const { getSupabaseCredentials, testSupabaseConnection } = require('../fix/supabase-connect');
```

2. Use it to establish a connection:
```javascript
async function myFunction() {
  // Test connection first
  const connected = await testSupabaseConnection();
  if (!connected) {
    console.error('Unable to connect to Supabase');
    process.exit(1);
  }
  
  // Get credentials for direct use
  const { url, serviceKey } = getSupabaseCredentials();
  const supabase = createClient(url, serviceKey);
  
  // Use supabase client...
}
```

## Troubleshooting

If you encounter connection issues:

1. Check that your `.env` files contain the correct Supabase URL and keys
2. Ensure environment variables are properly set in your shell
3. Verify network connectivity to the Supabase instance
4. Check if Supabase service is running correctly
5. Run the script with `DEBUG=true` environment variable to see more detailed logs

## Conclusion

The `supabase-connect.js` script provides a robust solution for establishing reliable Supabase connections across different environments by handling credential resolution, connection testing, and proper environment variable management.