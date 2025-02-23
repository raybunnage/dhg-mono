import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function TestComponent() {
  const [status, setStatus] = useState('Initializing...');
  const [expert, setExpert] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<string>('Not authenticated');

  useEffect(() => {
    async function testConnection() {
      try {
        // First test basic connection
        const { data, error } = await supabase
          .from('experts')
          .select('*')
          .limit(1)
          .single();

        if (error) throw error;
        
        setExpert(data);
        setStatus('Connected successfully! Found expert:');

        // Now authenticate with test user
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: import.meta.env.VITE_TEST_USER_EMAIL,
            password: import.meta.env.VITE_TEST_USER_PASSWORD || 'testpassword123'
          });

          if (authError) throw authError;

          setAuthStatus(`Authenticated as: ${authData.user?.email}`);
          
          // Test authenticated query
          const { data: authExpert, error: authQueryError } = await supabase
            .from('experts')
            .select('*')
            .limit(1)
            .single();

          if (authQueryError) throw authQueryError;
          
          setExpert(authExpert); // Update with authenticated data
          
        } catch (authErr) {
          setAuthStatus(`Auth Error: ${authErr instanceof Error ? authErr.message : 'Unknown error'}`);
          console.error('Auth error details:', authErr);
        }

      } catch (err) {
        setStatus(`Connection Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('Full error details:', err);
      }
    }

    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Supabase Connection Test</h1>

        {/* Connection Status */}
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">Connection Status</h2>
          <pre className="bg-gray-100 p-4 rounded mb-4">
            {status}
          </pre>

          {/* Auth Status */}
          <h2 className="text-lg font-semibold mb-2">Authentication Status</h2>
          <pre className="bg-gray-100 p-4 rounded mb-4">
            {authStatus}
          </pre>

          {/* Display Expert Data */}
          {expert && (
            <div className="mt-4">
              <h3 className="text-md font-semibold mb-2">Expert Data:</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto">
                {JSON.stringify(expert, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <TestComponent />
    </QueryClientProvider>
  );
}

export default App;