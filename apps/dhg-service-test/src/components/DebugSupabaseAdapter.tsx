import React, { useEffect, useState } from 'react';

export function DebugSupabaseAdapter() {
  const [envData, setEnvData] = useState<any>({});
  const [adapterError, setAdapterError] = useState<string>('');

  useEffect(() => {
    // Debug environment variables
    const env = import.meta.env;
    setEnvData({
      MODE: env.MODE,
      DEV: env.DEV,
      PROD: env.PROD,
      VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
      // Check if values exist
      hasUrl: !!env.VITE_SUPABASE_URL,
      hasKey: !!env.VITE_SUPABASE_ANON_KEY,
      urlLength: env.VITE_SUPABASE_URL?.length || 0,
      keyLength: env.VITE_SUPABASE_ANON_KEY?.length || 0
    });

    // Try creating adapter to see error
    try {
      const { createSupabaseAdapter } = require('@shared/adapters/supabase-adapter');
      const adapter = createSupabaseAdapter({
        env: import.meta.env
      });
      setAdapterError('Adapter created successfully!');
    } catch (err) {
      setAdapterError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="font-bold mb-2">Supabase Adapter Debug Info</h3>
      
      <div className="mb-4">
        <h4 className="font-semibold">Environment Variables:</h4>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
          {JSON.stringify(envData, null, 2)}
        </pre>
      </div>

      <div>
        <h4 className="font-semibold">Adapter Creation Result:</h4>
        <p className={`text-sm ${adapterError.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
          {adapterError}
        </p>
      </div>

      {!envData.hasUrl && (
        <div className="mt-4 p-2 bg-red-100 rounded">
          <p className="text-red-700 text-sm">
            ⚠️ VITE_SUPABASE_URL is not available in import.meta.env
          </p>
        </div>
      )}

      {!envData.hasKey && (
        <div className="mt-2 p-2 bg-red-100 rounded">
          <p className="text-red-700 text-sm">
            ⚠️ VITE_SUPABASE_ANON_KEY is not available in import.meta.env
          </p>
        </div>
      )}
    </div>
  );
}