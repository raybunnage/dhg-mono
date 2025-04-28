import { useState, useEffect } from 'react'
import { 
  supabase, 
  supabaseAdapter 
} from '../../../packages/shared/services/supabase-client/universal'

/**
 * Helper to check for potential API key issues
 */
function validateApiKey(key: string | undefined): { isValid: boolean; issue: string | null } {
  if (!key) {
    return { isValid: false, issue: "Key is missing" };
  }
  
  // Check if it's a JWT token (Supabase keys are JWTs)
  if (!key.startsWith('eyJ')) {
    return { isValid: false, issue: "Not a valid JWT token format (should start with 'eyJ')" };
  }
  
  // Check for minimum length
  if (key.length < 100) {
    return { isValid: false, issue: "Key is too short for a Supabase key" };
  }
  
  // Check for correct segments (JWTs have 3 parts separated by dots)
  const parts = key.split('.');
  if (parts.length !== 3) {
    return { isValid: false, issue: "JWT should have 3 parts separated by dots" };
  }
  
  return { isValid: true, issue: null };
}

/**
 * Easy Page Component
 * 
 * This page demonstrates how to use the universal Supabase adapter in a React component.
 * It shows environment configuration, authentication status, and a simple data query.
 */
export function Easy() {
  const [envDebug, setEnvDebug] = useState<Record<string, boolean>>({});
  const [keyValidation, setKeyValidation] = useState<Record<string, {isValid: boolean; issue: string | null}>>({});
  const [authStatus, setAuthStatus] = useState<string>('Not attempted');
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);

  // Check what environment variables we have access to and attempt to use the client
  useEffect(() => {
    async function initializeAndTest() {
      // Debug environment variable access
      const envVars = {
        'VITE_SUPABASE_URL': !!import.meta.env.VITE_SUPABASE_URL,
        'VITE_SUPABASE_ANON_KEY': !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        'VITE_SUPABASE_SERVICE_ROLE_KEY': !!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        'VITE_TEST_USER_EMAIL': !!import.meta.env.VITE_TEST_USER_EMAIL,
        'VITE_TEST_USER_PASSWORD': !!import.meta.env.VITE_TEST_USER_PASSWORD
      };
      
      // Validate API keys
      const keyChecks = {
        'VITE_SUPABASE_ANON_KEY': validateApiKey(import.meta.env.VITE_SUPABASE_ANON_KEY),
        'VITE_SUPABASE_SERVICE_ROLE_KEY': validateApiKey(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY)
      };
      
      console.log('Environment variables available:', envVars);
      console.log('API key validation results:', keyChecks);
      setEnvDebug(envVars);
      setKeyValidation(keyChecks);
      
      try {
        // Authenticate
        setAuthStatus('Authenticating...');
        const { success: authSuccess, diagnostics: authDiagnostics } = await supabaseAdapter.ensureAuth();
        setAuthStatus(authSuccess ? 'Authenticated' : 'Authentication failed');
        setDiagnostics(authDiagnostics);
        
        if (authSuccess) {
          // Get document_types count
          setLoading(true);
          
          try {
            // Create a timeout promise to fail gracefully after 10 seconds
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000);
            });
            
            // Query the document_types table
            const queryPromise = supabase
              .from('document_types')
              .select('id', { count: 'exact', head: true });
            
            const result = await Promise.race([
              queryPromise,
              timeoutPromise
            ]);
            
            if (result.error) {
              console.error('Error getting count:', result.error);
              throw new Error(`Error fetching count: ${result.error.message}`);
            } else {
              setCount(result.count || 0);
              console.log('Successfully fetched count:', result.count);
            }
          } catch (err) {
            console.error('Error fetching count:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Error fetching count: ${errorMessage}`);
            setCount(null);
          } finally {
            setLoading(false);
          }
        } else {
          setLoading(false);
          setError('Authentication failed. See diagnostics section for more details.');
        }
      } catch (err) {
        console.error('Error initializing Supabase:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Error initializing Supabase: ${errorMessage}`);
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
          This is a demonstration page that shows how to use the universal Supabase adapter
          in the frontend, using the following import:
        </p>
        
        <div className="bg-gray-800 text-gray-200 p-3 rounded mb-4 font-mono text-sm">
          import {'{supabase, supabaseAdapter}'} from '../../../packages/shared/services/supabase-client/universal'
        </div>
        
        <p className="mb-4">
          The universal adapter works in both browser and Node.js environments, providing the same interface
          while handling environment-specific implementations transparently.
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
              or API keys. Check the diagnostics section below for more details.
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
                  The <span className="font-mono bg-blue-100 px-1 rounded">document_types</span> table 
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
        
        <h3 className="text-lg font-semibold mb-2">API Key Validation:</h3>
        <ul className="list-disc pl-6 mb-4">
          {Object.entries(keyValidation).map(([key, result]) => (
            <li key={key} className={result.isValid ? "text-green-600" : "text-red-600"}>
              {key}: {result.isValid ? "Valid" : `Invalid - ${result.issue}`}
            </li>
          ))}
        </ul>
        
        {Object.values(keyValidation).some(check => !check.isValid) && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-md mt-4">
            <h4 className="text-red-700 font-medium mb-2">⚠️ API Key Issues Detected</h4>
            <p className="text-red-700">
              One or more of your Supabase API keys appears to be invalid. This is likely causing the authentication failures.
              Please check the following:
            </p>
            <ul className="list-disc pl-6 mt-2 text-red-700">
              <li>Verify that your .env.development file has the correct keys</li>
              <li>Check if your Supabase project is active and the API keys haven't expired</li>
              <li>Make sure you're using the keys from the correct project</li>
              <li>Try regenerating the API keys in the Supabase dashboard if necessary</li>
            </ul>
          </div>
        )}
      </div>
      
      {/* Diagnostics Section */}
      {diagnostics && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Diagnostics</h2>
          <div className="bg-gray-100 p-4 rounded-md overflow-auto">
            <pre className="text-xs text-gray-800 whitespace-pre-wrap">{diagnostics}</pre>
          </div>
        </div>
      )}
      
      {/* Implementation Details */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Implementation Details</h2>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Universal Adapter Pattern</h3>
          <p>
            The solution uses a universal adapter pattern that works identically in both
            frontend and backend code. The adapter detects the environment and provides
            appropriate implementations.
          </p>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Key Features</h3>
          <ul className="list-disc pl-6">
            <li className="mb-2">Environment detection (browser vs Node.js)</li>
            <li className="mb-2">Automatic environment variable selection</li>
            <li className="mb-2">Authentication handling for browser environments</li>
            <li className="mb-2">Consistent interface across environments</li>
            <li className="mb-2">Singleton pattern for efficient resource usage</li>
            <li className="mb-2">Detailed diagnostics for troubleshooting</li>
          </ul>
        </div>
      </div>
    </div>
  )
}