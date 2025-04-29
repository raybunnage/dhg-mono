import { useState, useEffect } from 'react'
// Import the Supabase adapter
import { supabase, supabaseAdapter } from '@/utils/supabase-adapter'
import type { Database } from '../../../supabase/types'

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

// Test user for authentication
const testUser = {
  email: 'bunnage.ray+test2@gmail.com',
  password: 'test1234',
};

/**
 * Easy Page Component
 * Demonstrates a working Supabase connection with authentication and data fetching
 * using the universal Supabase adapter from shared services
 */
export function Easy() {
  const [envDebug, setEnvDebug] = useState<Record<string, boolean>>({});
  const [keyValidation, setKeyValidation] = useState<Record<string, {isValid: boolean; issue: string | null}>>({});
  const [authStatus, setAuthStatus] = useState<string>('Not attempted');
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState({
    online: navigator.onLine,
    lastChecked: new Date()
  });

  // Check what environment variables we have access to and attempt connection
  useEffect(() => {
    async function initializeAndTest() {
      console.log('Starting Supabase connection test...');
      
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
      
      // Get detailed adapter diagnostics
      const adapterDiagnostics = await supabaseAdapter.getDiagnostics();
      addDiagnostic(`Using universal Supabase adapter in ${adapterDiagnostics.environment} environment`);
      addDiagnostic(`Supabase URL: ${adapterDiagnostics.urlPreview}`);
      addDiagnostic(`Supabase Key: ${adapterDiagnostics.keyPreview}`);
      addDiagnostic(`Network status: ${navigator.onLine ? 'Online' : 'Offline'}`);
      
      // Authentication and database query
      try {
        // Step 1: Authentication
        setAuthStatus('Authenticating...');
        addDiagnostic('Attempting to authenticate...');
        
        // Use the adapter's ensureAuth method instead of manual authentication
        const { success: authSuccess, diagnostics: authDiagnostics } = 
          await supabaseAdapter.ensureAuth();
        
        if (authSuccess) {
          addDiagnostic('Authentication successful');
          setAuthStatus('Authenticated');
        } else {
          // Fallback to manual authentication if adapter's method fails
          addDiagnostic('Adapter authentication failed, trying manual authentication');
          
          // First try to get any existing session
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData.session) {
            // Already authenticated
            addDiagnostic(`Already authenticated as: ${sessionData.session.user.email || 'Unknown user'}`);
            setAuthStatus('Authenticated');
          } else {
            // Need to log in with test user
            addDiagnostic(`No existing session. Signing in with test user: ${testUser.email}`);
            
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
              email: testUser.email,
              password: testUser.password
            });
            
            if (authError) {
              addDiagnostic(`Authentication failed: ${authError.message}`);
              setAuthStatus('Authentication failed');
              setError(`Authentication failed: ${authError.message}`);
              setLoading(false);
              setDiagnostics(diagOutput);
              return;
            }
            
            if (authData.user) {
              addDiagnostic(`Successfully authenticated as: ${authData.user.email}`);
              setAuthStatus('Authenticated');
            }
          }
        }
        
        // Step 2: Query document_types table
        setLoading(true);
        addDiagnostic('Querying document_types table...');
        
        const { data, error: queryError, count: docCount } = await supabase
          .from('document_types')
          .select('id', { count: 'exact', head: true });
        
        if (queryError) {
          addDiagnostic(`Query failed: ${queryError.message}`);
          setError(`Error querying document_types: ${queryError.message}`);
          setLoading(false);
          setDiagnostics(diagOutput);
          return;
        }
        
        addDiagnostic(`Query successful! Found ${docCount} document types.`);
        setCount(docCount || 0);
        setLoading(false);
        
      } catch (err) {
        // Handle any unexpected errors
        console.error('Error in Supabase operations:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        addDiagnostic(`Error in Supabase operations: ${errorMessage}`);
        setError(`Error: ${errorMessage}`);
        setAuthStatus('Error');
        setLoading(false);
      }
      
      // Set final diagnostics
      setDiagnostics(diagOutput);
    }
    
    // Run the initialization
    initializeAndTest();
    
    // Set up network listeners to track online/offline status
    const handleNetworkChange = () => {
      setNetworkStatus({
        online: navigator.onLine,
        lastChecked: new Date()
      });
    };
    
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    
    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, []);
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Easy Page - Universal Supabase Adapter</h1>
      
      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        
        <div className={`p-4 rounded-md mb-4 ${
          networkStatus.online 
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        }`}>
          <h3 className="text-lg font-semibold mb-2">Network: {networkStatus.online ? 'Online' : 'Offline'}</h3>
          <p>Last checked: {networkStatus.lastChecked.toLocaleTimeString()}</p>
        </div>
        
        <div className={`p-4 rounded-md mb-4 ${
          authStatus === 'Authenticated' 
            ? 'bg-green-50 text-green-700' 
            : authStatus === 'Authenticating...' 
              ? 'bg-blue-50 text-blue-700'
              : 'bg-yellow-50 text-yellow-700'
        }`}>
          <h3 className="text-lg font-semibold mb-2">Supabase Status: {authStatus}</h3>
          {authStatus === 'Authenticated' ? (
            <p>Successfully authenticated with Supabase!</p>
          ) : authStatus === 'Authentication failed' ? (
            <p>
              Failed to authenticate with Supabase. Check the diagnostics section below for more details.
            </p>
          ) : null}
        </div>
      </div>
      
      {/* Data Display */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Document Types Count</h2>
        
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 text-red-700 p-4 rounded-md">
            <p className="font-medium">Error:</p>
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
      
      {/* Solution Details */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Solution Details</h2>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Using Universal Supabase Adapter</h3>
          <p className="mb-2">This page uses the universal Supabase adapter from the shared services:</p>
          
          <div className="bg-gray-800 text-gray-200 p-3 rounded mb-4 font-mono text-sm">
            {`// Import the universal adapter from shared services
import { supabase, supabaseAdapter } from '@root/packages/shared/services/supabase-client/universal'

// Use the client directly
const { data, error } = await supabase
  .from('document_types')
  .select('id', { count: 'exact', head: true });

// Or use adapter methods
const { success, diagnostics } = await supabaseAdapter.ensureAuth();`}
          </div>
          
          <p className="mb-2">Key benefits of the universal adapter:</p>
          <ul className="list-disc pl-6 mb-4">
            <li className="mb-1">Works in both browser and Node.js environments</li>
            <li className="mb-1">Consistently handles authentication across environments</li>
            <li className="mb-1">Provides detailed diagnostics and error handling</li>
            <li className="mb-1">Uses shared singleton pattern for resource efficiency</li>
          </ul>
        </div>
      </div>
      
      {/* Environment Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
        
        <h3 className="text-lg font-semibold mb-2">Available Variables:</h3>
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
      </div>
      
      {/* Diagnostics Section */}
      {diagnostics && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Diagnostics Log</h2>
          <div className="bg-gray-100 p-4 rounded-md overflow-auto">
            <pre className="text-xs text-gray-800 whitespace-pre-wrap">{diagnostics}</pre>
          </div>
        </div>
      )}
    </div>
  )
}