# Supabase Connection Complete Guide

This guide documents the complete solution for establishing reliable Supabase connections in both frontend React applications and backend CLI tools within the DHG monorepo architecture.

## Architecture Overview

The solution consists of these key components:

1. **Core Supabase Client Service (Backend)**: A singleton service that manages database connections for CLI and server-side code
2. **React-specific Supabase Adapter**: A frontend adapter that handles authentication and session management for React applications
3. **Direct Implementation in Easy Component**: A demonstration component showing the complete working implementation
4. **Environment Variable Management**: A solution for handling credentials across environments

## 1. Core Supabase Client Service (Backend)

**Location**: `packages/shared/services/supabase-client.ts`

This is the foundational singleton service that handles all Supabase connections for backend operations. It follows the singleton pattern to ensure only one connection instance exists.

```typescript
// Key implementation details of the SupabaseClientService
export class SupabaseClientService {
  private static instance: SupabaseClientService;
  private supabaseClient: SupabaseClient;
  
  private constructor(config?: SupabaseConfig) {
    // Logic to extract credentials from environment variables or config
    const supabaseUrl = this.getSupabaseUrl(config);
    const supabaseKey = this.getSupabaseKey(config);
    
    // Create the Supabase client
    this.supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  
  public static getInstance(config?: SupabaseConfig): SupabaseClientService {
    if (!SupabaseClientService.instance) {
      SupabaseClientService.instance = new SupabaseClientService(config);
    }
    return SupabaseClientService.instance;
  }
  
  public getClient(): SupabaseClient {
    return this.supabaseClient;
  }
  
  // Helper methods for credential extraction
  private getSupabaseUrl(config?: SupabaseConfig): string {
    // Logic to get URL from config, env vars, or .env files
  }
  
  private getSupabaseKey(config?: SupabaseConfig): string {
    // Logic to get API key from config, env vars, or .env files
  }
  
  // Connection testing helper
  public async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseClient
        .from('document_types')
        .select('id')
        .limit(1);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
  }
}
```

### Usage Pattern (Backend)

```typescript
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Get the Supabase client
const supabase = SupabaseClientService.getInstance().getClient();

// Use the client for database operations
async function fetchDocumentTypes() {
  const { data, error } = await supabase
    .from('document_types')
    .select('*');
    
  if (error) {
    console.error('Error fetching document types:', error);
    return [];
  }
  
  return data;
}
```

## 2. React-specific Supabase Adapter

**Location**: `apps/dhg-improve-experts/src/services/supabase-adapter.ts`

This adapter is specifically designed for React applications, handling authentication and session management in addition to basic connection functionality.

```typescript
// React-specific Supabase adapter implementation
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';

export class SupabaseAdapter {
  private static instance: SupabaseAdapter;
  private supabaseClient: SupabaseClient;
  private networkStatus: 'online' | 'offline' = 'offline';
  private lastNetworkCheck: Date = new Date();
  
  private constructor() {
    // Direct credentials approach to bypass DNS resolution issues
    const supabaseUrl = 'https://your-project-id.supabase.co';
    const supabaseKey = 'your-supabase-anon-key';
    
    this.supabaseClient = createClient(supabaseUrl, supabaseKey);
    this.checkNetworkStatus();
  }
  
  public static getInstance(): SupabaseAdapter {
    if (!SupabaseAdapter.instance) {
      SupabaseAdapter.instance = new SupabaseAdapter();
    }
    return SupabaseAdapter.instance;
  }
  
  public getClient(): SupabaseClient {
    return this.supabaseClient;
  }
  
  // Network status monitoring
  private checkNetworkStatus() {
    this.networkStatus = navigator.onLine ? 'online' : 'offline';
    this.lastNetworkCheck = new Date();
    
    // Set up event listeners for network changes
    window.addEventListener('online', () => {
      this.networkStatus = 'online';
      this.lastNetworkCheck = new Date();
    });
    
    window.addEventListener('offline', () => {
      this.networkStatus = 'offline';
      this.lastNetworkCheck = new Date();
    });
  }
  
  public getNetworkStatus() {
    return {
      status: this.networkStatus,
      lastChecked: this.lastNetworkCheck
    };
  }
  
  // Authentication methods
  public async signIn(email: string, password: string) {
    try {
      // Check for existing session first
      const { data: { session } } = await this.supabaseClient.auth.getSession();
      if (session) return { session, error: null };
      
      // Sign in if no session exists
      const { data, error } = await this.supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      
      return { session: data.session, error };
    } catch (error) {
      console.error('Authentication error:', error);
      return { session: null, error };
    }
  }
  
  // Session management hook for React components
  public useSession() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      // Set up auth state change listener
      const { data: { subscription } } = this.supabaseClient.auth.onAuthStateChange(
        (_event, newSession) => {
          setSession(newSession);
          setLoading(false);
        }
      );
      
      // Load initial session
      this.supabaseClient.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      });
      
      // Clean up subscription
      return () => subscription.unsubscribe();
    }, []);
    
    return { session, loading };
  }
}

// Export singleton instance
export const supabaseAdapter = SupabaseAdapter.getInstance();
```

### Usage Pattern (Frontend)

```tsx
import { supabaseAdapter } from '../services/supabase-adapter';
import { useState, useEffect } from 'react';

function MyComponent() {
  const { session, loading } = supabaseAdapter.useSession();
  const [documentTypes, setDocumentTypes] = useState([]);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchData() {
      if (!session) {
        // Handle authentication if needed
        const { session: newSession, error } = await supabaseAdapter.signIn(
          'test@example.com',
          'password123'
        );
        
        if (error || !newSession) {
          setError('Authentication failed');
          return;
        }
      }
      
      // Now fetch data using the authenticated client
      const supabase = supabaseAdapter.getClient();
      const { data, error } = await supabase
        .from('document_types')
        .select('*');
        
      if (error) {
        setError(error.message);
        return;
      }
      
      setDocumentTypes(data);
    }
    
    if (!loading) {
      fetchData();
    }
  }, [session, loading]);
  
  // Render component with data
}
```

## 3. Direct Implementation in Easy Component

**Location**: `apps/dhg-hub-lovable/src/Easy.tsx`

This is a complete working implementation of the Supabase connection in a React component, showing authentication, data fetching, and error handling.

```tsx
import { useState, useEffect } from 'react';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// Direct implementation with hardcoded credentials to bypass DNS issues
const supabaseUrl = 'https://your-project-id.supabase.co';
const supabaseKey = 'your-supabase-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Easy() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>(
    navigator.onLine ? 'online' : 'offline'
  );
  const [lastNetworkCheck, setLastNetworkCheck] = useState<Date>(new Date());

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus('online');
      setLastNetworkCheck(new Date());
    };
    
    const handleOffline = () => {
      setNetworkStatus('offline');
      setLastNetworkCheck(new Date());
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Authentication and data fetching
  useEffect(() => {
    async function initializeSupabase() {
      try {
        setLoading(true);
        
        // Step 1: Check for existing session
        const { data: sessionData } = await supabase.auth.getSession();
        
        // Step 2: If no session, sign in with test credentials
        if (!sessionData.session) {
          console.log('No existing session, signing in...');
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email: 'test@example.com',
            password: 'password123'
          });
          
          if (signInError) {
            throw new Error(`Authentication failed: ${signInError.message}`);
          }
          
          setSession(data.session);
        } else {
          console.log('Using existing session');
          setSession(sessionData.session);
        }
        
        // Step 3: Fetch document types count
        const { count, error: countError } = await supabase
          .from('document_types')
          .select('*', { count: 'exact', head: true });
          
        if (countError) {
          throw new Error(`Data fetching failed: ${countError.message}`);
        }
        
        setCount(count || 0);
      } catch (err) {
        console.error('Supabase error:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    
    initializeSupabase();
  }, []);

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-4">Supabase Connection Demo</h1>
      
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <h2 className="font-bold">Network Status</h2>
        <p>Status: <span className={networkStatus === 'online' ? 'text-green-600' : 'text-red-600'}>
          {networkStatus}
        </span></p>
        <p>Last Checked: {lastNetworkCheck.toLocaleTimeString()}</p>
      </div>
      
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <h2 className="font-bold">Authentication Status</h2>
        <p>{session ? 'Authenticated' : 'Not authenticated'}</p>
        {session && <p>User ID: {session.user.id}</p>}
      </div>
      
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <h2 className="font-bold">Document Types Count</h2>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <div className="text-red-600">
            <p>Error: {error}</p>
          </div>
        ) : (
          <p>Total document types: <span className="font-bold">{count}</span></p>
        )}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
        <h2 className="font-bold text-blue-800">Solution Notes</h2>
        <ul className="list-disc pl-5 mt-2 text-sm">
          <li><strong>Direct Credentials:</strong> Using hardcoded Supabase URL and key to bypass DNS resolution issues</li>
          <li><strong>Auth Flow:</strong> First checks for existing session, then uses signInWithPassword</li>
          <li><strong>Error Handling:</strong> Comprehensive error catching and display</li>
          <li><strong>Network Monitoring:</strong> Shows online/offline status with timestamps</li>
        </ul>
      </div>
    </div>
  );
}
```

## 4. Environment Variable Management

For secure management of Supabase credentials, the following approaches are used:

### Backend (.env.development)

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Frontend (Vite Environment Variables)

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Key Lessons and Best Practices

1. **Singleton Pattern**: Both backend and frontend implementations use the singleton pattern to ensure only one connection instance exists.

2. **DNS Resolution Issues**: By using direct hardcoded URLs instead of environment variables in problematic contexts, we bypass DNS resolution issues.

3. **Authentication Flow**:
   - Always check for an existing session first
   - Use proper signInWithPassword method for authentication
   - Handle auth state changes with onAuthStateChange for React components

4. **Error Handling**:
   - Implement comprehensive try/catch blocks
   - Log detailed error information
   - Present user-friendly error messages in the UI

5. **Network Monitoring**:
   - Track online/offline status
   - Record timestamps of status changes
   - Provide visual indicators for connection status

6. **Separation of Concerns**:
   - Backend service focused on database operations
   - Frontend adapter adds authentication and session management
   - UI components consume services but don't implement connection logic

## Troubleshooting Common Issues

### 1. Authentication Failures

**Symptoms**: "JWT expired", "Invalid API key", "Not authorized"

**Solutions**:
- Verify credentials are correct and up-to-date
- Check if the account has proper permissions in Supabase
- Ensure correct authentication flow is being used
- Verify the anon key is being used for frontend and service role key for backend

### 2. Connection Failures

**Symptoms**: "Failed to fetch", DNS resolution errors, timeout errors

**Solutions**:
- Use direct URLs instead of environment variables
- Verify network connectivity
- Check if Supabase service is running and accessible
- Implement proper network status monitoring

### 3. Data Fetching Issues

**Symptoms**: Empty data arrays, "permission denied for table", RLS errors

**Solutions**:
- Verify the user has appropriate permissions for the requested tables
- Check Row Level Security (RLS) policies
- Ensure authentication was successful before fetching data
- Verify table names and column references match schema

## Conclusion

The complete Supabase connection solution combines backend and frontend approaches, with a focus on reliability, error handling, and user experience. By following the singleton pattern and implementing proper authentication flows, we ensure consistent database access across the entire application.

The direct credential approach serves as a reliable fallback when environment variable resolution fails, while comprehensive error handling provides clear feedback to users and developers about connection issues.

For new components requiring Supabase access, leverage the existing supabaseAdapter for React components or SupabaseClientService for backend operations, rather than implementing new connection logic.