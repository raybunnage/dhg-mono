import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const SimpleFilterTest: React.FC = () => {
  const [result, setResult] = useState<any>({
    profiles: null,
    error: null,
    loading: true
  });

  useEffect(() => {
    const runTest = async () => {
      console.log('=== SimpleFilterTest Starting ===');
      console.log('Supabase client:', supabase);
      console.log('Supabase URL:', (supabase as any).supabaseUrl);
      
      try {
        // Direct database query
        console.log('Executing query: SELECT * FROM filter_user_profiles');
        const { data, error } = await supabase
          .from('filter_user_profiles')
          .select('*');

        console.log('Query complete. Data:', data, 'Error:', error);

        if (error) {
          setResult({
            profiles: null,
            error: error.message,
            loading: false,
            details: error
          });
        } else {
          setResult({
            profiles: data,
            error: null,
            loading: false,
            count: data?.length || 0
          });
        }
      } catch (err: any) {
        console.error('Caught error:', err);
        setResult({
          profiles: null,
          error: err.message || 'Unknown error',
          loading: false,
          exception: err
        });
      }
    };

    runTest();
  }, []);

  return (
    <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg mb-4">
      <h3 className="font-bold text-lg mb-2">Simple Filter Test (Direct DB Query)</h3>
      
      {result.loading && <p>Running query...</p>}
      
      {!result.loading && result.error && (
        <div className="bg-red-100 p-2 rounded">
          <p className="text-red-800">Error: {result.error}</p>
          <pre className="text-xs mt-2">{JSON.stringify(result.details || result.exception, null, 2)}</pre>
        </div>
      )}
      
      {!result.loading && !result.error && (
        <div>
          <p className="font-semibold">Found {result.count} profiles:</p>
          {result.profiles && result.profiles.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {result.profiles.map((p: any) => (
                <li key={p.id} className="text-sm bg-white p-2 rounded">
                  {p.name} - {p.id}
                  {p.is_active && <span className="ml-2 text-green-600">(Active)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No profiles in table</p>
          )}
          
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-gray-600">Raw Data</summary>
            <pre className="text-xs mt-2 bg-white p-2 rounded overflow-auto">
              {JSON.stringify(result.profiles, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};