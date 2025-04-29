import { useState, useEffect } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../supabase/types';

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
 * Direct Supabase client using Vite environment variables
 */
const createSupabaseClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Check .env.development file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      storageKey: 'dhg-supabase-auth',
      persistSession: true,
      autoRefreshToken: true
    }
  });
};

// Create Supabase client instance
let supabase: SupabaseClient<Database>;
try {
  supabase = createSupabaseClient();
} catch (error) {
  console.error('Failed to create Supabase client:', error);
}

/**
 * Easy Page Component
 * 
 * Demonstrates direct Supabase connection and authentication in a React app
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
      console.log('Starting initialization and testing...');
      
      // Collect diagnostics
      let diagOutput = "";
      const addDiagnostic = (message: string) => {
        console.log(message);
        diagOutput += message + "\n";
      };
      
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
        // Try authentication
        setAuthStatus('Authenticating...');
        addDiagnostic('Attempting to authenticate...');
        
        // Check if we already have a session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          addDiagnostic(`Already authenticated as: ${sessionData.session.user.email || 'Unknown user'}`);
          setAuthStatus('Authenticated');
        } else if (import.meta.env.VITE_TEST_USER_EMAIL && import.meta.env.VITE_TEST_USER_PASSWORD) {
          // Try to sign in with test credentials
          addDiagnostic(`Attempting to sign in with test user: ${import.meta.env.VITE_TEST_USER_EMAIL}`);
          
          const { data, error: authError } = await supabase.auth.signInWithPassword({
            email: import.meta.env.VITE_TEST_USER_EMAIL,
            password: import.meta.env.VITE_TEST_USER_PASSWORD
          });
          
          if (authError) {
            addDiagnostic(`Authentication failed: ${authError.message}`);
            setAuthStatus('Authentication failed');
            setDiagnostics(diagOutput);
            setLoading(false);
            setError(`Authentication failed: ${authError.message}`);
            return;
          }
          
          if (data.user) {
            addDiagnostic(`Successfully authenticated as: ${data.user.email}`);
            setAuthStatus('Authenticated');
          }
        } else {
          addDiagnostic('No test user credentials available - using anonymous access');
          setAuthStatus('Using anonymous access');
        }
        
        setDiagnostics(diagOutput);
        
        // Get document_types count
        setLoading(true);
        
        try {
          addDiagnostic('Attempting to fetch document_types count...');
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
            addDiagnostic(`Error getting count: ${result.error.message}`);
            throw new Error(`Error fetching count: ${result.error.message}`);
          } else {
            setCount(result.count || 0);
            addDiagnostic(`Successfully fetched count: ${result.count}`);
            console.log('Successfully fetched count:', result.count);
          }
        } catch (err) {
          console.error('Error fetching count:', err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          addDiagnostic(`Error fetching count: ${errorMessage}`);
          setError(`Error fetching count: ${errorMessage}`);
          setCount(null);
        } finally {
          setLoading(false);
          setDiagnostics(diagOutput);
        }
      } catch (err) {
        console.error('Error initializing Supabase:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        addDiagnostic(`Error initializing Supabase: ${errorMessage}`);
        setError(`Error initializing Supabase: ${errorMessage}`);
        setAuthStatus('Error initializing service');
        setLoading(false);
        setDiagnostics(diagOutput);
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
          This is a demonstration page that shows direct connection to Supabase 
          in a React application using environment variables.
        </p>
        
        <div className="bg-gray-800 text-gray-200 p-3 rounded mb-4 font-mono text-sm">
          {`import { createClient } from '@supabase/supabase-js'\n\nconst supabase = createClient(\n  import.meta.env.VITE_SUPABASE_URL,\n  import.meta.env.VITE_SUPABASE_ANON_KEY\n)`}
        </div>
        
        <p className="mb-4">
          This approach directly uses the Supabase JS client in the browser environment,
          configured with your VITE_ prefixed environment variables.
        </p>
      </div>
      
      {/* Authentication Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
        
        <div className={`p-4 rounded-md mb-4 ${
          authStatus === 'Authenticated' || authStatus === 'Using anonymous access'
            ? 'bg-green-50 text-green-700' 
            : authStatus === 'Authenticating...' 
              ? 'bg-blue-50 text-blue-700'
              : 'bg-yellow-50 text-yellow-700'
        }`}>
          <h3 className="text-lg font-semibold mb-2">Status: {authStatus}</h3>
          {authStatus === 'Authenticated' ? (
            <p>Successfully authenticated with Supabase!</p>
          ) : authStatus === 'Using anonymous access' ? (
            <p>Using anonymous access with Supabase anon key</p>
          ) : authStatus === 'Authentication failed' ? (
            <p>
              Failed to authenticate with Supabase. This could be due to invalid credentials
              or API keys. Check the diagnostics section below for more details.
            </p>
          ) : null}
        </div>
        
        {/* Data Display */}
        {(authStatus === 'Authenticated' || authStatus === 'Using anonymous access') && (
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
          <h3 className="text-lg font-semibold mb-2">Direct Client Approach</h3>
          <p>
            This implementation uses a direct Supabase client created with environment variables,
            avoiding complex adapter patterns for simplicity and reliability.
          </p>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Authentication Options</h3>
          <ul className="list-disc pl-6">
            <li className="mb-2">Uses test user credentials if available</li>
            <li className="mb-2">Falls back to anonymous access with anon key</li>
            <li className="mb-2">Maintains persistent session with browser storage</li>
            <li className="mb-2">Automatically refreshes tokens when needed</li>
          </ul>
        </div>
      </div>
    </div>
  )
}