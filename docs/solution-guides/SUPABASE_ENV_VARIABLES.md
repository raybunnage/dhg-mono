# Simplifying Supabase Environment Variables

This guide recommends best practices for managing Supabase environment variables in the DHG monorepo.

## Current Situation

The `.env.development` file currently contains multiple Supabase-related variables:

- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLI_SUPABASE_URL`
- `CLI_SUPABASE_KEY`
- `VITE_TEST_USER_EMAIL`
- `VITE_TEST_USER_PASSWORD`

This creates confusion when code needs to locate Supabase credentials, with multiple places to check and inconsistent naming conventions.

## Recommended Approach

### Core Variables

Standardize on these core variables:

1. `SUPABASE_URL` - The API URL for your Supabase project
2. `SUPABASE_SERVICE_ROLE_KEY` - For server-side operations that need full access
3. `SUPABASE_ANON_KEY` - For client-side operations that need limited access

### Contextual Variables

Keep these variables for specific needs:

1. `SUPABASE_PROJECT_ID` - Only needed for Supabase CLI operations
2. `SUPABASE_DB_PASSWORD` - Only needed for direct database access
3. `SUPABASE_DB_URL` - Only needed for direct database connections
4. `VITE_TEST_USER_EMAIL` and `VITE_TEST_USER_PASSWORD` - For testing only

### Variables to Remove

Remove these redundant variables:

1. `CLI_SUPABASE_URL` - Use `SUPABASE_URL` instead
2. `CLI_SUPABASE_KEY` - Use `SUPABASE_SERVICE_ROLE_KEY` instead

## Implementation Plan

### 1. Update `.env.development` Template

```bash
# Core Supabase Variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Advanced Configuration (only needed for direct DB access or Supabase CLI)
SUPABASE_PROJECT_ID=your-project-id
SUPABASE_DB_PASSWORD=your-db-password
SUPABASE_DB_URL=postgresql://postgres:your-db-password@db.your-project.supabase.co:5432/postgres

# Test Users
VITE_TEST_USER_EMAIL=test@example.com
VITE_TEST_USER_PASSWORD=test-password
```

### 2. Update Credential Resolution Code

Simplify all credential resolution code to look for standard variables:

```javascript
// Simple credentials resolution
function getSupabaseCredentials() {
  // Get URL
  const url = process.env.SUPABASE_URL;
  
  // Get key based on context
  const isServerSide = !process.browser; // Or other logic to determine context
  const key = isServerSide 
    ? process.env.SUPABASE_SERVICE_ROLE_KEY 
    : process.env.SUPABASE_ANON_KEY;
    
  if (!url || !key) {
    throw new Error('Missing required Supabase credentials');
  }
  
  return { url, key };
}

// Use the credentials
const { url, key } = getSupabaseCredentials();
const supabase = createClient(url, key);
```

### 3. Update Client Initialization

Use Vite's variable prefixing to expose only what's needed on the client:

```javascript
// vite.config.js - Define which variables are exposed to the client
export default defineConfig({
  // ... other config
  define: {
    'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
    'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
  }
});

// Client-side component
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 4. Handle Legacy Code

For code that still looks for old variable names, update `supabase-connect.js` to maintain backward compatibility temporarily:

```javascript
function getSupabaseCredentials() {
  // Primary variables
  let url = process.env.SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let anonKey = process.env.SUPABASE_ANON_KEY;
  
  // Legacy support (with warning)
  if (!url && process.env.CLI_SUPABASE_URL) {
    console.warn('CLI_SUPABASE_URL is deprecated. Use SUPABASE_URL instead.');
    url = process.env.CLI_SUPABASE_URL;
  }
  
  if (!serviceKey && process.env.CLI_SUPABASE_KEY) {
    console.warn('CLI_SUPABASE_KEY is deprecated. Use SUPABASE_SERVICE_ROLE_KEY instead.');
    serviceKey = process.env.CLI_SUPABASE_KEY;
  }
  
  // ... rest of function
}
```

## Benefits

1. **Simplicity** - Fewer variables to manage and understand
2. **Consistency** - Standard naming conventions across projects
3. **Clarity** - Clear separation between client and server keys
4. **Maintainability** - Easier to update and understand code that uses Supabase
5. **Security** - Less risk of exposing service role keys to the client

## Migration Timeline

1. Update environment templates and documentation
2. Add backward compatibility to `supabase-connect.js`
3. Update primary services and utilities
4. Update applications to use standard variables
5. Remove backward compatibility after 1-2 months

## Recommended Tools

Use environment variable validation in your applications:

```javascript
// Simple environment validation
function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(name => !process.env[name]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Call early in your application startup
validateEnv();
```