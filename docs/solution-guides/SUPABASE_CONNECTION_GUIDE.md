# Supabase Connection Guide

This document explains how Supabase connections are managed in the DHG monorepo, with a focus on CLI scripts and automation tools.

## Table of Contents

1. [Supabase Connectivity Overview](#supabase-connectivity-overview)
2. [SupabaseClientService Implementation](#supabaseclientservice-implementation)
3. [Environment Configuration Files](#environment-configuration-files)
4. [Standard Connection Pattern](#standard-connection-pattern)
5. [Troubleshooting Supabase Connections](#troubleshooting-supabase-connections)
6. [Best Practices](#best-practices)

## Supabase Connectivity Overview

All connections to Supabase in the DHG monorepo should use the singleton `SupabaseClientService` class, which handles:

- Loading environment variables automatically from multiple locations
- Creating and managing the Supabase client instance
- Providing a consistent interface for database operations
- Managing authentication and credentials
- Handling connection errors gracefully

## SupabaseClientService Implementation

The `SupabaseClientService` is a singleton class implemented in:

```
/packages/shared/services/supabase-client.ts
```

This service handles:

1. **Credential Discovery**: Searches for Supabase credentials in multiple locations (env files, environment variables)
2. **Client Management**: Creates and maintains a single Supabase client instance
3. **Error Handling**: Provides clear error messages when credentials are missing
4. **Connection Testing**: Includes methods to test and validate the connection

### Key Features

- **Multiple Fallback Mechanisms**: Tries multiple locations and formats for credentials
- **Credential Loading Priority**:
  1. Direct extraction from `.env.development` using regex
  2. Configuration object if available
  3. Environment variables loaded via dotenv from multiple files
  4. Various environment variable naming patterns (SUPABASE_URL, VITE_SUPABASE_URL, etc.)
- **Lazy Initialization**: Client is only created when first needed
- **Secure Handling**: Masks sensitive keys in logs

## Environment Configuration Files

The service looks for credentials in these files (in order):

1. `.env.development` (primary source)
2. `.env.local`
3. `.env`

The required environment variables are:

```
# Required for Supabase connection
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional but also supported
SUPABASE_ANON_KEY=your-anon-key-here
```

## Standard Connection Pattern

To use Supabase in CLI scripts, follow this standard pattern:

```typescript
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function myFunction() {
  try {
    // Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Use the client for database operations
    const { data, error } = await supabase
      .from('my_table')
      .select('*')
      .limit(10);
    
    if (error) {
      console.error('Error querying data:', error);
      return;
    }
    
    console.log('Retrieved data:', data);
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
  }
}
```

## Troubleshooting Supabase Connections

If you encounter connection issues:

1. **Check Environment Files**:
   - Ensure `.env.development` exists in the project root
   - Verify it contains the correct SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
   - Check file permissions

2. **Verify Working Directory**:
   - CLI scripts must be run from a location where the service can find the project root
   - Use `process.cwd()` to check the current working directory

3. **Common Error Messages**:
   - `Unable to find Supabase credentials`: Environment variables are missing or inaccessible
   - `Error querying <table>`: Connection works but there's an issue with the query
   - `Invalid API key`: The SUPABASE_SERVICE_ROLE_KEY is incorrect

4. **Test Connection Explicitly**:
   ```typescript
   const connectionTest = await SupabaseClientService.getInstance().testConnection();
   if (!connectionTest.success) {
     console.error('Connection test failed:', connectionTest.error);
   }
   ```

## Best Practices

1. **Always Use the Singleton**:
   - Never create your own Supabase client instances
   - Always use `SupabaseClientService.getInstance().getClient()`

2. **Handle Errors Properly**:
   - Always check for and handle the `error` object returned from Supabase queries
   - Use try/catch blocks around database operations

3. **Use Proper Credential Types**:
   - Use SERVICE_ROLE_KEY for CLI scripts and backend operations
   - Use ANON_KEY only for client-side browser applications

4. **Integration with CLI Pipelines**:
   - CLI scripts should load the SupabaseClientService early to catch connection issues
   - Include proper error handling for Supabase connection failures

5. **Respect Load Order**:
   - The service tries multiple locations and methods to find credentials
   - Don't modify this behavior or implement custom credential loading
   - If you need custom behavior, enhance the SupabaseClientService itself

By following these guidelines, you'll ensure consistent and reliable Supabase connectivity across the entire codebase.