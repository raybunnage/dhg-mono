# Supabase Client Service Guide

This document explains the updated `SupabaseClientService` class and how it provides a reliable way to connect to Supabase across your applications.

## Overview

The `SupabaseClientService` provides a singleton pattern for accessing Supabase that:

1. Uses standardized environment variable names
2. Handles environment variable loading from multiple sources
3. Properly parses `.env` files
4. Tests connections before proceeding with operations
5. Provides fallbacks when needed

## How to Use

### Basic Usage

```typescript
import { getSupabaseClient } from 'packages/cli/src/services/supabase-client';

// In any function
async function getData() {
  // Gets a singleton instance with auto-initialization
  const supabase = getSupabaseClient();
  
  // Use the client
  const { data, error } = await supabase.from('my_table').select('*');
  
  // Handle results
  if (error) {
    console.error('Error fetching data:', error);
    return null;
  }
  
  return data;
}
```

### Manual Initialization

For more control over initialization:

```typescript
import { SupabaseClientService } from 'packages/cli/src/services/supabase-client';

// Get the service singleton
const supabaseService = SupabaseClientService.getInstance();

// Initialize with specific credentials
const supabase = supabaseService.initialize(
  'https://your-project.supabase.co',
  'your-service-role-key'
);

// Check connection before proceeding
const connectionTest = await supabaseService.testConnection();
if (!connectionTest.success) {
  console.error('Connection failed:', connectionTest.error);
  // Handle error case
}
```

## Key Improvements

The service now incorporates reliable connection patterns from `supabase-connect.js`:

### 1. Improved Environment Variable Resolution

Using standardized variable names:

```typescript
// Primary variables first
let url = process.env.SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
let anonKey = process.env.SUPABASE_ANON_KEY;

// Client-side fallbacks
if (!url) {
  url = process.env.VITE_SUPABASE_URL;
}

if (!key) {
  key = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
}
```

### 2. Enhanced .env File Parsing

Using a regex-based approach that properly handles:
- Comments
- Quoted values
- Complex values with = signs

```typescript
const match = line.match(/^([^=]+)=(.*)$/);
if (match) {
  const key = match[1].trim();
  let value = match[2].trim();
  
  // Remove quotes if present (like in bash)
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.substring(1, value.length - 1);
  }
  
  envVars[key] = value;
}
```

### 3. Comprehensive Connection Testing

Testing multiple tables with proper fallbacks:

```typescript
// Try scripts table first
const { error: scriptsError } = await client.from('scripts').select('count', { head: true });

if (!scriptsError) {
  return { success: true };
}

// Try documentation_files table next
// ...

// Try document_types table if needed
// ...

// Try a simple ping as last resort
// ...
```

### 4. Singleton Pattern

Ensures consistent client usage across your application:

```typescript
export function getSupabaseClient(forceInit: boolean = true): SupabaseClient {
  return SupabaseClientService.getInstance().getClient(forceInit);
}
```

## Configuration

The service looks for Supabase credentials in this order:

1. Environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`

2. Client-side fallbacks:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_ANON_KEY`

3. Multiple `.env` files:
   - `.env.local` 
   - `.env.development`
   - `.env`
   - (And parent directories of these files)

4. Hardcoded fallbacks (as last resort)

## Best Practices

1. **Use the singleton**: Always get the client through `getSupabaseClient()` rather than creating new instances

2. **Test connections**: For critical operations, test the connection first:
   ```typescript
   const service = SupabaseClientService.getInstance();
   const connectionResult = await service.testConnection();
   if (!connectionResult.success) {
     // Handle connection failure
   }
   ```

3. **Handle errors**: Always check for errors in Supabase operations:
   ```typescript
   const { data, error } = await supabase.from('table').select('*');
   if (error) {
     console.error('Operation failed:', error);
     // Handle the error appropriately
   }
   ```

4. **Environment validation**: Add validation at application startup:
   ```typescript
   function validateEnv() {
     if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
       throw new Error('Missing required Supabase environment variables');
     }
   }
   
   // Call early
   validateEnv();
   ```

## Troubleshooting

If you encounter connection issues:

1. Verify your `.env` files have the correct variables
2. Test connection directly:
   ```typescript
   const result = await SupabaseClientService.getInstance().testConnection();
   console.log(result);
   ```
3. Check if your service role key has sufficient permissions
4. Verify network connectivity to Supabase
5. Make sure the Supabase project is active and running