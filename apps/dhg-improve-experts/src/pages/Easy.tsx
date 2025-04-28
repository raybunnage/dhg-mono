import { useState, useEffect } from 'react'
import { SupabaseClientService } from '../packages/shared/services/supabase-client';

// This is a demonstration page showing how to use the SupabaseClientService adapter
export function EasyPage() {
  const [envDebug, setEnvDebug] = useState<Record<string, boolean>>({});
  const [authStatus, setAuthStatus] = useState<string>('Not attempted');
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check what environment variables we have access to and attempt to use the client
  useEffect(() => {
    async function initializeAndTest() {
      // Debug environment variable access without attempting to use them
      const envVars = {
        'TEST_USER_EMAIL': !!import.meta.env.VITE_TEST_USER_EMAIL,
        'TEST_USER_PASSWORD': !!import.meta.env.VITE_TEST_USER_PASSWORD,
        'SUPABASE_URL': !!import.meta.env.VITE_SUPABASE_URL,
        'SUPABASE_ANON_KEY': !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        'SUPABASE_SERVICE_ROLE_KEY': !!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      };
      
      console.log('Environment variables available:', envVars);
      setEnvDebug(envVars);
      
      // Try to get the SupabaseClientService instance
      try {
        const supabaseService = SupabaseClientService.getInstance();
        console.log('Successfully got SupabaseClientService instance');
        
        // Try to authenticate
        setAuthStatus('Authenticating...');
        const authSuccess = await supabaseService.ensureAuth();
        console.log('Authentication result:', authSuccess);
        setAuthStatus(authSuccess ? 'Authenticated' : 'Authentication failed');
        
        if (authSuccess) {
          // Try to fetch the count
          setLoading(true);
          
          try {
            const client = supabaseService.getClient();
            const { count: recordCount, error } = await client
              .from('sources_google')
              .select('*', { count: 'exact', head: true });
            
            if (error) {
              throw error;
            }
            
            setCount(recordCount);
            console.log('Successfully fetched count:', recordCount);
          } catch (err) {
            console.error('Error fetching count:', err);
            setError(err instanceof Error ? err.message : 'Unknown error fetching count');
          } finally {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error initializing SupabaseClientService:', err);
        setError(err instanceof Error ? err.message : 'Unknown error initializing SupabaseClientService');
        setAuthStatus('Error initializing service');
        setLoading(false);
      }
    }
    
    initializeAndTest();
  }, []);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Easy Page</h1>
      
      {/* Information section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">About This Page</h2>
        <p className="mb-4">
          This is a demonstration page that shows how to use the <code className="bg-gray-100 px-1 rounded">SupabaseClientService</code> singleton pattern
          in the frontend, using the same import path as the backend code:
        </p>
        
        <div className="bg-gray-800 text-gray-200 p-3 rounded mb-4 font-mono text-sm">
          import {'{SupabaseClientService}'} from '../../../packages/shared/services/supabase-client';
        </div>
        
        <p className="mb-4">
          The implementation uses a universal adapter pattern - the frontend code in <code className="bg-gray-100 px-1 rounded">src/packages/shared/services/supabase-client.ts</code> contains
          an environment-aware implementation that works in both browser and Node.js environments.
        </p>
      </div>
      
      {/* Authentication Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
        
        <div className={`p-4 rounded-md mb-4 ${
          authStatus === 'Authenticated' 
            ? 'bg-green-50 text-green-700' 
            : authStatus === 'Authenticating...' 
              ? 'bg-blue-50 text-blue-700'
              : 'bg-yellow-50 text-yellow-700'
        }`}>
          <h3 className="text-lg font-semibold mb-2">Status: {authStatus}</h3>
          {authStatus === 'Authenticated' ? (
            <p>Successfully authenticated with Supabase!</p>
          ) : authStatus === 'Authentication failed' ? (
            <p>
              Failed to authenticate with Supabase. This could be due to invalid credentials
              or API keys. Check the browser console for more details.
            </p>
          ) : null}
        </div>
        
        {/* Data Display */}
        {authStatus === 'Authenticated' && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Data from Supabase:</h3>
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-100 text-red-700 p-4 rounded-md">
                <p className="font-medium">Error fetching data:</p>
                <p>{error}</p>
              </div>
            ) : (
              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-lg">
                  The <span className="font-mono bg-blue-100 px-1 rounded">sources_google</span> table 
                  contains <span className="font-bold text-blue-600">{count?.toLocaleString() || 0}</span> records.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Environment Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Environment Status</h2>
        
        <h3 className="text-lg font-semibold mb-2">Environment Variables:</h3>
        <ul className="list-disc pl-6 mb-4">
          {Object.entries(envDebug).map(([key, available]) => (
            <li key={key} className={available ? "text-green-600" : "text-red-600"}>
              {key}: {available ? "Available" : "Not available"}
            </li>
          ))}
        </ul>
      </div>
      
      {/* Implementation Details */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Implementation Details</h2>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Universal Adapter Pattern</h3>
          <p>
            The solution uses a universal adapter pattern to maintain the same import path across frontend and backend code.
            The implementation detects the environment and provides appropriate implementations.
          </p>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">How It Works</h3>
          <ul className="list-disc pl-6">
            <li className="mb-2">Both frontend and backend code import from <code className="bg-gray-100 px-1 rounded">../../../packages/shared/services/supabase-client</code></li>
            <li className="mb-2">The adapter detects the environment (browser vs Node.js)</li>
            <li className="mb-2">In Node.js, it reads from process.env and uses service role keys</li>
            <li className="mb-2">In browser, it reads from import.meta.env and handles authentication</li>
            <li className="mb-2">This allows for the same import path in both environments with environment-appropriate behavior</li>
          </ul>
        </div>
      </div>
    </div>
  )
}