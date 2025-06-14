import React, { useState } from 'react';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

export function TestSupabaseAdapter() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testAdapter = async () => {
    setStatus('testing');
    setResult(null);
    setError('');

    try {
      // Create adapter with browser environment variables
      const supabase = createSupabaseAdapter({
        env: import.meta.env
      });

      // Test a simple query
      const { data, error: queryError } = await supabase
        .from('command_pipelines')
        .select('name, display_name, status')
        .limit(5);

      if (queryError) {
        throw new Error(queryError.message);
      }

      setResult(data);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Supabase Adapter Test</h2>
      
      <div className="bg-gray-100 p-4 rounded">
        <p className="text-sm text-gray-600 mb-2">
          This tests the browser-safe Supabase adapter that automatically handles environment variables.
        </p>
        <button
          onClick={testAdapter}
          disabled={status === 'testing'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {status === 'testing' ? 'Testing...' : 'Test Supabase Adapter'}
        </button>
      </div>

      {status === 'success' && (
        <div className="bg-green-100 p-4 rounded">
          <h3 className="font-semibold text-green-800 mb-2">✅ Success!</h3>
          <p className="text-sm mb-2">Query returned {result?.length || 0} pipelines:</p>
          <pre className="bg-white p-2 rounded text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-100 p-4 rounded">
          <h3 className="font-semibold text-red-800 mb-2">❌ Error</h3>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}